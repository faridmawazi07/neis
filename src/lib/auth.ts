import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEIS_JWT_SECRET || 'neis-smkn-maniis-secret-key-2024';

if (!process.env.NEIS_JWT_SECRET) {
  console.warn('[NEIS] ⚠️ NEIS_JWT_SECRET not set, using default. Set env var for production!');
}

export interface JWTPayload {
  userId: string;
  nip: string;
  nama: string;
  role: string | null;
  status_persetujuan: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function parseNIP(nip: string): { tanggalLahir: string; jenisKelamin: string } | null {
  if (nip.length !== 18 || !/^\d{18}$/.test(nip)) return null;
  const year = nip.substring(0, 4);
  const month = nip.substring(4, 6);
  const day = nip.substring(6, 8);
  const genderDigit = nip.substring(14, 15);
  
  let tanggalLahir = `${year}-${month}-${day}`;
  // If day > 40, it means female (day - 40)
  const dayNum = parseInt(day);
  if (dayNum > 40) {
    const actualDay = (dayNum - 40).toString().padStart(2, '0');
    tanggalLahir = `${year}-${month}-${actualDay}`;
  }
  
  const jenisKelamin = genderDigit === '1' ? 'Laki-laki' : genderDigit === '2' ? 'Perempuan' : '';
  
  return { tanggalLahir, jenisKelamin };
}
