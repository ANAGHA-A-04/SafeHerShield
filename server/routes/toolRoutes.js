const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const toolController = require("../controllers/toolController");

const router = express.Router();

// Multer config — same as image routes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype.split("/")[1]);
    if (extOk || mimeOk) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP accepted"));
  },
});

// ===== METADATA =====
router.post("/metadata/scan", upload.single("image"), toolController.scanMetadata);
router.post("/metadata/strip", upload.single("image"), toolController.stripImageMetadata);

// ===== WATERMARK =====
router.post("/watermark/embed", upload.single("image"), toolController.embedWatermarkHandler);
router.post("/watermark/extract", upload.single("image"), toolController.extractWatermarkHandler);

// ===== FORENSICS =====
router.post("/forensics/ela", upload.single("image"), toolController.analyzeELA);

module.exports = router;
