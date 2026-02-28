const path = require("path");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const { extractMetadata, stripMetadata } = require("../utils/metadata");
const { embedWatermark, extractWatermark } = require("../utils/watermark");
const { performELA } = require("../utils/forensics");

// In-memory store
const results = new Map();

/**
 * POST /api/tools/metadata/scan
 * Extract and display all metadata from an uploaded image
 */
exports.scanMetadata = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    console.log(`\n🔍 Scanning metadata: ${req.file.originalname}`);
    const metadata = await extractMetadata(req.file.path);

    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        fileSize: req.file.size,
        ...metadata
      }
    });
  } catch (err) {
    console.error("Metadata scan error:", err);
    res.status(500).json({ error: "Failed to scan metadata" });
  }
};

/**
 * POST /api/tools/metadata/strip
 * Remove ALL metadata from an image and return the clean version
 */
exports.stripImageMetadata = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const id = uuidv4();
    const ext = path.extname(req.file.originalname) || ".png";
    const cleanFilename = `clean-${id}${ext}`;
    const cleanPath = path.join(__dirname, "..", "protected", cleanFilename);

    console.log(`\n🧹 Stripping metadata: ${req.file.originalname}`);

    // Extract before metadata for comparison
    const beforeMeta = await extractMetadata(req.file.path);

    // Strip it
    const stripResult = await stripMetadata(req.file.path, cleanPath);

    // Extract after metadata
    const afterMeta = await extractMetadata(cleanPath);

    res.json({
      success: true,
      data: {
        id,
        originalName: req.file.originalname,
        cleanUrl: `/protected/${cleanFilename}`,
        before: beforeMeta,
        after: afterMeta,
        ...stripResult
      }
    });
  } catch (err) {
    console.error("Metadata strip error:", err);
    res.status(500).json({ error: "Failed to strip metadata" });
  }
};

/**
 * POST /api/tools/watermark/embed
 * Embed a hidden message in an image using LSB steganography
 */
exports.embedWatermarkHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const message = req.body.message;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const id = uuidv4();
    const wmFilename = `watermarked-${id}.png`;
    const wmPath = path.join(__dirname, "..", "protected", wmFilename);

    console.log(`\n💧 Embedding watermark: "${message.substring(0, 30)}..." into ${req.file.originalname}`);

    const result = await embedWatermark(req.file.path, wmPath, message.trim());

    res.json({
      success: true,
      data: {
        id,
        originalName: req.file.originalname,
        watermarkedUrl: `/protected/${wmFilename}`,
        message: message.trim(),
        ...result
      }
    });
  } catch (err) {
    console.error("Watermark embed error:", err);
    res.status(500).json({ error: err.message || "Failed to embed watermark" });
  }
};

/**
 * POST /api/tools/watermark/extract
 * Extract a hidden watermark from an image
 */
exports.extractWatermarkHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    console.log(`\n🔎 Extracting watermark from: ${req.file.originalname}`);

    const result = await extractWatermark(req.file.path);

    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        ...result
      }
    });
  } catch (err) {
    console.error("Watermark extract error:", err);
    res.status(500).json({ error: "Failed to extract watermark" });
  }
};

/**
 * POST /api/tools/forensics/ela
 * Perform Error Level Analysis to detect image tampering
 */
exports.analyzeELA = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const id = uuidv4();
    const outputDir = path.join(__dirname, "..", "protected");

    console.log(`\n🔬 Running ELA forensics: ${req.file.originalname}`);

    const result = await performELA(req.file.path, outputDir, id);

    res.json({
      success: true,
      data: {
        id,
        originalName: req.file.originalname,
        originalUrl: `/uploads/${req.file.filename}`,
        ...result
      }
    });
  } catch (err) {
    console.error("ELA analysis error:", err);
    res.status(500).json({ error: "Failed to perform forensic analysis" });
  }
};
