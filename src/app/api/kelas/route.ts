import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // GET /api/kelas?action=guru-list -> return all approved guru users
    if (action === 'guru-list') {
      const result = await turso.execute(
        "SELECT id, nip, nama FROM users WHERE role = 'guru' AND status_persetujuan = 'approved' ORDER BY nama"
      );
      return NextResponse.json({ data: result.rows });
    }

    // GET /api/kelas?action=my-kelas&guru_id=xxx -> return class where guru is wali kelas
    if (action === 'my-kelas') {
      const guru_id = searchParams.get('guru_id');
      if (!guru_id) {
        return NextResponse.json({ error: 'guru_id wajib diisi' }, { status: 400 });
      }
      const result = await turso.execute({
        sql: 'SELECT k.id, k.nama_kelas, k.wali_kelas_id FROM kelas k WHERE k.wali_kelas_id = ?',
        args: [guru_id],
      });
      if (result.rows.length === 0) {
        return NextResponse.json({ data: null });
      }
      return NextResponse.json({ data: result.rows[0] });
    }

    // Default GET: return all kelas with wali kelas info
    const result = await turso.execute(
      'SELECT k.id, k.nama_kelas, k.wali_kelas_id, u.nama as wali_kelas_nama FROM kelas k LEFT JOIN users u ON k.wali_kelas_id = u.id ORDER BY k.nama_kelas'
    );
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

    const { nama_kelas, wali_kelas_id } = await req.json();
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
    const waliId = wali_kelas_id || null;
    await turso.execute({
      sql: 'INSERT INTO kelas (id, nama_kelas, wali_kelas_id) VALUES (?, ?, ?)',
      args: [id, nama_kelas.trim(), waliId],
    });

    // Fetch wali kelas name if set
    let waliNama = null;
    if (waliId) {
      const waliResult = await turso.execute({
        sql: 'SELECT nama FROM users WHERE id = ?',
        args: [waliId],
      });
      if (waliResult.rows.length > 0) {
        waliNama = waliResult.rows[0].nama;
      }
    }

    return NextResponse.json({
      data: { id, nama_kelas: nama_kelas.trim(), wali_kelas_id: waliId, wali_kelas_nama: waliNama },
      message: 'Kelas berhasil ditambahkan',
    }, { status: 201 });
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

    const { id, nama_kelas, wali_kelas_id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID kelas wajib diisi' }, { status: 400 });
    }

    // At least one field must be provided
    if (nama_kelas === undefined && wali_kelas_id === undefined) {
      return NextResponse.json({ error: 'Minimal salah satu dari nama_kelas atau wali_kelas_id harus diisi' }, { status: 400 });
    }

    // Check if kelas exists
    const existing = await turso.execute({
      sql: 'SELECT id FROM kelas WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
    }

    // Build dynamic UPDATE query
    const setClauses: string[] = [];
    const args: (string | null)[] = [];

    if (nama_kelas !== undefined) {
      // nama_kelas changes are admin-only
      if (payload.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat mengubah nama kelas' }, { status: 403 });
      }
      if (typeof nama_kelas !== 'string' || !nama_kelas.trim()) {
        return NextResponse.json({ error: 'Nama kelas tidak boleh kosong' }, { status: 400 });
      }
      // Check uniqueness of new name (exclude current)
      const duplicate = await turso.execute({
        sql: 'SELECT id FROM kelas WHERE nama_kelas = ? AND id != ?',
        args: [nama_kelas.trim(), id],
      });
      if (duplicate.rows.length > 0) {
        return NextResponse.json({ error: 'Nama kelas sudah digunakan' }, { status: 409 });
      }
      setClauses.push('nama_kelas = ?');
      args.push(nama_kelas.trim());
    }

    if (wali_kelas_id !== undefined) {
      // wali_kelas_id changes allowed for admin AND pegawai
      if (payload.role !== 'admin' && payload.role !== 'pegawai') {
        return NextResponse.json({ error: 'Forbidden - Hanya admin atau pegawai yang dapat mengubah wali kelas' }, { status: 403 });
      }
      // wali_kelas_id can be null (to remove wali kelas) or a valid user id
      const waliId = wali_kelas_id || null;
      if (waliId) {
        // Verify the user exists and is an approved guru
        const guruCheck = await turso.execute({
          sql: "SELECT id FROM users WHERE id = ? AND role = 'guru' AND status_persetujuan = 'approved'",
          args: [waliId],
        });
        if (guruCheck.rows.length === 0) {
          return NextResponse.json({ error: 'Guru tidak ditemukan atau belum disetujui' }, { status: 400 });
        }
      }
      setClauses.push('wali_kelas_id = ?');
      args.push(waliId);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 });
    }

    args.push(id);
    await turso.execute({
      sql: `UPDATE kelas SET ${setClauses.join(', ')} WHERE id = ?`,
      args,
    });

    // Fetch updated row with wali kelas name
    const updated = await turso.execute({
      sql: 'SELECT k.id, k.nama_kelas, k.wali_kelas_id, u.nama as wali_kelas_nama FROM kelas k LEFT JOIN users u ON k.wali_kelas_id = u.id WHERE k.id = ?',
      args: [id],
    });

    return NextResponse.json({ data: updated.rows[0], message: 'Kelas berhasil diperbarui' });
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
