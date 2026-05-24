import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const result = await turso.execute('SELECT * FROM status_kehadiran ORDER BY id');
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('GET /api/status-kehadiran error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data status kehadiran' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat menambah status kehadiran' }, { status: 403 });
    }

    const { nama_status } = await req.json();
    if (!nama_status || typeof nama_status !== 'string' || !nama_status.trim()) {
      return NextResponse.json({ error: 'Nama status wajib diisi' }, { status: 400 });
    }

    // Check uniqueness
    const existing = await turso.execute({
      sql: 'SELECT id FROM status_kehadiran WHERE nama_status = ?',
      args: [nama_status.trim()],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Nama status sudah ada' }, { status: 409 });
    }

    const id = uuidv4();
    await turso.execute({
      sql: 'INSERT INTO status_kehadiran (id, nama_status) VALUES (?, ?)',
      args: [id, nama_status.trim()],
    });

    return NextResponse.json({ data: { id, nama_status: nama_status.trim() }, message: 'Status kehadiran berhasil ditambahkan' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/status-kehadiran error:', error);
    return NextResponse.json({ error: 'Gagal menambah status kehadiran' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat mengubah status kehadiran' }, { status: 403 });
    }

    const { id, nama_status } = await req.json();
    if (!id || !nama_status || typeof nama_status !== 'string' || !nama_status.trim()) {
      return NextResponse.json({ error: 'ID dan nama status wajib diisi' }, { status: 400 });
    }

    // Check if status exists
    const existing = await turso.execute({
      sql: 'SELECT id FROM status_kehadiran WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Status kehadiran tidak ditemukan' }, { status: 404 });
    }

    // Check uniqueness of new name (exclude current)
    const duplicate = await turso.execute({
      sql: 'SELECT id FROM status_kehadiran WHERE nama_status = ? AND id != ?',
      args: [nama_status.trim(), id],
    });
    if (duplicate.rows.length > 0) {
      return NextResponse.json({ error: 'Nama status sudah digunakan' }, { status: 409 });
    }

    await turso.execute({
      sql: 'UPDATE status_kehadiran SET nama_status = ? WHERE id = ?',
      args: [nama_status.trim(), id],
    });

    return NextResponse.json({ data: { id, nama_status: nama_status.trim() }, message: 'Status kehadiran berhasil diperbarui' });
  } catch (error) {
    console.error('PUT /api/status-kehadiran error:', error);
    return NextResponse.json({ error: 'Gagal mengubah status kehadiran' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat menghapus status kehadiran' }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID status kehadiran wajib diisi' }, { status: 400 });
    }

    // Check if status exists
    const existing = await turso.execute({
      sql: 'SELECT id FROM status_kehadiran WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Status kehadiran tidak ditemukan' }, { status: 404 });
    }

    // Check if status is used in kehadiran_mengajar
    const kehadiranCheck = await turso.execute({
      sql: 'SELECT id FROM kehadiran_mengajar WHERE status_kehadiran_id = ? LIMIT 1',
      args: [id],
    });
    if (kehadiranCheck.rows.length > 0) {
      return NextResponse.json({ error: 'Status kehadiran tidak dapat dihapus karena masih digunakan di data kehadiran' }, { status: 409 });
    }

    await turso.execute({
      sql: 'DELETE FROM status_kehadiran WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ message: 'Status kehadiran berhasil dihapus' });
  } catch (error) {
    console.error('DELETE /api/status-kehadiran error:', error);
    return NextResponse.json({ error: 'Gagal menghapus status kehadiran' }, { status: 500 });
  }
}
