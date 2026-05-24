import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { turso } from '@/lib/turso';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    }

    const result = await turso.execute({
      sql: 'SELECT id, nip, nama, role, status_persetujuan, foto_profile, jenis_kelamin, tanggal_lahir FROM users WHERE id = ?',
      args: [payload.userId],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const user = result.rows[0];
    return NextResponse.json({
      id: user.id,
      nip: user.nip,
      nama: user.nama,
      role: user.role,
      status_persetujuan: user.status_persetujuan,
      foto_profile: user.foto_profile,
      jenis_kelamin: user.jenis_kelamin,
      tanggal_lahir: user.tanggal_lahir,
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
