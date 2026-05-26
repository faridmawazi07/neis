import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';
import { deleteFromCloudinary } from '@/lib/cloudinary';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    const payload = verifyToken(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (payload.role !== 'admin' && payload.role !== 'pegawai') {
      return NextResponse.json({ error: 'Forbidden - Hanya admin atau pegawai yang dapat menolak pengguna' }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID pengguna wajib diisi' }, { status: 400 });
    }

    // Check if user exists and is pending
    const existing = await turso.execute({
      sql: 'SELECT id, nama, status_persetujuan, foto_profile FROM users WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    if (existing.rows[0].status_persetujuan !== 'pending') {
      return NextResponse.json({ error: 'Pengguna sudah diproses sebelumnya' }, { status: 400 });
    }

    // Delete profile photo from Cloudinary if exists
    const fotoProfile = existing.rows[0].foto_profile as string | null;
    if (fotoProfile && fotoProfile.includes('cloudinary.com')) {
      try {
        await deleteFromCloudinary(fotoProfile);
      } catch (e) {
        console.error('Failed to delete profile photo from Cloudinary:', e);
      }
    }

    // Delete the user
    await turso.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({
      message: 'Pendaftaran berhasil ditolak',
    });
  } catch (error) {
    console.error('POST /api/users/reject error:', error);
    return NextResponse.json({ error: 'Gagal menolak pengguna' }, { status: 500 });
  }
}
