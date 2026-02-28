/**
 * Generate a properly tampered image that ELA will detect.
 * 
 * Strategy: Take the face image, crop a region, 
 * heavily compress it (quality 30), then paste it back 
 * into the high-quality original. This compression 
 * mismatch is exactly what ELA detects.
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const outDir = path.join(__dirname, "test-images");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

async function generate() {
  // Use the existing face image as base
  const srcPath = path.join(__dirname, "uploads", "10ecb9d6-f1cc-450c-ade2-b27ac8a7cb1c.png");
  
  if (!fs.existsSync(srcPath)) {
    console.log("No source image found. Place a face image in uploads/");
    return;
  }

  const meta = await sharp(srcPath).metadata();
  console.log(`Source: ${meta.width}x${meta.height}`);

  // Step 1: Extract a rectangular region
  const region = { left: 200, top: 200, width: 400, height: 400 };
  const regionBuf = await sharp(srcPath)
    .extract(region)
    .jpeg({ quality: 25 }) // HEAVY compression — creates visible artifacts
    .toBuffer();

  // Step 2: Re-decode the heavily compressed region
  const regionDecoded = await sharp(regionBuf).png().toBuffer();

  // Step 3: Composite the compressed region back onto the original
  const tamperedPath = path.join(outDir, "test-tampered-face.png");
  await sharp(srcPath)
    .composite([{
      input: regionDecoded,
      left: region.left,
      top: region.top
    }])
    .png()
    .toFile(tamperedPath);

  console.log("✅ test-tampered-face.png created!");
  console.log("   The region (200,200)-(600,600) was heavily compressed and pasted back");
  console.log("   ELA should highlight this region in the heatmap");

  // Also create a double-compressed JPEG version (common manipulation pattern)
  const jpegPath = path.join(outDir, "test-tampered-double.jpg");
  
  // First: save as low quality JPEG
  const step1 = await sharp(srcPath).jpeg({ quality: 40 }).toBuffer();
  // Then: re-save at high quality — the double compression creates detectable artifacts
  await sharp(step1).jpeg({ quality: 95 }).toFile(jpegPath);
  
  console.log("✅ test-tampered-double.jpg created!");
  console.log("   Double-compressed JPEG (40→95) — ELA detects re-compression artifacts");
}

generate().catch(console.error);
