/**
 * ====================================
 * SSIM (Structural Similarity Index)
 * ====================================
 * 
 * Measures how similar two images look to the human eye.
 * Score range: 0 to 1 (1 = identical, >0.95 = indistinguishable)
 * 
 * This proves our protection is invisible to humans.
 */

/**
 * Calculate SSIM between original and perturbed image
 * Uses a simplified but accurate SSIM implementation
 * 
 * @param {Buffer} img1 - Original image raw pixels
 * @param {Buffer} img2 - Protected image raw pixels
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} channels - Number of channels
 * @returns {number} SSIM score (0-1)
 */
function calculateSSIM(img1, img2, width, height, channels) {
  const windowSize = 8;
  const C1 = (0.01 * 255) ** 2; // Stabilization constant
  const C2 = (0.03 * 255) ** 2;

  let ssimSum = 0;
  let windowCount = 0;

  // Slide window across image
  for (let y = 0; y <= height - windowSize; y += windowSize) {
    for (let x = 0; x <= width - windowSize; x += windowSize) {
      // Calculate mean, variance, covariance for this window
      let sum1 = 0, sum2 = 0;
      let sq1 = 0, sq2 = 0, cross = 0;
      let count = 0;

      for (let wy = 0; wy < windowSize; wy++) {
        for (let wx = 0; wx < windowSize; wx++) {
          const idx = ((y + wy) * width + (x + wx)) * channels;
          
          // Use luminance (weighted average of RGB)
          const lum1 = 0.299 * img1[idx] + 0.587 * img1[idx + 1] + 0.114 * img1[idx + 2];
          const lum2 = 0.299 * img2[idx] + 0.587 * img2[idx + 1] + 0.114 * img2[idx + 2];

          sum1 += lum1;
          sum2 += lum2;
          sq1 += lum1 * lum1;
          sq2 += lum2 * lum2;
          cross += lum1 * lum2;
          count++;
        }
      }

      const mean1 = sum1 / count;
      const mean2 = sum2 / count;
      const var1 = sq1 / count - mean1 * mean1;
      const var2 = sq2 / count - mean2 * mean2;
      const covar = cross / count - mean1 * mean2;

      // SSIM formula
      const numerator = (2 * mean1 * mean2 + C1) * (2 * covar + C2);
      const denominator = (mean1 * mean1 + mean2 * mean2 + C1) * (var1 + var2 + C2);
      
      ssimSum += numerator / denominator;
      windowCount++;
    }
  }

  return windowCount > 0 ? ssimSum / windowCount : 1;
}

module.exports = { calculateSSIM };
