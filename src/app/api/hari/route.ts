import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const result = await turso.execute('SELECT * FROM hari ORDER BY id');
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('GET /api/hari error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data hari' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat menambah hari' }, { status: 403 });
    }

    const { nama_hari } = await req.json();
    if (!nama_hari || typeof nama_hari !== 'string' || !nama_hari.trim()) {
      return NextResponse.json({ error: 'Nama hari wajib diisi' }, { status: 400 });
    }

    // Check uniqueness
    const existing = await turso.execute({
      sql: 'SELECT id FROM hari WHERE nama_hari = ?',
      args: [nama_hari.trim()],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Nama hari sudah ada' }, { status: 409 });
    }

    const id = uuidv4();
    await turso.execute({
      sql: 'INSERT INTO hari (id, nama_hari) VALUES (?, ?)',
      args: [id, nama_hari.trim()],
    });

    return NextResponse.json({ data: { id, nama_hari: nama_hari.trim() }, message: 'Hari berhasil ditambahkan' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/hari error:', error);
    return NextResponse.json({ error: 'Gagal menambah hari' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat mengubah hari' }, { status: 403 });
    }

    const { id, nama_hari } = await req.json();
    if (!id || !nama_hari || typeof nama_hari !== 'string' || !nama_hari.trim()) {
      return NextResponse.json({ error: 'ID dan nama hari wajib diisi' }, { status: 400 });
    }

    // Check if hari exists
    const existing = await turso.execute({
      sql: 'SELECT id FROM hari WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Hari tidak ditemukan' }, { status: 404 });
    }

    // Check uniqueness of new name (exclude current)
    const duplicate = await turso.execute({
      sql: 'SELECT id FROM hari WHERE nama_hari = ? AND id != ?',
      args: [nama_hari.trim(), id],
    });
    if (duplicate.rows.length > 0) {
      return NextResponse.json({ error: 'Nama hari sudah digunakan' }, { status: 409 });
    }

    await turso.execute({
      sql: 'UPDATE hari SET nama_hari = ? WHERE id = ?',
      args: [nama_hari.trim(), id],
    });

    return NextResponse.json({ data: { id, nama_hari: nama_hari.trim() }, message: 'Hari berhasil diperbarui' });
  } catch (error) {
    console.error('PUT /api/hari error:', error);
    return NextResponse.json({ error: 'Gagal mengubah hari' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat menghapus hari' }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID hari wajib diisi' }, { status: 400 });
    }

    // Check if hari exists
    const existing = await turso.execute({
      sql: 'SELECT id FROM hari WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Hari tidak ditemukan' }, { status: 404 });
    }

    // Check if hari is used in jadwal
    const jadwalCheck = await turso.execute({
      sql: 'SELECT id FROM jadwal WHERE hari_id = ? LIMIT 1',
      args: [id],
    });
    if (jadwalCheck.rows.length > 0) {
      return NextResponse.json({ error: 'Hari tidak dapat dihapus karena masih digunakan di jadwal' }, { status: 409 });
    }

    await turso.execute({
      sql: 'DELETE FROM hari WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ message: 'Hari berhasil dihapus' });
  } catch (error) {
    console.error('DELETE /api/hari error:', error);
    return NextResponse.json({ error: 'Gagal menghapus hari' }, { status: 500 });
  }
}
