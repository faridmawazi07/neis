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

    const formData = await req.formData();
    const id = formData.get('id') as string;
    const nama = formData.get('nama') as string | null;
    const nip = formData.get('nip') as string | null;
    const role = formData.get('role') as string | null;
    const jenis_kelamin = formData.get('jenis_kelamin') as string | null;
    const tanggal_lahir = formData.get('tanggal_lahir') as string | null;
    const foto_profile = formData.get('foto_profile') as File | null;
    const remove_photo = formData.get('remove_photo') as string | null;

    if (!id) {
      return NextResponse.json({ error: 'ID pengguna wajib diisi' }, { status: 400 });
    }

    // Users can only update their own profile unless admin
    if (payload.role !== 'admin' && payload.userId !== id) {
      return NextResponse.json({ error: 'Forbidden - Anda hanya dapat mengubah profil sendiri' }, { status: 403 });
    }

    // Check if user exists
    const existing = await turso.execute({
      sql: 'SELECT id, nip FROM users WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    const updates: string[] = [];
    const args: (string | null)[] = [];

    if (nama !== null && nama.trim()) {
      updates.push('nama = ?');
      args.push(nama.trim());
    }

    // Only admin can update nip (username)
    if (nip !== null && nip.trim()) {
      if (payload.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden - NIP tidak dapat diubah oleh pengguna biasa' }, { status: 403 });
      }

      // Check nip uniqueness (exclude current user)
      const nipCheck = await turso.execute({
        sql: 'SELECT id FROM users WHERE nip = ? AND id != ?',
        args: [nip.trim(), id],
      });
      if (nipCheck.rows.length > 0) {
        return NextResponse.json({ error: 'NIP sudah digunakan oleh pengguna lain' }, { status: 409 });
      }

      updates.push('nip = ?');
      args.push(nip.trim());
    }

    // Only admin can update role
    if (role !== null && role.trim()) {
      if (payload.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden - Role tidak dapat diubah oleh pengguna biasa' }, { status: 403 });
      }
      if (!['guru', 'pegawai', 'pimpinan'].includes(role.trim())) {
        return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
      }
      updates.push('role = ?');
      args.push(role.trim());
    }

    // Jenis kelamin
    if (jenis_kelamin !== null) {
      if (jenis_kelamin && !['L', 'P'].includes(jenis_kelamin)) {
        return NextResponse.json({ error: 'Jenis kelamin tidak valid' }, { status: 400 });
      }
      updates.push('jenis_kelamin = ?');
      args.push(jenis_kelamin || null);
    }

    // Tanggal lahir
    if (tanggal_lahir !== null) {
      updates.push('tanggal_lahir = ?');
      args.push(tanggal_lahir || null);
    }

    // Handle photo upload - store as base64 data URL
    if (foto_profile && typeof foto_profile !== 'string') {
      const bytes = await foto_profile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString('base64');
      const mimeType = foto_profile.type || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      updates.push('foto_profile = ?');
      args.push(dataUrl);
    } else if (remove_photo === 'true') {
      // Admin explicitly removes photo
      updates.push('foto_profile = ?');
      args.push(null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diperbarui' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    args.push(id);

    await turso.execute({
      sql: `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });

    // Fetch updated user
    const updated = await turso.execute({
      sql: 'SELECT id, nip, nama, role, status_persetujuan, foto_profile, jenis_kelamin, tanggal_lahir, created_at FROM users WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({
      data: updated.rows[0],
      message: 'Profil berhasil diperbarui',
    });
  } catch (error) {
    console.error('POST /api/users/update-profile error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui profil' }, { status: 500 });
  }
}
