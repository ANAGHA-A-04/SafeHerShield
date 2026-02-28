/**
 * ====================================
 * ADVERSARIAL PERTURBATION ENGINE v4
 * ====================================
 * 
 * AGGRESSIVE model-guided perturbation that ACTUALLY disrupts
 * face detection neural networks.
 * 
 * Changes from v3:
 *   - 2-3x higher layer multipliers
 *   - Expanded face mask (50% padding, harder edges)
 *   - New Layer 6: Landmark-targeted high-frequency attack
 *   - Multi-pass application for high strength
 *   - Mixed checkerboard pooling disruption
 */

/**
 * Apply adversarial perturbation to an image buffer.
 * @param {Buffer} imageBuffer - Raw pixel data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} channels - 3 (RGB) or 4 (RGBA)
 * @param {number} epsilon - Base perturbation strength
 * @param {Array} faceBoxes - Array of {x, y, width, height} from ML detection
 * @returns {Buffer} Perturbed image buffer
 */
function applyAdversarialPerturbation(imageBuffer, width, height, channels, epsilon = 20, faceBoxes = []) {
  const pixels = new Uint8Array(imageBuffer);
  const output = new Uint8Array(pixels.length);
  output.set(pixels);

  // Build a face mask: for each pixel, how strongly it should be attacked
  const faceMask = buildFaceMask(width, height, faceBoxes);

  // Determine number of passes based on epsilon
  // High strength (>=28) gets 2 passes for compounding disruption
  const passes = epsilon >= 28 ? 2 : 1;

  for (let pass = 0; pass < passes; pass++) {
    const passPixels = pass === 0 ? pixels : new Uint8Array(output);
    const passEpsilon = pass === 0 ? epsilon : epsilon * 0.6;

    // ---- Layer 1: Multi-Frequency CNN Attack ----
    applyMultiFreqAttack(output, passPixels, width, height, channels, passEpsilon, faceMask, pass);

    // ---- Layer 2: Edge Destruction ----
    applyEdgeDestruction(output, passPixels, width, height, channels, passEpsilon, faceMask);

    // ---- Layer 3: Color Channel Rotation ----
    applyColorRotation(output, width, height, channels, passEpsilon, faceMask);

    // ---- Layer 4: Spatial Pixel Shuffling ----
    applySpatialShuffle(output, width, height, channels, faceMask);

    // ---- Layer 5: Anti-Pooling Micro Pattern ----
    applyAntiPooling(output, width, height, channels, passEpsilon, faceMask);

    // ---- Layer 6: Landmark-Targeted High-Frequency Attack ----
    applyLandmarkAttack(output, passPixels, width, height, channels, passEpsilon, faceMask, faceBoxes);
  }

  return Buffer.from(output);
}

/**
 * Build a weight mask: 1.0 inside face boxes, ~0.02 outside.
 * Face box is expanded by 50% to cover hair/forehead/neck.
 * Harder edges — less gradual falloff so the attack stays strong at face boundaries.
 */
function buildFaceMask(width, height, faceBoxes) {
  const mask = new Float32Array(width * height);
  mask.fill(0.02); // Near-zero background noise

  if (faceBoxes.length === 0) {
    // No faces detected — use center-weighted fallback
    const cx = width / 2, cy = height * 0.38;
    const rx = width * 0.4, ry = height * 0.45;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        mask[y * width + x] = Math.max(0.02, d < 1 ? 1.0 : Math.exp(-(d - 1) * 3));
      }
    }
    return mask;
  }

  for (const box of faceBoxes) {
    // Expand the box by 50% in each direction
    const expand = 0.5;
    const bx = Math.max(0, Math.round(box.x - box.width * expand));
    const by = Math.max(0, Math.round(box.y - box.height * expand));
    const bw = Math.min(width - bx, Math.round(box.width * (1 + expand * 2)));
    const bh = Math.min(height - by, Math.round(box.height * (1 + expand * 2)));

    const cx = bx + bw / 2, cy = by + bh / 2;
    const rx = bw / 2, ry = bh / 2;

    for (let y = by; y < by + bh && y < height; y++) {
      for (let x = bx; x < bx + bw && x < width; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        // Full strength up to 70% of ellipse radius, then sharp drop
        const w = d < 0.7 ? 1.0 : Math.exp(-(d - 0.7) * 4);
        mask[y * width + x] = Math.max(mask[y * width + x], w);
      }
    }
  }

  return mask;
}

