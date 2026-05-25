import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Load config from .neis.env file (survives sandbox reset)
function loadCloudinaryConfig() {
  try {
    const envPath = '/home/z/my-project/.neis.env';
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^CLOUDINARY_(\w+)=(.*)$/);
        if (match) {
          const [, key, value] = match;
          if (!process.env[`CLOUDINARY_${key}`]) {
            process.env[`CLOUDINARY_${key}`] = value.trim();
          }
        }
      }
    }
  } catch (e) {
    // Ignore errors, will fail gracefully
  }
}

loadCloudinaryConfig();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;

/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Upload image to Cloudinary
 * @param dataUrl - Base64 data URL (data:image/...;base64,...)
 * @param folder - Cloudinary folder (e.g., 'neis/profile' or 'neis/kehadiran')
 * @param publicId - Optional custom public ID
 * @returns Cloudinary secure URL
 */
export async function uploadToCloudinary(
  dataUrl: string,
  folder: string = 'neis',
  publicId?: string
): Promise<string> {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary belum dikonfigurasi. Tambahkan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET di .neis.env');
  }

  const result = await cloudinary.uploader.upload(dataUrl, {
    folder,
    public_id: publicId,
    transformation: [
      { quality: 'auto:good' },
      { fetch_format: 'auto' },
    ],
    overwrite: true,
    resource_type: 'image',
  });

  return result.secure_url;
}

/**
 * Delete image from Cloudinary by URL
 * @param imageUrl - Cloudinary URL to delete
 */
export async function deleteFromCloudinary(imageUrl: string): Promise<void> {
  if (!isCloudinaryConfigured()) return;
  if (!imageUrl.includes('cloudinary.com')) return; // Not a Cloudinary URL

  try {
    // Extract public_id from URL
    // URL format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{folder}/{public_id}.{ext}
    const urlParts = imageUrl.split('/upload/');
    if (urlParts.length < 2) return;

    const pathPart = urlParts[1];
    // Remove version prefix (v1234567890/)
    const withoutVersion = pathPart.replace(/^v\d+\//, '');
    // Remove file extension
    const publicId = withoutVersion.replace(/\.[^.]+$/, '');

    await cloudinary.uploader.destroy(publicId);
  } catch (e) {
    console.error('Failed to delete from Cloudinary:', e);
  }
}

/**
 * Upload image to Cloudinary with fallback to base64 data URL
 * If Cloudinary is not configured, returns the original data URL
 */
export async function uploadImage(
  dataUrl: string,
  folder: string = 'neis',
  publicId?: string
): Promise<string> {
  if (!dataUrl) return dataUrl;

  // Already a Cloudinary URL - no need to re-upload
  if (dataUrl.includes('cloudinary.com')) return dataUrl;

  // Not a data URL - return as is
  if (!dataUrl.startsWith('data:')) return dataUrl;

  // Try Cloudinary upload
  if (isCloudinaryConfigured()) {
    try {
      return await uploadToCloudinary(dataUrl, folder, publicId);
    } catch (e) {
      console.error('Cloudinary upload failed, falling back to base64:', e);
      return dataUrl; // Fallback to base64
    }
  }

  // Cloudinary not configured - keep as base64
  return dataUrl;
}
