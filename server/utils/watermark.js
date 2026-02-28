/**
 * LSB WATERMARK UTILITY
 * =====================
 * Embed and extract hidden text messages in image pixels
 * using Least Significant Bit (LSB) steganography.
 *
 * Use case: Women can watermark photos before sharing.
 * If the photo leaks, extract the watermark to prove origin/trace the leak.
 */

const sharp = require("sharp");

// Magic header to identify watermarked images
const MAGIC = "WST1"; // Women's Safety Toolkit v1

/**
 * Embed a hidden text message into an image using LSB steganography.
 * Modifies only the least significant bit of each color channel —
 * completely invisible to the human eye.
 *
 * @param {string} inputPath - Path to the original image
 * @param {string} outputPath - Path to save the watermarked image
 * @param {string} message - The secret message to embed
 * @returns {object} - Stats about the embedding
 */
async function embedWatermark(inputPath, outputPath, message) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const { width, height, channels } = metadata;

  // Get raw pixel data (force 3-channel RGB)
  const rawBuffer = await image.ensureAlpha(0).raw().toBuffer();
  const pixels = new Uint8Array(rawBuffer);

  // Build the binary payload: MAGIC + length (4 bytes) + message bytes
  const msgBytes = Buffer.from(message, "utf-8");
  const magicBytes = Buffer.from(MAGIC, "ascii");
  const lengthBytes = Buffer.alloc(4);
  lengthBytes.writeUInt32BE(msgBytes.length, 0);

  const payload = Buffer.concat([magicBytes, lengthBytes, msgBytes]);
  const payloadBits = [];
  for (const byte of payload) {
    for (let bit = 7; bit >= 0; bit--) {
      payloadBits.push((byte >> bit) & 1);
    }
  }

  // Check capacity: we need 1 pixel channel per bit
  // Only use RGB channels (skip alpha), spread across image
  const usableChannels = width * height * 3; // R, G, B only
  if (payloadBits.length > usableChannels) {
    throw new Error(`Message too long. Max ${Math.floor(usableChannels / 8)} bytes for this image.`);
  }

  // Embed bits into LSB of RGB channels
  let bitIndex = 0;
  const ch = channels >= 4 ? 4 : channels; // actual channels per pixel in buffer

  for (let i = 0; i < width * height && bitIndex < payloadBits.length; i++) {
    const pixelOffset = i * ch;
    // Embed into R, G, B (skip A)
    for (let c = 0; c < 3 && bitIndex < payloadBits.length; c++) {
      const val = pixels[pixelOffset + c];
      // Clear LSB and set to our bit
      pixels[pixelOffset + c] = (val & 0xFE) | payloadBits[bitIndex];
      bitIndex++;
    }
  }

  // Save the watermarked image as PNG (lossless — JPEG would destroy LSB!)
  await sharp(Buffer.from(pixels.buffer), {
    raw: { width, height, channels: ch }
  }).png({ compressionLevel: 6 }).toFile(outputPath);

  return {
    success: true,
    messageLength: message.length,
    bitsEmbedded: payloadBits.length,
    imageCapacity: usableChannels,
    capacityUsed: ((payloadBits.length / usableChannels) * 100).toFixed(2) + "%",
    warning: "Save as PNG only — JPEG compression will destroy the watermark!"
  };
}

/**
 * Extract a hidden watermark from an image.
 *
 * @param {string} inputPath - Path to the potentially watermarked image
 * @returns {object} - The extracted message, or failure info
 */
async function extractWatermark(inputPath) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const { width, height, channels } = metadata;

  const rawBuffer = await image.ensureAlpha(0).raw().toBuffer();
  const pixels = new Uint8Array(rawBuffer);
  const ch = channels >= 4 ? 4 : channels;

  // Read bits from LSB of RGB channels
  function readBits(count, startBit = 0) {
    const bits = [];
    let bitIndex = 0;
    let pixelIndex = 0;

    // Skip to startBit
    pixelIndex = Math.floor(startBit / 3);
    let channelOffset = startBit % 3;

    for (let i = pixelIndex; i < width * height && bits.length < count; i++) {
      const pixelOffset = i * ch;
      const startC = (i === pixelIndex) ? channelOffset : 0;
      for (let c = startC; c < 3 && bits.length < count; c++) {
        bits.push(pixels[pixelOffset + c] & 1);
      }
    }
    return bits;
  }

  function bitsToBytes(bits) {
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let b = 0; b < 8 && (i + b) < bits.length; b++) {
        byte = (byte << 1) | bits[i + b];
      }
      bytes.push(byte);
    }
    return Buffer.from(bytes);
  }

  // Step 1: Read magic header (4 bytes = 32 bits)
  const magicBits = readBits(32, 0);
  const magicStr = bitsToBytes(magicBits).toString("ascii");

  if (magicStr !== MAGIC) {
    return {
      found: false,
      message: "No watermark detected in this image.",
      hint: "Image may not be watermarked, or JPEG compression destroyed the data."
    };
  }

  // Step 2: Read message length (4 bytes = 32 bits)
  const lengthBits = readBits(32, 32);
  const lengthBuf = bitsToBytes(lengthBits);
  const msgLength = lengthBuf.readUInt32BE(0);

  // Sanity check
  if (msgLength <= 0 || msgLength > 100000) {
    return { found: false, message: "Watermark header corrupted." };
  }

  // Step 3: Read the message
  const msgBits = readBits(msgLength * 8, 64);
  const msgBuffer = bitsToBytes(msgBits);
  const extractedMessage = msgBuffer.toString("utf-8");

  return {
    found: true,
    message: extractedMessage,
    length: msgLength,
    method: "LSB Steganography"
  };
}

module.exports = { embedWatermark, extractWatermark };