/**
 * Layer 1: Multi-frequency sinusoidal attack (BOOSTED)
 * 8 overlapping waves at CNN-resonant frequencies.
 * Phase shifts between passes to avoid cancellation.
 */
function applyMultiFreqAttack(output, original, width, height, channels, epsilon, mask, pass = 0) {
  const str = epsilon * 0.42;
  const ps = pass * 1.7; // phase shift per pass

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = mask[y * width + x];
      if (w < 0.01) continue;

      const idx = (y * width + x) * channels;
      const r = original[idx], g = original[idx + 1], b = original[idx + 2];

      const n1 = Math.sin(x * 0.4 + y * 0.3 + r * 0.02 + ps) * str;
      const n2 = Math.cos(x * 1.1 - y * 0.9 + g * 0.015 + ps) * str * 0.85;
      const n3 = Math.sin(x * 2.3 + y * 1.7 + ps * 0.5) * str * 0.75;
      const n4 = Math.cos(x * 3.1 - y * 2.5 + b * 0.01) * str * 0.6;
      const n5 = Math.sin(x * 4.7 + y * 3.3 + ps) * str * 0.5;
      const n6 = Math.cos((x * y * 0.005) + x * 5.0) * str * 0.4;
      const n7 = Math.sin(x * 6.3 - y * 5.1 + r * 0.008) * str * 0.35;
      const n8 = Math.cos(x * 8.1 + y * 7.7) * str * 0.25;

      output[idx]     = clamp(output[idx]     + Math.round((n1 + n3 + n5 + n7) * w));
      output[idx + 1] = clamp(output[idx + 1] + Math.round((n2 + n4 + n6 + n8) * w));
      output[idx + 2] = clamp(output[idx + 2] + Math.round((n3 - n2 + n5 - n7) * w));
    }
  }
}

/**
 * Layer 2: Edge destruction (BOOSTED)
 * Sobel edge detection + aggressive corruption.
 */
function applyEdgeDestruction(output, original, width, height, channels, epsilon, mask) {
  const str = epsilon * 0.32;

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const w = mask[y * width + x];
      if (w < 0.05) continue;

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
        const edgeBoost = 1 + edgeMag * 3;
        const noise = Math.sign(gx + gy + 0.001) * str * edgeBoost * w;

        output[idx + c] = clamp(output[idx + c] + Math.round(noise));
      }
    }
  }
}

/**
 * Layer 3: Color channel rotation (BOOSTED)
 */
function applyColorRotation(output, width, height, channels, epsilon, mask) {
  const str = epsilon * 0.25;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = mask[y * width + x];
      if (w < 0.1) continue;

      const idx = (y * width + x) * channels;
      const r = output[idx], g = output[idx + 1], b = output[idx + 2];

      const shift = Math.round(str * w);
      const pattern = Math.sin(x * 1.5 + y * 1.1);

      if (pattern > 0) {
        output[idx]     = clamp(r + shift);
        output[idx + 1] = clamp(g - shift);
        output[idx + 2] = clamp(b + Math.round(shift * 0.8));
      } else {
        output[idx]     = clamp(r - Math.round(shift * 0.9));
        output[idx + 1] = clamp(g + shift);
        output[idx + 2] = clamp(b - shift);
      }
    }
  }
}

/**
 * Layer 4: Spatial pixel shuffling (BOOSTED — 20% blend)
 */
