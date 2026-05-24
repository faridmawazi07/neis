import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { hashPassword, parseNIP } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const nip = formData.get('nip') as string;
    const nama = formData.get('nama') as string;
    const password = formData.get('password') as string;
    const foto_profile = formData.get('foto_profile') as string | null;

    if (!nip || !nama || !password) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 });
    }

    if (!foto_profile) {
      return NextResponse.json({ error: 'Foto profil wajib diunggah/diambil melalui kamera untuk melanjutkan pendaftaran!' }, { status: 400 });
    }

    // Validate NIP: 18 digits for non-admin
    if (!/^\d{18}$/.test(nip)) {
      return NextResponse.json({ error: 'NIP harus tepat 18 digit angka!' }, { status: 400 });
    }

    // Check uniqueness
    const existing = await turso.execute({
      sql: 'SELECT id FROM users WHERE nip = ?',
      args: [nip],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'NIP sudah terdaftar' }, { status: 400 });
    }

    const parsed = parseNIP(nip);
    const hashedPassword = await hashPassword(password);
    const id = uuidv4();

    await turso.execute({
      sql: `INSERT INTO users (id, nip, nama, password, role, status_persetujuan, foto_profile, jenis_kelamin, tanggal_lahir) 
            VALUES (?, ?, ?, ?, NULL, 'pending', ?, ?, ?)`,
      args: [id, nip, nama, hashedPassword, foto_profile, parsed?.jenisKelamin || null, parsed?.tanggalLahir || null],
    });

    return NextResponse.json({ message: 'Pendaftaran berhasil! Menunggu persetujuan admin.' });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
