import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    const payload = verifyToken(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (payload.role !== 'admin' && payload.role !== 'pegawai' && payload.role !== 'pimpinan') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    let sql = `SELECT id, nip, nama, role, status_persetujuan, foto_profile, jenis_kelamin, tanggal_lahir, created_at FROM users WHERE 1=1`;
    const args: (string | number)[] = [];

    if (status === 'approved') {
      sql += ` AND status_persetujuan = 'approved' AND role != 'admin'`;
    } else if (status === 'pending') {
      sql += ` AND status_persetujuan = 'pending'`;
    }

    if (role && ['guru', 'pegawai', 'pimpinan'].includes(role)) {
      sql += ` AND role = ?`;
      args.push(role);
    }

    if (search) {
      sql += ` AND (nama LIKE ? OR nip LIKE ?)`;
      args.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await turso.execute({ sql, args });
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('GET /api/users error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data pengguna' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    const payload = verifyToken(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat menghapus pengguna' }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID pengguna wajib diisi' }, { status: 400 });
    }

    // Prevent deleting self
    if (id === payload.userId) {
      return NextResponse.json({ error: 'Tidak dapat menghapus akun sendiri' }, { status: 400 });
    }

    // Check if user exists
    const existing = await turso.execute({
      sql: 'SELECT id, role FROM users WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    const userRole = existing.rows[0].role as string;

    // If deleting a guru, cascade delete their jadwal
    // But NOT their kehadiran_mengajar
    if (userRole === 'guru') {
      await turso.execute({
        sql: 'DELETE FROM jadwal WHERE guru_id = ?',
        args: [id],
      });
    }

    // Delete the user
    await turso.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ message: 'Pengguna berhasil dihapus' });
  } catch (error) {
    console.error('DELETE /api/users error:', error);
    return NextResponse.json({ error: 'Gagal menghapus pengguna' }, { status: 500 });
  }
}
