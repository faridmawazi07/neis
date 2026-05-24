import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const result = await turso.execute('SELECT * FROM mapel ORDER BY nama_mapel');
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('GET /api/mapel error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data mapel' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat menambah mapel' }, { status: 403 });
    }

    const { nama_mapel } = await req.json();
    if (!nama_mapel || typeof nama_mapel !== 'string' || !nama_mapel.trim()) {
      return NextResponse.json({ error: 'Nama mapel wajib diisi' }, { status: 400 });
    }

    // Check uniqueness
    const existing = await turso.execute({
      sql: 'SELECT id FROM mapel WHERE nama_mapel = ?',
      args: [nama_mapel.trim()],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Nama mapel sudah ada' }, { status: 409 });
    }

    const id = uuidv4();
    await turso.execute({
      sql: 'INSERT INTO mapel (id, nama_mapel) VALUES (?, ?)',
      args: [id, nama_mapel.trim()],
    });

    return NextResponse.json({ data: { id, nama_mapel: nama_mapel.trim() }, message: 'Mapel berhasil ditambahkan' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/mapel error:', error);
    return NextResponse.json({ error: 'Gagal menambah mapel' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat mengubah mapel' }, { status: 403 });
    }

    const { id, nama_mapel } = await req.json();
    if (!id || !nama_mapel || typeof nama_mapel !== 'string' || !nama_mapel.trim()) {
      return NextResponse.json({ error: 'ID dan nama mapel wajib diisi' }, { status: 400 });
    }

    // Check if mapel exists
    const existing = await turso.execute({
      sql: 'SELECT id FROM mapel WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Mapel tidak ditemukan' }, { status: 404 });
    }

    // Check uniqueness of new name (exclude current)
    const duplicate = await turso.execute({
      sql: 'SELECT id FROM mapel WHERE nama_mapel = ? AND id != ?',
      args: [nama_mapel.trim(), id],
    });
    if (duplicate.rows.length > 0) {
      return NextResponse.json({ error: 'Nama mapel sudah digunakan' }, { status: 409 });
    }

    await turso.execute({
      sql: 'UPDATE mapel SET nama_mapel = ? WHERE id = ?',
      args: [nama_mapel.trim(), id],
    });

    return NextResponse.json({ data: { id, nama_mapel: nama_mapel.trim() }, message: 'Mapel berhasil diperbarui' });
  } catch (error) {
    console.error('PUT /api/mapel error:', error);
    return NextResponse.json({ error: 'Gagal mengubah mapel' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat menghapus mapel' }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID mapel wajib diisi' }, { status: 400 });
    }

    // Check if mapel exists
    const existing = await turso.execute({
      sql: 'SELECT id FROM mapel WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Mapel tidak ditemukan' }, { status: 404 });
    }

    // Delete related jadwal first
    await turso.execute({
      sql: 'DELETE FROM jadwal WHERE mapel_id = ?',
      args: [id],
    });

    // Delete mapel
    await turso.execute({
      sql: 'DELETE FROM mapel WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ message: 'Mapel dan jadwal terkait berhasil dihapus' });
  } catch (error) {
    console.error('DELETE /api/mapel error:', error);
    return NextResponse.json({ error: 'Gagal menghapus mapel' }, { status: 500 });
  }
}
