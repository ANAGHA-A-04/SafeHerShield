/**
 * Generate test images for demo purposes.
 * Run: node generate-test-images.js
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const outDir = path.join(__dirname, "test-images");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

async function generate() {
  console.log("Generating test images...\n");

  // 1. Create a clean gradient image (800x600)
  const width = 800, height = 600;
  const channels = 3;
  const buf = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      buf[idx] = Math.round((x / width) * 200) + 30;      // R: gradient left→right
      buf[idx + 1] = Math.round((y / height) * 180) + 40;  // G: gradient top→down
      buf[idx + 2] = 140;                                   // B: constant
    }
  }

  // Save as "original" (this will be the clean reference)
  const originalPath = path.join(outDir, "test-original.png");
  await sharp(buf, { raw: { width, height, channels } }).png().toFile(originalPath);
  console.log("✅ test-original.png — Clean image for watermark/metadata testing");

  // 2. Create a TAMPERED version (splice a bright rectangle — simulates photoshop edit)
  const tampered = Buffer.from(buf);
  // Draw a bright white rectangle in the middle (simulates pasting something)
  const rx = 250, ry = 150, rw = 300, rh = 200;
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const idx = (y * width + x) * 3;
      // Different compression artifact pattern — saved separately at different quality
      tampered[idx] = 255;
      tampered[idx + 1] = 220;
      tampered[idx + 2] = 180;
    }
  }

  // Save the tampered image — first as JPEG quality 85, then re-save as JPEG 95
  // This double-compression creates the artifact mismatch ELA detects
  const tempPath = path.join(outDir, "temp-step1.jpg");
  await sharp(tampered, { raw: { width, height, channels } })
    .jpeg({ quality: 75 }) // Low quality first pass  
    .toFile(tempPath);

  // Now splice: take the ORIGINAL background and paste the already-compressed rectangle area
  const recompressedBuf = await sharp(tempPath).raw().toBuffer();
  const splicedBuf = Buffer.from(buf); // start with clean original

  // Copy the double-compressed rectangle into the clean image
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const idx = (y * width + x) * 3;
      splicedBuf[idx] = recompressedBuf[idx];
      splicedBuf[idx + 1] = recompressedBuf[idx + 1];
      splicedBuf[idx + 2] = recompressedBuf[idx + 2];
    }
  }

  const tamperedPath = path.join(outDir, "test-tampered.jpg");
  await sharp(splicedBuf, { raw: { width, height, channels } })
    .jpeg({ quality: 95 })
    .toFile(tamperedPath);
  console.log("✅ test-tampered.jpg — Tampered image (spliced rectangle) for ELA forensics");

  // Clean up temp
  fs.unlinkSync(tempPath);

  // 3. Check if there's already a face image
  const uploadsDir = path.join(__dirname, "uploads");
  const faceImages = fs.readdirSync(uploadsDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f) && f !== '.gitkeep');
  if (faceImages.length > 0) {
    console.log(`✅ Face image already exists: uploads/${faceImages[0]} — Use for AI Face Scanner`);
  } else {
    console.log("⚠️  No face image found. Take a selfie with your phone and place it in uploads/");
  }

  console.log("\n📂 Test images saved to:", outDir);
  console.log("\n🧪 How to test each tool:");
  console.log("   📍 Metadata Scanner: Take a PHONE PHOTO (has GPS) — email it to yourself, DON'T use WhatsApp (strips metadata)");
  console.log("   💧 Watermark: Use test-original.png → embed → download → re-upload to extract");
  console.log("   🔬 Forensics: Use test-tampered.jpg → should detect the spliced rectangle");
  console.log("   🤖 Face Scanner: Use any face photo from uploads/");
}

generate().catch(console.error);
