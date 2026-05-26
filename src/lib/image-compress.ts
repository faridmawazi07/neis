/**
 * Image compression utility for frontend
 * Resizes and compresses images before upload to reduce file size
 * and save Cloudinary quota / DB storage
 */

const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;
const JPEG_QUALITY = 0.7; // 70% quality - good balance for photos
const MAX_FILE_SIZE_MB = 5;

/**
 * Compress a data URL (base64) image by resizing and converting to JPEG
 */
export function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Draw to canvas at new size
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Export as JPEG with compression
      const compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      resolve(compressed);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Compress a File object by reading and resizing
 */
export async function compressFile(file: File): Promise<string> {
  // Check file size
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(`Ukuran file terlalu besar (${sizeMB.toFixed(1)}MB). Maksimal ${MAX_FILE_SIZE_MB}MB.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const dataUrl = reader.result as string;
        const compressed = await compressImage(dataUrl);
        resolve(compressed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
