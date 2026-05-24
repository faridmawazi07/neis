import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken, comparePassword, hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    const payload = verifyToken(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, oldPassword, newPassword } = await req.json();
    if (!id || !oldPassword || !newPassword) {
      return NextResponse.json({ error: 'ID, password lama, dan password baru wajib diisi' }, { status: 400 });
    }

    // Users can only change their own password unless admin
    if (payload.role !== 'admin' && payload.userId !== id) {
      return NextResponse.json({ error: 'Forbidden - Anda hanya dapat mengubah password sendiri' }, { status: 403 });
    }

    // Check if user exists
    const existing = await turso.execute({
      sql: 'SELECT id, password FROM users WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    // Verify old password
    const currentHash = existing.rows[0].password as string;
    const isValid = await comparePassword(oldPassword, currentHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Password lama tidak sesuai' }, { status: 401 });
    }

    // Hash and update new password
    const newHash = await hashPassword(newPassword);
    await turso.execute({
      sql: "UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?",
      args: [newHash, id],
    });

    return NextResponse.json({ message: 'Password berhasil diubah' });
  } catch (error) {
    console.error('POST /api/users/change-password error:', error);
    return NextResponse.json({ error: 'Gagal mengubah password' }, { status: 500 });
  }
}
