import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    const payload = verifyToken(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const kelas_id = searchParams.get('kelas_id');

    let sql = `SELECT s.id, s.nis, s.nisn, s.nama, s.kelas_id, s.jenis_kelamin, k.nama_kelas FROM siswa s JOIN kelas k ON s.kelas_id = k.id WHERE 1=1`;
    const args: string[] = [];

    if (kelas_id) {
      sql += ` AND s.kelas_id = ?`;
      args.push(kelas_id);
    }

    sql += ` ORDER BY k.nama_kelas, s.nama`;

    const result = await turso.execute({ sql, args });
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('GET /api/siswa error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data siswa' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    const payload = verifyToken(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (payload.role !== 'admin' && payload.role !== 'pegawai') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Reset all siswa data
    if (action === 'reset') {
      const { confirm } = await req.json();
      if (confirm !== 'RESET_ALL_SISWA') {
        return NextResponse.json({ error: 'Konfirmasi tidak valid. Kirim { confirm: "RESET_ALL_SISWA" } untuk menghapus semua data siswa' }, { status: 400 });
      }

      await turso.execute('DELETE FROM siswa');
      return NextResponse.json({ message: 'Semua data siswa berhasil dihapus' });
    }

    // Kenaikan kelas - bulk update
    if (action === 'kenaikan-kelas') {
      const { mapping } = await req.json();
      if (!mapping || typeof mapping !== 'object') {
        return NextResponse.json({ error: 'Mapping kelas wajib diisi' }, { status: 400 });
      }

      let totalUpdated = 0;
      for (const [oldKelasId, newKelasId] of Object.entries(mapping)) {
        if (typeof newKelasId !== 'string') continue;
        const result = await turso.execute({
          sql: 'UPDATE siswa SET kelas_id = ? WHERE kelas_id = ?',
          args: [newKelasId as string, oldKelasId],
        });
        totalUpdated += result.rowsAffected;
      }

      return NextResponse.json({
        message: `Kenaikan kelas berhasil. ${totalUpdated} siswa diperbarui.`,
        totalUpdated,
      });
    }

    // Normal create siswa
    const { nis, nisn, nama, kelas_id, jenis_kelamin } = await req.json();
    if (!nis || !nisn || !nama || !kelas_id) {
      return NextResponse.json({ error: 'NIS, NISN, nama, dan kelas_id wajib diisi' }, { status: 400 });
    }

    // Check if kelas exists
    const kelasCheck = await turso.execute({
      sql: 'SELECT id FROM kelas WHERE id = ?',
      args: [kelas_id],
    });
    if (kelasCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
    }

    // Check NIS uniqueness
    const nisCheck = await turso.execute({
      sql: 'SELECT id FROM siswa WHERE nis = ?',
      args: [nis],
    });
    if (nisCheck.rows.length > 0) {
      return NextResponse.json({ error: 'NIS sudah digunakan' }, { status: 409 });
    }

    // Check NISN uniqueness
    const nisnCheck = await turso.execute({
      sql: 'SELECT id FROM siswa WHERE nisn = ?',
      args: [nisn],
    });
    if (nisnCheck.rows.length > 0) {
      return NextResponse.json({ error: 'NISN sudah digunakan' }, { status: 409 });
    }

    const id = uuidv4();
    await turso.execute({
      sql: 'INSERT INTO siswa (id, nis, nisn, nama, kelas_id, jenis_kelamin) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, nis, nisn, nama.trim(), kelas_id, jenis_kelamin || null],
    });

    return NextResponse.json({
      data: { id, nis, nisn, nama: nama.trim(), kelas_id, jenis_kelamin: jenis_kelamin || null },
      message: 'Siswa berhasil ditambahkan',
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/siswa error:', error);
    return NextResponse.json({ error: 'Gagal menambah siswa' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    const payload = verifyToken(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (payload.role !== 'admin' && payload.role !== 'pegawai') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, nis, nisn, nama, kelas_id, jenis_kelamin } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID siswa wajib diisi' }, { status: 400 });
    }

    // Check if siswa exists
    const existing = await turso.execute({
      sql: 'SELECT id FROM siswa WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 });
    }

    const updates: string[] = [];
    const args: (string | null)[] = [];

    if (nis !== undefined) {
      // Check NIS uniqueness (exclude current)
      const nisCheck = await turso.execute({
        sql: 'SELECT id FROM siswa WHERE nis = ? AND id != ?',
        args: [nis, id],
      });
      if (nisCheck.rows.length > 0) {
        return NextResponse.json({ error: 'NIS sudah digunakan' }, { status: 409 });
      }
      updates.push('nis = ?');
      args.push(nis);
    }

    if (nisn !== undefined) {
      // Check NISN uniqueness (exclude current)
      const nisnCheck = await turso.execute({
        sql: 'SELECT id FROM siswa WHERE nisn = ? AND id != ?',
        args: [nisn, id],
      });
      if (nisnCheck.rows.length > 0) {
        return NextResponse.json({ error: 'NISN sudah digunakan' }, { status: 409 });
      }
      updates.push('nisn = ?');
      args.push(nisn);
    }

    if (nama !== undefined && nama.trim()) {
      updates.push('nama = ?');
      args.push(nama.trim());
    }

    if (kelas_id !== undefined) {
      // Check if kelas exists
      const kelasCheck = await turso.execute({
        sql: 'SELECT id FROM kelas WHERE id = ?',
        args: [kelas_id],
      });
      if (kelasCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
      }
      updates.push('kelas_id = ?');
      args.push(kelas_id);
    }

    if (jenis_kelamin !== undefined) {
      updates.push('jenis_kelamin = ?');
      args.push(jenis_kelamin || null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diperbarui' }, { status: 400 });
    }

    args.push(id);
    await turso.execute({
      sql: `UPDATE siswa SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });

    // Fetch updated siswa with kelas info
    const updated = await turso.execute({
      sql: 'SELECT s.id, s.nis, s.nisn, s.nama, s.kelas_id, s.jenis_kelamin, k.nama_kelas FROM siswa s JOIN kelas k ON s.kelas_id = k.id WHERE s.id = ?',
      args: [id],
    });

    return NextResponse.json({
      data: updated.rows[0],
      message: 'Siswa berhasil diperbarui',
    });
  } catch (error) {
    console.error('PUT /api/siswa error:', error);
    return NextResponse.json({ error: 'Gagal mengubah siswa' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    const payload = verifyToken(token || '');
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (payload.role !== 'admin' && payload.role !== 'pegawai') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { ids, id: singleId } = body;

    // Bulk delete
    if (ids && Array.isArray(ids) && ids.length > 0) {
      let totalDeleted = 0;
      for (const siswaId of ids) {
        if (typeof siswaId !== 'string') continue;
        const result = await turso.execute({
          sql: 'DELETE FROM siswa WHERE id = ?',
          args: [siswaId],
        });
        totalDeleted += result.rowsAffected;
      }
      return NextResponse.json({ message: `${totalDeleted} siswa berhasil dihapus`, totalDeleted });
    }

    // Single delete
    if (singleId) {
      const existing = await turso.execute({
        sql: 'SELECT id FROM siswa WHERE id = ?',
        args: [singleId],
      });
      if (existing.rows.length === 0) {
        return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 });
      }

      await turso.execute({
        sql: 'DELETE FROM siswa WHERE id = ?',
        args: [singleId],
      });

      return NextResponse.json({ message: 'Siswa berhasil dihapus' });
    }

    return NextResponse.json({ error: 'ID siswa wajib diisi (id atau ids)' }, { status: 400 });
  } catch (error) {
    console.error('DELETE /api/siswa error:', error);
    return NextResponse.json({ error: 'Gagal menghapus siswa' }, { status: 500 });
  }
}
