/**
 * ====================================
 * ADVERSARIAL PERTURBATION ENGINE v3
 * ====================================
 * 
 * Model-guided perturbation: uses the ACTUAL face bounding box
 * detected by the ML model to apply extremely targeted noise.
 * 
 * Strategy:
 *   - Inside face bbox: HEAVY multi-technique attack (epsilon × 3-4)
 *   - Outside face bbox: Minimal noise (epsilon × 0.1)
 *   - Result: Face detection is disrupted, but image looks the same to humans
 *     because most pixels (background) are barely changed.
 */

/**
 * Apply adversarial perturbation to an image buffer.
 * @param {Buffer} imageBuffer - Raw pixel data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} channels - 3 (RGB) or 4 (RGBA)
 * @param {number} epsilon - Base perturbation strength (default 8)
 * @param {Array} faceBoxes - Array of {x, y, width, height} from ML detection
 * @returns {Buffer} Perturbed image buffer
 */
function applyAdversarialPerturbation(imageBuffer, width, height, channels, epsilon = 8, faceBoxes = []) {
  const pixels = new Uint8Array(imageBuffer);
  const output = new Uint8Array(pixels.length);
  output.set(pixels);

  // Build a face mask: for each pixel, how strongly it should be attacked
  const faceMask = buildFaceMask(width, height, faceBoxes);

  // ---- Layer 1: Multi-Frequency CNN Attack ----
  applyMultiFreqAttack(output, pixels, width, height, channels, epsilon, faceMask);

  // ---- Layer 2: Edge Destruction ----
  applyEdgeDestruction(output, pixels, width, height, channels, epsilon, faceMask);

  // ---- Layer 3: Color Channel Rotation ----
  applyColorRotation(output, width, height, channels, epsilon, faceMask);

  // ---- Layer 4: Spatial Pixel Shuffling ----
  applySpatialShuffle(output, width, height, channels, faceMask);

  // ---- Layer 5: Anti-Pooling Micro Pattern ----
  applyAntiPooling(output, width, height, channels, epsilon, faceMask);

  return Buffer.from(output);
}

/**
 * Build a weight mask: 1.0 inside face boxes (with soft edges), ~0.05 outside.
 * Face box is expanded by 30% to cover hair/forehead too.
 */
function buildFaceMask(width, height, faceBoxes) {
  const mask = new Float32Array(width * height);
  mask.fill(0.05); // Very light background noise

  if (faceBoxes.length === 0) {
    // No faces detected — use center-weighted fallback (portrait assumption)
    const cx = width / 2, cy = height * 0.38;
    const rx = width * 0.35, ry = height * 0.4;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        mask[y * width + x] = Math.max(0.05, Math.exp(-dx * dx - dy * dy));
      }
    }
    return mask;
  }

  for (const box of faceBoxes) {
    // Expand the box by 30% in each direction
    const expand = 0.3;
    const bx = Math.max(0, Math.round(box.x - box.width * expand));
    const by = Math.max(0, Math.round(box.y - box.height * expand));
    const bw = Math.min(width - bx, Math.round(box.width * (1 + expand * 2)));
    const bh = Math.min(height - by, Math.round(box.height * (1 + expand * 2)));

    const cx = bx + bw / 2, cy = by + bh / 2;
    const rx = bw / 2, ry = bh / 2;

    for (let y = by; y < by + bh && y < height; y++) {
      for (let x = bx; x < bx + bw && x < width; x++) {
        // Soft elliptical falloff from center of face box
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        const w = d < 0.5 ? 1.0 : Math.exp(-(d - 0.5) * 2);
        mask[y * width + x] = Math.max(mask[y * width + x], w);
      }
    }
  }

  return mask;
}

/**
 * Layer 1: Multi-frequency sinusoidal attack
 * Uses 6 overlapping waves at CNN-resonant frequencies.
 * Strength modulated by face mask (3× stronger in face).
 */
function applyMultiFreqAttack(output, original, width, height, channels, epsilon, mask) {
  const str = epsilon * 0.35; // Strong in face, ×0.05 = invisible outside

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = mask[y * width + x];
      if (w < 0.02) continue;

      const idx = (y * width + x) * channels;
      const r = original[idx], g = original[idx + 1], b = original[idx + 2];

      // 6 frequencies targeting different CNN kernel sizes
      const n1 = Math.sin(x * 0.4 + y * 0.3 + r * 0.02) * str;
      const n2 = Math.cos(x * 1.1 - y * 0.9 + g * 0.015) * str * 0.85;
      const n3 = Math.sin(x * 2.3 + y * 1.7) * str * 0.7;
      const n4 = Math.cos(x * 3.1 - y * 2.5 + b * 0.01) * str * 0.55;
      const n5 = Math.sin(x * 4.7 + y * 3.3) * str * 0.4;
      const n6 = Math.cos((x * y * 0.005) + x * 5.0) * str * 0.3;

      // Each channel gets a different noise combination
      output[idx]     = clamp(output[idx]     + Math.round((n1 + n3 + n5) * w));
      output[idx + 1] = clamp(output[idx + 1] + Math.round((n2 + n4 + n6) * w));
      output[idx + 2] = clamp(output[idx + 2] + Math.round((n3 - n2 + n5) * w));
    }
  }
}

