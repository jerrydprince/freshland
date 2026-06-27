/**
 * Optimizes a base64 image string client-side using the HTML5 Canvas API.
 * Resizes the image to fit within maxWidth and maxHeight (preserving aspect ratio)
 * and compresses it using JPEG format with the specified quality.
 * 
 * @param {string} base64Str - The original base64 image data URL.
 * @param {number} maxWidth - The maximum width allowed (default 800).
 * @param {number} maxHeight - The maximum height allowed (default 800).
 * @param {number} quality - The compression quality between 0.0 and 1.0 (default 0.7).
 * @returns {Promise<string>} A promise that resolves to the optimized base64 JPEG string.
 */
export const optimizeImage = (base64Str, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
  return new Promise((resolve) => {
    // If the input is not a valid base64 image data URL or is already short, skip processing
    if (!base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }

    // Skip optimization if it is already small (e.g., under 80KB)
    if (base64Str.length < 110000) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Adjust dimensions if exceeding the maximum boundaries
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      // Create a canvas to draw the resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      // Draw the image onto the canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Export as a compressed JPEG
      const optimizedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(optimizedBase64);
    };

    img.onerror = () => {
      // Return original on error
      resolve(base64Str);
    };
  });
};
