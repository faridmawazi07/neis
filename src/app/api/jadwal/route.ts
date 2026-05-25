import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const guru_id = searchParams.get('guru_id');
    const hari_id = searchParams.get('hari_id');
    const kelas_id = searchParams.get('kelas_id');
    const tanggal = searchParams.get('tanggal');

    let sql = `SELECT j.*, u.nama as guru_nama, h.nama_hari, k.nama_kelas, m.nama_mapel,
      (SELECT COUNT(*) FROM kehadiran_mengajar km WHERE km.jadwal_id = j.id AND km.tanggal = ?) as sudah_mengajar
      FROM jadwal j
      LEFT JOIN users u ON j.guru_id = u.id
      LEFT JOIN hari h ON j.hari_id = h.id
      LEFT JOIN kelas k ON j.kelas_id = k.id
      LEFT JOIN mapel m ON j.mapel_id = m.id
      WHERE 1=1`;
    const args: any[] = [tanggal || new Date().toISOString().split('T')[0]];

    if (guru_id) {
      sql += ' AND j.guru_id = ?';
      args.push(guru_id);
    }
    if (hari_id) {
      sql += ' AND j.hari_id = ?';
      args.push(hari_id);
    }
    if (kelas_id) {
      sql += ' AND j.kelas_id = ?';
      args.push(kelas_id);
    }

    sql += ' ORDER BY j.hari_id, j.jam_ke ASC';

    const result = await turso.execute({ sql, args });
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('Jadwal GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });

    const body = await req.json();
    const { guru_id, hari_id, kelas_id, mapel_id, jam_ke, jam_mulai, jam_selesai } = body;

    // Determine guru_id: if role is guru, use their own ID
    const actualGuruId = payload.role === 'guru' ? payload.userId : guru_id;
    if (!actualGuruId || !hari_id || !kelas_id || !mapel_id || !jam_ke || !jam_mulai || !jam_selesai) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 });
    }

    // VALIDASI BENTROK JADWAL: Check if kelas already has a schedule at this hari + jam_ke
    const conflict = await turso.execute({
      sql: `SELECT j.*, u.nama as guru_nama, m.nama_mapel 
            FROM jadwal j 
            LEFT JOIN users u ON j.guru_id = u.id 
            LEFT JOIN mapel m ON j.mapel_id = m.id
            WHERE j.hari_id = ? AND j.kelas_id = ? AND j.jam_ke = ?`,
      args: [hari_id, kelas_id, jam_ke],
    });

    if (conflict.rows.length > 0) {
      const conflictingGuru = conflict.rows[0].guru_nama;
      const conflictingMapel = conflict.rows[0].nama_mapel;
      return NextResponse.json({
        error: `Jadwal gagal ditambahkan! Kelas tersebut sudah diisi oleh ${conflictingGuru} untuk mata pelajaran ${conflictingMapel}.`,
      }, { status: 409 });
    }

    // Also check if the guru already has a schedule at this hari + jam_ke (guru can't teach two classes at same time)
    const guruConflict = await turso.execute({
      sql: `SELECT j.*, k.nama_kelas, m.nama_mapel 
            FROM jadwal j 
            LEFT JOIN kelas k ON j.kelas_id = k.id 
            LEFT JOIN mapel m ON j.mapel_id = m.id
            WHERE j.hari_id = ? AND j.guru_id = ? AND j.jam_ke = ?`,
      args: [hari_id, actualGuruId, jam_ke],
    });

    if (guruConflict.rows.length > 0) {
      const conflictingKelas = guruConflict.rows[0].nama_kelas;
      return NextResponse.json({
        error: `Jadwal gagal ditambahkan! Guru sudah mengajar di kelas ${conflictingKelas} pada jam ke-${jam_ke}.`,
      }, { status: 409 });
    }

    const id = uuidv4();
    await turso.execute({
      sql: `INSERT INTO jadwal (id, guru_id, hari_id, kelas_id, mapel_id, jam_ke, jam_mulai, jam_selesai) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, actualGuruId, hari_id, kelas_id, mapel_id, jam_ke, jam_mulai, jam_selesai],
    });

    return NextResponse.json({ message: 'Jadwal berhasil ditambahkan', id });
  } catch (error) {
    console.error('Jadwal POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });

    const body = await req.json();
    const { id, guru_id, hari_id, kelas_id, mapel_id, jam_ke, jam_mulai, jam_selesai } = body;

    if (!id) return NextResponse.json({ error: 'ID jadwal wajib diisi' }, { status: 400 });

    // Check ownership for guru
    if (payload.role === 'guru') {
      const existing = await turso.execute({
        sql: 'SELECT guru_id FROM jadwal WHERE id = ?',
        args: [id],
      });
      if (existing.rows.length === 0 || existing.rows[0].guru_id !== payload.userId) {
        return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengedit jadwal ini' }, { status: 403 });
      }
    }

    const actualGuruId = payload.role === 'guru' ? payload.userId : guru_id;

    // VALIDASI BENTROK JADWAL for update (exclude current record)
    if (hari_id && kelas_id && jam_ke) {
      const conflict = await turso.execute({
        sql: `SELECT j.*, u.nama as guru_nama, m.nama_mapel 
              FROM jadwal j 
              LEFT JOIN users u ON j.guru_id = u.id 
              LEFT JOIN mapel m ON j.mapel_id = m.id
              WHERE j.hari_id = ? AND j.kelas_id = ? AND j.jam_ke = ? AND j.id != ?`,
        args: [hari_id, kelas_id, jam_ke, id],
      });

      if (conflict.rows.length > 0) {
        const conflictingGuru = conflict.rows[0].guru_nama;
        const conflictingMapel = conflict.rows[0].nama_mapel;
        return NextResponse.json({
          error: `Jadwal gagal diubah! Kelas tersebut sudah diisi oleh ${conflictingGuru} untuk mata pelajaran ${conflictingMapel}.`,
        }, { status: 409 });
      }

      // Check guru conflict
      const guruConflict = await turso.execute({
        sql: `SELECT j.*, k.nama_kelas 
              FROM jadwal j 
              LEFT JOIN kelas k ON j.kelas_id = k.id 
              WHERE j.hari_id = ? AND j.guru_id = ? AND j.jam_ke = ? AND j.id != ?`,
        args: [hari_id, actualGuruId, jam_ke, id],
      });

      if (guruConflict.rows.length > 0) {
        const conflictingKelas = guruConflict.rows[0].nama_kelas;
        return NextResponse.json({
          error: `Jadwal gagal diubah! Guru sudah mengajar di kelas ${conflictingKelas} pada jam ke-${jam_ke}.`,
        }, { status: 409 });
      }
    }

    await turso.execute({
      sql: `UPDATE jadwal SET guru_id = ?, hari_id = ?, kelas_id = ?, mapel_id = ?, jam_ke = ?, jam_mulai = ?, jam_selesai = ? WHERE id = ?`,
      args: [actualGuruId, hari_id, kelas_id, mapel_id, jam_ke, jam_mulai, jam_selesai, id],
    });

    return NextResponse.json({ message: 'Jadwal berhasil diubah' });
  } catch (error) {
    console.error('Jadwal PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });

    const body = await req.json();
    const { id, ids } = body;

    // Support bulk delete (array of IDs) or single ID
    const deleteIds: string[] = ids || (id ? [id] : []);
    if (deleteIds.length === 0) {
      return NextResponse.json({ error: 'ID jadwal wajib diisi' }, { status: 400 });
    }

    // Check ownership for guru
    if (payload.role === 'guru') {
      const existing = await turso.execute({
        sql: `SELECT id, guru_id FROM jadwal WHERE id IN (${deleteIds.map(() => '?').join(', ')})`,
        args: deleteIds,
      });
      const unauthorized = existing.rows.some((r: any) => r.guru_id !== payload.userId);
      if (unauthorized || existing.rows.length !== deleteIds.length) {
        return NextResponse.json({ error: 'Anda tidak memiliki akses untuk menghapus salah satu jadwal ini' }, { status: 403 });
      }
    }

    // Delete all selected jadwal
    await turso.execute({
      sql: `DELETE FROM jadwal WHERE id IN (${deleteIds.map(() => '?').join(', ')})`,
      args: deleteIds,
    });

    return NextResponse.json({ message: `${deleteIds.length} jadwal berhasil dihapus` });
  } catch (error) {
    console.error('Jadwal DELETE error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
