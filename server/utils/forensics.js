/**
 * ERROR LEVEL ANALYSIS (ELA) UTILITY
 * ===================================
 * Detect image tampering / editing by re-compressing at a known
 * quality and comparing the error levels.
 *
 * How it works:
 *   1. Re-save the image as JPEG at quality 95%
 *   2. Calculate pixel-by-pixel difference between original and re-saved
 *   3. Edited/spliced regions show HIGHER error levels than untouched areas
 *
 * This is the same technique used by forensic analysts to spot photoshopped images.
 */

const sharp = require("sharp");
const path = require("path");

/**
 * Perform Error Level Analysis on an image.
 *
 * @param {string} inputPath - Path to the image to analyze
 * @param {string} outputDir - Directory to save the ELA visualization
 * @param {string} basename - Base filename for outputs
 * @returns {object} - Analysis results + paths to visualization images
 */
async function performELA(inputPath, outputDir, basename) {
  const originalImage = sharp(inputPath);
  const metadata = await originalImage.metadata();
  const { width, height } = metadata;

  // Step 1: Get original pixel data (normalized to 3-channel RGB)
  const originalBuffer = await sharp(inputPath)
    .resize(width, height) // normalize
    .removeAlpha()
    .raw()
    .toBuffer();

  // Step 2: Re-compress as JPEG at quality 95
  const recompressed = await sharp(inputPath)
    .removeAlpha()
    .jpeg({ quality: 95 })
    .toBuffer();

  // Step 3: Decode the recompressed JPEG back to raw pixels
  const recompressedBuffer = await sharp(recompressed)
    .resize(width, height)
    .removeAlpha()
    .raw()
    .toBuffer();

  // Step 4: Calculate error levels (amplified 20x for visibility)
  const channels = 3;
  const totalPixels = width * height;
  const elaBuffer = Buffer.alloc(totalPixels * channels);
  const amplification = 20;

  let totalError = 0;
  let maxError = 0;
  const errorHistogram = new Array(256).fill(0);

  // Per-region stats for grid analysis
  const gridSize = 8;
  const gridW = Math.ceil(width / gridSize);
  const gridH = Math.ceil(height / gridSize);
  const gridErrors = new Float32Array(gridW * gridH);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      let pixelError = 0;

      for (let c = 0; c < channels; c++) {
        const diff = Math.abs(originalBuffer[idx + c] - recompressedBuffer[idx + c]);
        const amplified = Math.min(255, diff * amplification);
        elaBuffer[idx + c] = amplified;
        pixelError += diff;
      }

      const avgError = pixelError / channels;
      totalError += avgError;
      maxError = Math.max(maxError, avgError);
      errorHistogram[Math.min(255, Math.round(avgError))]++;

      // Grid accumulation
      const gx = Math.floor(x / gridSize);
      const gy = Math.floor(y / gridSize);
      gridErrors[gy * gridW + gx] += avgError;
    }
  }

  const avgError = totalError / totalPixels;

  // Step 5: Detect suspicious regions (error > 2x average)
  const suspiciousThreshold = avgError * 2.5;
  let suspiciousPixels = 0;
  const suspiciousRegions = [];

  // Find grid cells with high error
  const gridPixelsPerCell = gridSize * gridSize;
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const avgGridError = gridErrors[gy * gridW + gx] / gridPixelsPerCell;
      if (avgGridError > suspiciousThreshold) {
        suspiciousPixels += gridPixelsPerCell;
      }
    }
  }

  // Step 6: Build heatmap visualization (red = high error, blue = low)
  const heatmapBuffer = Buffer.alloc(totalPixels * channels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * channels;
    const r = elaBuffer[idx], g = elaBuffer[idx + 1], b = elaBuffer[idx + 2];
    const intensity = (r + g + b) / 3;

    if (intensity > 150) {
      // High error — red
      heatmapBuffer[idx] = 255;
      heatmapBuffer[idx + 1] = Math.round(intensity * 0.3);
      heatmapBuffer[idx + 2] = 0;
    } else if (intensity > 80) {
      // Medium error — yellow
      heatmapBuffer[idx] = 255;
      heatmapBuffer[idx + 1] = 255;
      heatmapBuffer[idx + 2] = 0;
    } else if (intensity > 30) {
      // Low error — green
      heatmapBuffer[idx] = 0;
      heatmapBuffer[idx + 1] = Math.round(intensity * 2);
      heatmapBuffer[idx + 2] = 0;
    } else {
      // Minimal error — dark blue
      heatmapBuffer[idx] = 0;
      heatmapBuffer[idx + 1] = 0;
      heatmapBuffer[idx + 2] = Math.max(30, Math.round(intensity * 3));
    }
  }

  // Step 7: Save ELA and heatmap images
  const elaFilename = `ela-${basename}.png`;
  const heatmapFilename = `ela-heatmap-${basename}.png`;
  const elaPath = path.join(outputDir, elaFilename);
  const heatmapPath = path.join(outputDir, heatmapFilename);

  await sharp(elaBuffer, { raw: { width, height, channels } })
    .png()
    .toFile(elaPath);

  await sharp(heatmapBuffer, { raw: { width, height, channels } })
    .png()
    .toFile(heatmapPath);

  // Step 8: Determine verdict
  const suspiciousPercent = (suspiciousPixels / totalPixels) * 100;
  let verdict, confidence;

  if (suspiciousPercent > 15) {
    verdict = "Likely Edited/Manipulated";
    confidence = "High";
  } else if (suspiciousPercent > 5) {
    verdict = "Possibly Edited";
    confidence = "Medium";
  } else if (avgError > 8) {
    verdict = "Signs of Re-compression";
    confidence = "Low";
  } else {
    verdict = "Appears Authentic";
    confidence = "High";
  }

  return {
    verdict,
    confidence,
    avgErrorLevel: avgError.toFixed(2),
    maxErrorLevel: maxError.toFixed(2),
    suspiciousPercent: suspiciousPercent.toFixed(1),
    width,
    height,
    elaUrl: `/protected/${elaFilename}`,
    heatmapUrl: `/protected/${heatmapFilename}`,
    explanation: getExplanation(verdict),
  };
}

function getExplanation(verdict) {
  const explanations = {
    "Likely Edited/Manipulated": "Large regions show significantly different error levels, indicating parts of the image were added, removed, or modified. The red areas in the heatmap highlight suspicious regions.",
    "Possibly Edited": "Some regions show elevated error levels that may indicate editing. This could also be caused by mixed compression or image processing.",
    "Signs of Re-compression": "The image shows uniform elevated error levels, suggesting it has been saved/compressed multiple times. This is common for images shared on social media.",
    "Appears Authentic": "Error levels are consistent across the image, suggesting no significant editing or manipulation was detected."
  };
  return explanations[verdict] || "";
}

module.exports = { performELA };
