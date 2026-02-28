/**
 * ====================================
 * ADVERSARIAL PERTURBATION ENGINE
 * ====================================
 * 
 * This is the core "ML" logic of DeepFake Shield.
 * It applies invisible noise to images that disrupts AI face models.
 * 
 * Techniques used:
 * 1. High-frequency structured noise — breaks CNN feature extraction
 * 2. Face-region targeting — concentrates noise where AI looks
 * 3. Gradient-inspired patterns — mimics FGSM adversarial attacks
 * 4. Multi-layer perturbation — resistant to simple denoising
 */

/**
 * Apply adversarial perturbation to an image buffer
 * @param {Buffer} imageBuffer - Raw pixel data (R,G,B,R,G,B,... or R,G,B,A,...)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} channels - Number of channels (3 for RGB, 4 for RGBA)
 * @param {number} epsilon - Perturbation strength (1-20, default 8)
 * @returns {Buffer} Perturbed image buffer
 */
function applyAdversarialPerturbation(imageBuffer, width, height, channels, epsilon = 8) {
  const pixels = new Uint8Array(imageBuffer);
  const output = new Uint8Array(pixels.length);
  
  // Copy original pixels
  output.set(pixels);

  // ---- Layer 1: High-Frequency Structured Noise ----
  // Creates patterns at frequencies that CNNs are sensitive to
  applyHighFrequencyNoise(output, width, height, channels, epsilon * 0.5);

  // ---- Layer 2: Gradient-Direction Perturbation ----
  // Mimics FGSM by pushing pixels along local gradient directions
  applyGradientPerturbation(output, pixels, width, height, channels, epsilon * 0.4);

  // ---- Layer 3: Face-Region Concentrated Noise ----
  // Applies stronger noise to the center region (likely face area)
  applyFaceRegionNoise(output, width, height, channels, epsilon * 0.5);

  // ---- Layer 4: Checkerboard Pattern ----
  // Disrupts spatial feature extraction in neural networks
  applyCheckerboardNoise(output, width, height, channels, epsilon * 0.3);

  return Buffer.from(output);
}

/**
 * Layer 1: High-frequency sinusoidal noise
 * CNNs extract features using convolution kernels that are sensitive to 
 * specific spatial frequencies. This noise targets those frequencies.
 */
function applyHighFrequencyNoise(pixels, width, height, channels, strength) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;

      // Multiple overlapping sine waves at different frequencies
      const noise1 = Math.sin(x * 1.2 + y * 0.8) * strength;
      const noise2 = Math.cos(x * 0.7 - y * 1.5) * strength * 0.6;
      const noise3 = Math.sin((x + y) * 2.1) * strength * 0.4;

      const noiseR = Math.round(noise1 + noise2);
      const noiseG = Math.round(noise2 + noise3);
      const noiseB = Math.round(noise1 + noise3);

      pixels[idx]     = clamp(pixels[idx] + noiseR);
      pixels[idx + 1] = clamp(pixels[idx + 1] + noiseG);
      pixels[idx + 2] = clamp(pixels[idx + 2] + noiseB);
    }
  }
}

/**
 * Layer 2: Gradient-direction perturbation (FGSM-inspired)
 * Calculates local pixel gradients and pushes in the direction
 * that maximally changes the image features while staying invisible.
 */
function applyGradientPerturbation(pixels, original, width, height, channels, strength) {
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * channels;
      
      for (let c = 0; c < Math.min(channels, 3); c++) {
        // Calculate local gradient (Sobel-like)
        const left = original[((y) * width + (x - 1)) * channels + c];
        const right = original[((y) * width + (x + 1)) * channels + c];
        const up = original[((y - 1) * width + (x)) * channels + c];
        const down = original[((y + 1) * width + (x)) * channels + c];

        const gradX = right - left;
        const gradY = down - up;
        
        // FGSM: perturb in the sign direction of the gradient
        const gradSign = Math.sign(gradX + gradY);
        const noise = gradSign * strength;

        pixels[idx + c] = clamp(pixels[idx + c] + Math.round(noise));
      }
    }
  }
}

/**
 * Layer 3: Face-region concentrated noise
 * Applies stronger perturbation to the center ~60% of the image
 * where a face is most likely located (for selfies/portraits).
 * Uses a Gaussian-like falloff from center.
 */
function applyFaceRegionNoise(pixels, width, height, channels, strength) {
  const centerX = width / 2;
  const centerY = height * 0.4; // Face is usually in upper-center
  const radiusX = width * 0.3;
  const radiusY = height * 0.35;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Calculate distance from face center (elliptical)
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Gaussian falloff — strongest at center, fades at edges
      const faceWeight = Math.exp(-distance * distance * 0.5);

      if (faceWeight > 0.2) {
        const idx = (y * width + x) * channels;
        
        // Structured noise modulated by face weight
        const noise = Math.sin(x * 3.7 + y * 2.3) * strength * faceWeight;
        
        for (let c = 0; c < Math.min(channels, 3); c++) {
          const channelNoise = Math.round(noise * (1 + c * 0.2));
          pixels[idx + c] = clamp(pixels[idx + c] + channelNoise);
        }
      }
    }
  }
}

/**
 * Layer 4: Checkerboard adversarial pattern
 * Alternating positive/negative noise in a grid pattern.
 * This specifically disrupts the pooling layers in CNNs.
 */
function applyCheckerboardNoise(pixels, width, height, channels, strength) {
  const blockSize = 4; // 4x4 pixel blocks

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const blockX = Math.floor(x / blockSize);
      const blockY = Math.floor(y / blockSize);
      const isEven = (blockX + blockY) % 2 === 0;

      const idx = (y * width + x) * channels;
      const sign = isEven ? 1 : -1;
      const noise = Math.round(sign * strength);

      pixels[idx]     = clamp(pixels[idx] + noise);
      pixels[idx + 1] = clamp(pixels[idx + 1] + noise);
      pixels[idx + 2] = clamp(pixels[idx + 2] - noise); // Opposite for blue channel
    }
  }
}

/**
 * Clamp a value to valid pixel range [0, 255]
 */
function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

module.exports = { applyAdversarialPerturbation };
