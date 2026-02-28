const path = require("path");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const { applyAdversarialPerturbation } = require("../utils/perturbation");
const { calculateSSIM } = require("../utils/similarity");
const { generateDifferenceMap } = require("../utils/differenceMap");
const { compareFaceDetection, detectFaceBoxes } = require("../utils/faceDetect");

// In-memory store for results (no database needed for hackathon)
const results = new Map();

/**
 * POST /api/images/upload
 * Upload an image, apply adversarial perturbation, return results
 */
exports.uploadAndProtect = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    const imageId = uuidv4();
    const originalPath = req.file.path;
    const originalFilename = req.file.filename;
    const protectedFilename = `protected-${originalFilename}`;
    const diffFilename = `diff-${originalFilename}`;
    const protectedPath = path.join(__dirname, "..", "protected", protectedFilename);
    const diffPath = path.join(__dirname, "..", "protected", diffFilename);

    // Get protection strength from request (default: medium)
    const strength = req.body.strength || "medium";
    const epsilonMap = { low: 8, medium: 14, high: 22 };
    const epsilon = epsilonMap[strength] || 14;

    console.log(`\n🔄 Processing image: ${req.file.originalname}`);
    console.log(`   Strength: ${strength} (epsilon: ${epsilon})`);

    // Step 1: Read original image raw pixel data
    const originalImage = sharp(originalPath);
    const metadata = await originalImage.metadata();
    const { width, height, channels } = metadata;

    const originalBuffer = await originalImage
      .raw()
      .toBuffer();

    console.log(`   Image size: ${width}x${height}, channels: ${channels}`);

    // Step 2a: Detect face bounding boxes using ML model
    console.log("   🧠 Detecting face locations...");
    const faceBoxes = await detectFaceBoxes(originalPath);
    console.log(`   Found ${faceBoxes.length} face(s): ${faceBoxes.map(b => `${b.width}x${b.height}@(${b.x},${b.y})`).join(", ") || "none (using center fallback)"}`);

    // Step 2b: Apply adversarial perturbation (targeted at face boxes)
    const startTime = Date.now();
    const protectedBuffer = applyAdversarialPerturbation(
      Buffer.from(originalBuffer),
      width,
      height,
      channels,
      epsilon,
      faceBoxes
    );
    const processingTime = Date.now() - startTime;
    console.log(`   Perturbation applied in ${processingTime}ms`);

    // Step 3: Save protected image
    await sharp(protectedBuffer, {
      raw: { width, height, channels },
    })
      .png({ quality: 100 })
      .toFile(protectedPath);

    // Step 4: Generate difference heatmap
    const diffBuffer = generateDifferenceMap(
      originalBuffer,
      protectedBuffer,
      width,
      height,
      channels
    );

    await sharp(diffBuffer, {
      raw: { width, height, channels: 3 },
    })
      .png()
      .toFile(diffPath);

    // Step 5: Calculate SSIM (similarity score)
    const ssim = calculateSSIM(originalBuffer, protectedBuffer, width, height, channels);
    console.log(`   SSIM Score: ${ssim.toFixed(4)} (1.0 = identical)`);
    console.log(`   ✅ Protection complete!\n`);

    // Step 6: Calculate stats
    const totalPixels = width * height;
    const perturbedPixels = countPerturbedPixels(originalBuffer, protectedBuffer, channels);
    const avgNoise = calculateAvgNoise(originalBuffer, protectedBuffer);

    // Store result
    const result = {
      id: imageId,
      originalUrl: `/uploads/${originalFilename}`,
      protectedUrl: `/protected/${protectedFilename}`,
      differenceUrl: `/protected/${diffFilename}`,
      originalName: req.file.originalname,
      width,
      height,
      strength,
      epsilon,
      ssim: parseFloat(ssim.toFixed(4)),
      processingTime,
      stats: {
        totalPixels,
        perturbedPixels,
        perturbedPercent: parseFloat(((perturbedPixels / totalPixels) * 100).toFixed(1)),
        avgNoiseLevel: parseFloat(avgNoise.toFixed(2)),
        humanVisibility: ssim > 0.93 ? "Invisible" : ssim > 0.88 ? "Nearly invisible" : "Slightly visible",
        aiDisruption: epsilon >= 12 ? "Maximum" : epsilon >= 6 ? "High" : "Moderate",
      },
      createdAt: new Date().toISOString(),
    };

    results.set(imageId, result);

    res.json({
      success: true,
      message: "Image protected successfully!",
      data: result,
    });
  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).json({
      error: "Failed to process image",
      details: error.message,
    });
  }
};

/**
 * GET /api/images/result/:id
 * Get results for a previously processed image
 */
exports.getResult = (req, res) => {
  const result = results.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: "Result not found" });
  }
  res.json({ success: true, data: result });
};

/**
 * GET /api/images/compare/:id
 * Get comparison data for an image
 */
exports.getComparison = (req, res) => {
  const result = results.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: "Result not found" });
  }
  res.json({
    success: true,
    data: {
      original: result.originalUrl,
      protected: result.protectedUrl,
      difference: result.differenceUrl,
      ssim: result.ssim,
      stats: result.stats,
    },
  });
};

// ----- Helper Functions -----

/**
 * GET /api/images/detect/:id
 * Run ML face detection on both original and protected images
 * THIS IS THE KEY DEMO ENDPOINT — proves the shield works!
 */
exports.runFaceDetection = async (req, res) => {
  try {
    const result = results.get(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Result not found" });
    }

    const originalPath = path.join(__dirname, "..", result.originalUrl.replace(/^\//, ""));
    const protectedPath = path.join(__dirname, "..", result.protectedUrl.replace(/^\//, ""));

    console.log("\n🔍 Running ML face detection comparison...");
    const comparison = await compareFaceDetection(originalPath, protectedPath);

    res.json({
      success: true,
      message: "Face detection comparison complete",
      data: {
        imageId: req.params.id,
        ...comparison,
      },
    });
  } catch (error) {
    console.error("Face detection error:", error);
    res.status(500).json({
      error: "Face detection failed",
      details: error.message,
    });
  }
};

function countPerturbedPixels(original, perturbed, channels) {
  let count = 0;
  for (let i = 0; i < original.length; i += channels) {
    for (let c = 0; c < channels; c++) {
      if (original[i + c] !== perturbed[i + c]) {
        count++;
        break;
      }
    }
  }
  return count;
}

function calculateAvgNoise(original, perturbed) {
  let totalDiff = 0;
  for (let i = 0; i < original.length; i++) {
    totalDiff += Math.abs(original[i] - perturbed[i]);
  }
  return totalDiff / original.length;
}