/**
 * Layer 2: Edge destruction
 * Finds edges via Sobel and corrupts them — face models rely heavily on edges.
 */
function applyEdgeDestruction(output, original, width, height, channels, epsilon, mask) {
  const str = epsilon * 0.25;

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const w = mask[y * width + x];
      if (w < 0.1) continue;

      const idx = (y * width + x) * channels;
      for (let c = 0; c < Math.min(channels, 3); c++) {
        const gx =
          -original[((y-1)*width + x-1)*channels + c] + original[((y-1)*width + x+1)*channels + c]
          -2*original[(y*width + x-1)*channels + c]   + 2*original[(y*width + x+1)*channels + c]
          -original[((y+1)*width + x-1)*channels + c] + original[((y+1)*width + x+1)*channels + c];
        const gy =
          -original[((y-1)*width + x-1)*channels + c] - 2*original[((y-1)*width + x)*channels + c] - original[((y-1)*width + x+1)*channels + c]
          +original[((y+1)*width + x-1)*channels + c] + 2*original[((y+1)*width + x)*channels + c] + original[((y+1)*width + x+1)*channels + c];

        const edgeMag = Math.sqrt(gx * gx + gy * gy) / 255;
        const edgeBoost = 1 + edgeMag * 2;
        const noise = Math.sign(gx + gy + 0.001) * str * edgeBoost * w;

        output[idx + c] = clamp(output[idx + c] + Math.round(noise));
      }
    }
  }
}

/**
 * Layer 3: Color channel rotation
 * Mixes R→G, G→B, B→R slightly — disrupts skin-color-based feature extraction.
 */
function applyColorRotation(output, width, height, channels, epsilon, mask) {
  const str = epsilon * 0.2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = mask[y * width + x];
      if (w < 0.15) continue;

      const idx = (y * width + x) * channels;
      const r = output[idx], g = output[idx + 1], b = output[idx + 2];

      const shift = Math.round(str * w);
      const pattern = Math.sin(x * 1.5 + y * 1.1);

      if (pattern > 0) {
        output[idx]     = clamp(r + shift);
        output[idx + 1] = clamp(g - shift);
        output[idx + 2] = clamp(b + Math.round(shift * 0.6));
      } else {
        output[idx]     = clamp(r - Math.round(shift * 0.7));
        output[idx + 1] = clamp(g + shift);
        output[idx + 2] = clamp(b - shift);
      }
    }
  }
}

/**
 * Layer 4: Spatial pixel shuffling
 * Swaps each pixel with a neighbor within the face region.
 * Destroys spatial features while preserving overall appearance.
 */
function applySpatialShuffle(output, width, height, channels, mask) {
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const w = mask[y * width + x];
      if (w < 0.5) continue; // Only inside face region

      // Deterministic "shuffle" — swap with neighbor based on position
      const swapDir = (x * 7 + y * 13) % 4;
      const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const [ox, oy] = offsets[swapDir];

      const idx1 = (y * width + x) * channels;
      const idx2 = ((y + oy) * width + (x + ox)) * channels;

      // Partial swap — blend 8% with neighbor
      for (let c = 0; c < Math.min(channels, 3); c++) {
        const v1 = output[idx1 + c];
        const v2 = output[idx2 + c];
        output[idx1 + c] = clamp(Math.round(v1 * 0.92 + v2 * 0.08));
      }
    }
  }
}

/**
 * Layer 5: Anti-pooling micro-pattern
 * 2×2 alternating blocks that confuse CNN pooling layers.
 */
function applyAntiPooling(output, width, height, channels, epsilon, mask) {
  const str = epsilon * 0.15;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = mask[y * width + x];
      if (w < 0.03) continue;

      const idx = (y * width + x) * channels;
      const block = ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0) ? 1 : -1;
      const noise = Math.round(block * str * w);

      output[idx]     = clamp(output[idx] + noise);
      output[idx + 1] = clamp(output[idx + 1] - noise);
      output[idx + 2] = clamp(output[idx + 2] + Math.round(noise * 0.7));
    }
  }
}

/**
 * Clamp to valid pixel range [0, 255]
 */
function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

module.exports = { applyAdversarialPerturbation };
