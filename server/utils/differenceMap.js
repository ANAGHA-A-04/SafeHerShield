/**
 * ====================================
 * DIFFERENCE MAP GENERATOR
 * ====================================
 * 
 * Creates a visual heatmap showing where perturbation was applied.
 * The output image highlights pixel differences in color:
 * - Black = no change
 * - Blue/Green = small change  
 * - Yellow/Red = larger change
 * 
 * This is key for the demo — shows the "invisible shield" visually.
 */

/**
 * Generate a color-coded difference heatmap between two images
 * 
 * @param {Buffer} original - Original image raw pixels
 * @param {Buffer} perturbed - Protected image raw pixels
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} channels - Number of channels
 * @returns {Buffer} RGB difference heatmap
 */
function generateDifferenceMap(original, perturbed, width, height, channels) {
  // Output is always RGB (3 channels)
  const output = new Uint8Array(width * height * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * channels;
      const outIdx = (y * width + x) * 3;

      // Calculate absolute difference across all color channels
      let diff = 0;
      for (let c = 0; c < Math.min(channels, 3); c++) {
        diff += Math.abs(original[srcIdx + c] - perturbed[srcIdx + c]);
      }
      diff = diff / 3; // Average difference

      // Amplify for visibility (multiply by 10)
      const amplified = Math.min(255, diff * 10);

      // Map to heatmap colors
      const color = heatmapColor(amplified / 255);
      output[outIdx]     = color.r;
      output[outIdx + 1] = color.g;
      output[outIdx + 2] = color.b;
    }
  }

  return Buffer.from(output);
}

/**
 * Convert a 0-1 value to a heatmap color (black → blue → green → yellow → red)
 */
function heatmapColor(value) {
  const v = Math.max(0, Math.min(1, value));

  if (v < 0.25) {
    // Black to Blue
    const t = v / 0.25;
    return { r: 0, g: 0, b: Math.round(t * 255) };
  } else if (v < 0.5) {
    // Blue to Green
    const t = (v - 0.25) / 0.25;
    return { r: 0, g: Math.round(t * 255), b: Math.round((1 - t) * 255) };
  } else if (v < 0.75) {
    // Green to Yellow
    const t = (v - 0.5) / 0.25;
    return { r: Math.round(t * 255), g: 255, b: 0 };
  } else {
    // Yellow to Red
    const t = (v - 0.75) / 0.25;
    return { r: 255, g: Math.round((1 - t) * 255), b: 0 };
  }
}

module.exports = { generateDifferenceMap };