function applySpatialShuffle(output, width, height, channels, mask) {
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const w = mask[y * width + x];
      if (w < 0.3) continue;

      const swapDir = (x * 7 + y * 13) % 4;
      const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const [ox, oy] = offsets[swapDir];

      const idx1 = (y * width + x) * channels;
      const idx2 = ((y + oy) * width + (x + ox)) * channels;

      const blendStr = 0.20 * w;
      for (let c = 0; c < Math.min(channels, 3); c++) {
        const v1 = output[idx1 + c];
        const v2 = output[idx2 + c];
        output[idx1 + c] = clamp(Math.round(v1 * (1 - blendStr) + v2 * blendStr));
      }
    }
  }
}

/**
 * Layer 5: Anti-pooling micro-pattern (BOOSTED — mixed 2x2 + 3x3)
 */
function applyAntiPooling(output, width, height, channels, epsilon, mask) {
  const str = epsilon * 0.22;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = mask[y * width + x];
      if (w < 0.02) continue;

      const idx = (y * width + x) * channels;
      const block2 = ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0) ? 1 : -1;
      const block3 = ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0) ? 1 : -1;
      const block = block2 * 0.7 + block3 * 0.3;
      const noise = Math.round(block * str * w);

      output[idx]     = clamp(output[idx] + noise);
      output[idx + 1] = clamp(output[idx + 1] - noise);
      output[idx + 2] = clamp(output[idx + 2] + Math.round(noise * 0.8));
    }
  }
}

/**
 * Layer 6: Landmark-Targeted Attack (NEW)
 * Targets approximate eye / nose / mouth regions with extra
 * high-frequency noise — these are the exact features face
 * recognition networks rely on most.
 */
function applyLandmarkAttack(output, original, width, height, channels, epsilon, mask, faceBoxes) {
  const str = epsilon * 0.38;

  // Landmark zones relative to face bounding box (standard face geometry)
  const landmarkZones = [
    { name: "leftEye",  rx: 0.30, ry: 0.32, rw: 0.22, rh: 0.12 },
    { name: "rightEye", rx: 0.58, ry: 0.32, rw: 0.22, rh: 0.12 },
    { name: "nose",     rx: 0.38, ry: 0.45, rw: 0.24, rh: 0.20 },
    { name: "mouth",    rx: 0.30, ry: 0.68, rw: 0.40, rh: 0.16 },
    { name: "bridge",   rx: 0.42, ry: 0.30, rw: 0.16, rh: 0.25 },
  ];

  const boxes = faceBoxes.length > 0 ? faceBoxes : [{
    x: width * 0.25, y: height * 0.15,
    width: width * 0.5, height: height * 0.7
  }];

  for (const box of boxes) {
    for (const zone of landmarkZones) {
      const zx = Math.round(box.x + box.width * zone.rx);
      const zy = Math.round(box.y + box.height * zone.ry);
      const zw = Math.round(box.width * zone.rw);
      const zh = Math.round(box.height * zone.rh);

      for (let y = Math.max(0, zy); y < Math.min(height, zy + zh); y++) {
        for (let x = Math.max(0, zx); x < Math.min(width, zx + zw); x++) {
          const idx = (y * width + x) * channels;
          const w = mask[y * width + x];
          if (w < 0.1) continue;

          const r = original[idx], g = original[idx + 1], b = original[idx + 2];

          // High-frequency noise — eyes get tighter patterns
          const freq = (zone.name === "leftEye" || zone.name === "rightEye") ? 6.5 : 4.2;
          const n1 = Math.sin(x * freq + y * (freq * 0.8) + r * 0.03) * str * w;
          const n2 = Math.cos(x * (freq * 1.3) - y * freq + g * 0.025) * str * w * 0.85;
          const n3 = Math.sin((x + y) * freq * 0.7 + b * 0.02) * str * w * 0.7;

          // Alternating sign creates maximum local contrast disruption
          const sign = ((x + y) % 2 === 0) ? 1 : -1;
          output[idx]     = clamp(output[idx]     + Math.round(n1 * sign));
          output[idx + 1] = clamp(output[idx + 1] + Math.round(n2 * -sign));
          output[idx + 2] = clamp(output[idx + 2] + Math.round(n3 * sign));
        }
      }
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
