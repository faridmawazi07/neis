import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const result = await turso.execute('SELECT * FROM kelas ORDER BY nama_kelas');
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('GET /api/kelas error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data kelas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    const payload = verifyToken(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat menambah kelas' }, { status: 403 });
    }

    const { nama_kelas } = await req.json();
    if (!nama_kelas || typeof nama_kelas !== 'string' || !nama_kelas.trim()) {
      return NextResponse.json({ error: 'Nama kelas wajib diisi' }, { status: 400 });
    }

    // Check uniqueness
    const existing = await turso.execute({
      sql: 'SELECT id FROM kelas WHERE nama_kelas = ?',
      args: [nama_kelas.trim()],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Nama kelas sudah ada' }, { status: 409 });
    }

    const id = uuidv4();
    await turso.execute({
      sql: 'INSERT INTO kelas (id, nama_kelas) VALUES (?, ?)',
      args: [id, nama_kelas.trim()],
    });

    return NextResponse.json({ data: { id, nama_kelas: nama_kelas.trim() }, message: 'Kelas berhasil ditambahkan' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/kelas error:', error);
    return NextResponse.json({ error: 'Gagal menambah kelas' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    const payload = verifyToken(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat mengubah kelas' }, { status: 403 });
    }

    const { id, nama_kelas } = await req.json();
    if (!id || !nama_kelas || typeof nama_kelas !== 'string' || !nama_kelas.trim()) {
      return NextResponse.json({ error: 'ID dan nama kelas wajib diisi' }, { status: 400 });
    }

    // Check if kelas exists
    const existing = await turso.execute({
      sql: 'SELECT id FROM kelas WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
    }

    // Check uniqueness of new name (exclude current)
    const duplicate = await turso.execute({
      sql: 'SELECT id FROM kelas WHERE nama_kelas = ? AND id != ?',
      args: [nama_kelas.trim(), id],
    });
    if (duplicate.rows.length > 0) {
      return NextResponse.json({ error: 'Nama kelas sudah digunakan' }, { status: 409 });
    }

    await turso.execute({
      sql: 'UPDATE kelas SET nama_kelas = ? WHERE id = ?',
      args: [nama_kelas.trim(), id],
    });

    return NextResponse.json({ data: { id, nama_kelas: nama_kelas.trim() }, message: 'Kelas berhasil diperbarui' });
  } catch (error) {
    console.error('PUT /api/kelas error:', error);
    return NextResponse.json({ error: 'Gagal mengubah kelas' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat menghapus kelas' }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID kelas wajib diisi' }, { status: 400 });
    }

    // Check if kelas exists
    const existing = await turso.execute({
      sql: 'SELECT id FROM kelas WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
    }

    // Delete related jadwal first
    await turso.execute({
      sql: 'DELETE FROM jadwal WHERE kelas_id = ?',
      args: [id],
    });

    // Delete related siswa
    await turso.execute({
      sql: 'DELETE FROM siswa WHERE kelas_id = ?',
      args: [id],
    });

    // Delete kelas
    await turso.execute({
      sql: 'DELETE FROM kelas WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ message: 'Kelas dan data terkait berhasil dihapus' });
  } catch (error) {
    console.error('DELETE /api/kelas error:', error);
    return NextResponse.json({ error: 'Gagal menghapus kelas' }, { status: 500 });
  }
}
