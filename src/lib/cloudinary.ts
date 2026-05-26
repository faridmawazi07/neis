// Cloudinary utility using signed REST API
// No external SDK - compatible with Turbopack
// Uses Web Crypto API for signing (available in Node.js 18+)
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const NEIS_ENV_FILE = join(process.cwd(), '.neis.env');

function getNeisEnvValue(key: string): string {
  try {
    if (existsSync(NEIS_ENV_FILE)) {
      const content = readFileSync(NEIS_ENV_FILE, 'utf-8');
      const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
      if (match) return match[1].trim();
    }
  } catch {}
  return '';
}

function getCloudName(): string {
  return process.env.CLOUDINARY_CLOUD_NAME || getNeisEnvValue('CLOUDINARY_CLOUD_NAME') || '';
}
function getApiKey(): string {
  return process.env.CLOUDINARY_API_KEY || getNeisEnvValue('CLOUDINARY_API_KEY') || '';
}
function getApiSecret(): string {
  return process.env.CLOUDINARY_API_SECRET || getNeisEnvValue('CLOUDINARY_API_SECRET') || '';
}

/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured(): boolean {
  return !!(getCloudName() && getApiKey() && getApiSecret());
}

/**
 * Generate SHA1 signature using Web Crypto API
 */
async function sha1(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Upload image to Cloudinary using signed REST API
 */
export async function uploadToCloudinary(
  dataUrl: string,
  folder: string = 'neis',
  publicId?: string
): Promise<string> {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary belum dikonfigurasi');
  }

  const cloudName = getCloudName();
  const apiKey = getApiKey();
  const apiSecret = getApiSecret();
  const timestamp = Math.floor(Date.now() / 1000);

  // Build signature string
  let sigParams = `folder=${folder}&timestamp=${timestamp}`;
  if (publicId) sigParams += `&public_id=${publicId}`;
  sigParams += apiSecret;

  const signature = await sha1(sigParams);

  // Build form data
  const formData = new FormData();
  formData.append('file', dataUrl);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('folder', folder);
  formData.append('signature', signature);
  if (publicId) {
    formData.append('public_id', publicId);
  }

  // Upload via REST API
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Upload gagal: ${response.status}`);
  }

  const result = await response.json();
  return result.secure_url as string;
}

/**
 * Delete image from Cloudinary by URL
 */
export async function deleteFromCloudinary(imageUrl: string): Promise<void> {
  if (!isCloudinaryConfigured()) return;
  if (!imageUrl.includes('cloudinary.com')) return;

  try {
    const cloudName = getCloudName();
    const apiKey = getApiKey();
    const apiSecret = getApiSecret();

    const urlParts = imageUrl.split('/upload/');
    if (urlParts.length < 2) return;

    const pathPart = urlParts[1];
    const withoutVersion = pathPart.replace(/^v\d+\//, '');
    const publicId = withoutVersion.replace(/\.[^.]+$/, '');

    const timestamp = Math.floor(Date.now() / 1000);
    const sigParams = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = await sha1(sigParams);

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);

    await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: 'POST', body: formData }
    );
  } catch (e) {
    console.error('Failed to delete from Cloudinary:', e);
  }
}

/**
 * Upload image to Cloudinary with fallback to base64 data URL
 * Validates max size before upload
 */
export async function uploadImage(
  dataUrl: string,
  folder: string = 'neis',
  publicId?: string
): Promise<string> {
  if (!dataUrl) return dataUrl;

  // Already a Cloudinary URL
  if (dataUrl.includes('cloudinary.com')) return dataUrl;

  // Not a data URL
  if (!dataUrl.startsWith('data:')) return dataUrl;

  // Validate size - base64 is ~33% larger than actual file
  const base64Length = dataUrl.length - dataUrl.indexOf(',') - 1;
  const estimatedSizeBytes = Math.ceil(base64Length * 3 / 4);
  const maxBytes = 5 * 1024 * 1024; // 5MB
  if (estimatedSizeBytes > maxBytes) {
    throw new Error(`Ukuran foto terlalu besar (${(estimatedSizeBytes / 1024 / 1024).toFixed(1)}MB). Maksimal 5MB.`);
  }

  // Try Cloudinary upload
  if (isCloudinaryConfigured()) {
    try {
      return await uploadToCloudinary(dataUrl, folder, publicId);
    } catch (e) {
      console.error('Cloudinary upload failed, falling back to base64:', e);
      return dataUrl;
    }
  }

  return dataUrl;
}
