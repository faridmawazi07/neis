import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tanggal = searchParams.get('tanggal');

    if (tanggal) {
      // Check specific date
      const result = await turso.execute({
        sql: 'SELECT * FROM hari_libur WHERE tanggal = ?',
        args: [tanggal],
      });
      return NextResponse.json({
        data: result.rows,
        isHoliday: result.rows.length > 0,
      });
    }

    // List all ordered by tanggal DESC
    const result = await turso.execute('SELECT * FROM hari_libur ORDER BY tanggal DESC');
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('GET /api/hari-libur error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data hari libur' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat menambah hari libur' }, { status: 403 });
    }

    const { tanggal, keterangan } = await req.json();
    if (!tanggal || !keterangan || typeof keterangan !== 'string' || !keterangan.trim()) {
      return NextResponse.json({ error: 'Tanggal dan keterangan wajib diisi' }, { status: 400 });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(tanggal)) {
      return NextResponse.json({ error: 'Format tanggal tidak valid (YYYY-MM-DD)' }, { status: 400 });
    }

    // Check if date already exists
    const existing = await turso.execute({
      sql: 'SELECT tanggal FROM hari_libur WHERE tanggal = ?',
      args: [tanggal],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Tanggal tersebut sudah ditetapkan sebagai hari libur' }, { status: 409 });
    }

    await turso.execute({
      sql: 'INSERT INTO hari_libur (tanggal, keterangan) VALUES (?, ?)',
      args: [tanggal, keterangan.trim()],
    });

    return NextResponse.json({ data: { tanggal, keterangan: keterangan.trim() }, message: 'Hari libur berhasil ditambahkan' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/hari-libur error:', error);
    return NextResponse.json({ error: 'Gagal menambah hari libur' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat mengubah hari libur' }, { status: 403 });
    }

    const { tanggal, keterangan } = await req.json();
    if (!tanggal || !keterangan || typeof keterangan !== 'string' || !keterangan.trim()) {
      return NextResponse.json({ error: 'Tanggal dan keterangan wajib diisi' }, { status: 400 });
    }

    // Check if hari libur exists
    const existing = await turso.execute({
      sql: 'SELECT tanggal FROM hari_libur WHERE tanggal = ?',
      args: [tanggal],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Hari libur tidak ditemukan' }, { status: 404 });
    }

    await turso.execute({
      sql: 'UPDATE hari_libur SET keterangan = ? WHERE tanggal = ?',
      args: [keterangan.trim(), tanggal],
    });

    return NextResponse.json({ data: { tanggal, keterangan: keterangan.trim() }, message: 'Hari libur berhasil diperbarui' });
  } catch (error) {
    console.error('PUT /api/hari-libur error:', error);
    return NextResponse.json({ error: 'Gagal mengubah hari libur' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat menghapus hari libur' }, { status: 403 });
    }

    const body = await req.json();
    const { tanggal, tanggals, action } = body;

    // Bulk delete
    if (action === 'bulk-delete' && Array.isArray(tanggals) && tanggals.length > 0) {
      const results = { success: 0, notFound: 0, errors: [] as string[] };

      for (const tgl of tanggals) {
        try {
          const existing = await turso.execute({
            sql: 'SELECT tanggal FROM hari_libur WHERE tanggal = ?',
            args: [tgl],
          });
          if (existing.rows.length === 0) {
            results.notFound++;
            continue;
          }
          await turso.execute({
            sql: 'DELETE FROM hari_libur WHERE tanggal = ?',
            args: [tgl],
          });
          results.success++;
        } catch {
          results.errors.push(tgl);
        }
      }

      return NextResponse.json({
        message: `${results.success} hari libur berhasil dihapus`,
        results,
      });
    }

    // Single delete
    if (!tanggal) {
      return NextResponse.json({ error: 'Tanggal wajib diisi' }, { status: 400 });
    }

    // Check if hari libur exists
    const existing = await turso.execute({
      sql: 'SELECT tanggal FROM hari_libur WHERE tanggal = ?',
      args: [tanggal],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Hari libur tidak ditemukan' }, { status: 404 });
    }

    await turso.execute({
      sql: 'DELETE FROM hari_libur WHERE tanggal = ?',
      args: [tanggal],
    });

    return NextResponse.json({ message: 'Hari libur berhasil dihapus' });
  } catch (error) {
    console.error('DELETE /api/hari-libur error:', error);
    return NextResponse.json({ error: 'Gagal menghapus hari libur' }, { status: 500 });
  }
}
