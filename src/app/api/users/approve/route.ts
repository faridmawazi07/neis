import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    const payload = verifyToken(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (payload.role !== 'admin' && payload.role !== 'pegawai') {
      return NextResponse.json({ error: 'Forbidden - Hanya admin atau pegawai yang dapat menyetujui pengguna' }, { status: 403 });
    }

    const { id, role } = await req.json();
    if (!id || !role) {
      return NextResponse.json({ error: 'ID pengguna dan role wajib diisi' }, { status: 400 });
    }

    if (!['guru', 'pegawai'].includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid. Harus guru atau pegawai' }, { status: 400 });
    }

    // Check if user exists and is pending
    const existing = await turso.execute({
      sql: 'SELECT id, status_persetujuan FROM users WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    if (existing.rows[0].status_persetujuan !== 'pending') {
      return NextResponse.json({ error: 'Pengguna sudah diproses sebelumnya' }, { status: 400 });
    }

    // Approve user
    await turso.execute({
      sql: 'UPDATE users SET status_persetujuan = ?, role = ?, updated_at = datetime(\'now\') WHERE id = ?',
      args: ['approved', role, id],
    });

    // Fetch updated user
    const updated = await turso.execute({
      sql: 'SELECT id, nip, nama, role, status_persetujuan, foto_profile, jenis_kelamin, tanggal_lahir, created_at FROM users WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({
      data: updated.rows[0],
      message: 'Pengguna berhasil disetujui',
    });
  } catch (error) {
    console.error('POST /api/users/approve error:', error);
    return NextResponse.json({ error: 'Gagal menyetujui pengguna' }, { status: 500 });
  }
}
