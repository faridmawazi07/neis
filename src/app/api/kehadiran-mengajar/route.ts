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
    const tanggal = searchParams.get('tanggal');
    const tanggal_from = searchParams.get('tanggal_from');
    const tanggal_to = searchParams.get('tanggal_to');
    const kelas_id = searchParams.get('kelas_id');
    const search = searchParams.get('search');

    // Use COALESCE to prefer snapshot data (frozen at input time) over JOIN data
    // This ensures historical data is accurate even if jadwal is edited/deleted later
    let sql = `SELECT km.*,
      COALESCE(km.snapshot_guru_nama, u.nama) as guru_nama,
      COALESCE(km.snapshot_guru_nip, u.nip) as guru_nip,
      u.foto_profile as guru_foto,
      COALESCE(km.snapshot_jam_ke, j.jam_ke) as jam_ke,
      COALESCE(km.snapshot_jam_mulai, j.jam_mulai) as jam_mulai,
      COALESCE(km.snapshot_jam_selesai, j.jam_selesai) as jam_selesai,
      COALESCE(km.snapshot_hari, h.nama_hari) as nama_hari,
      COALESCE(km.snapshot_kelas, k.nama_kelas) as nama_kelas,
      COALESCE(km.snapshot_mapel, m.nama_mapel) as nama_mapel,
      sk.nama_status,
      km.siswa_absen_json
      FROM kehadiran_mengajar km
      LEFT JOIN users u ON km.guru_id = u.id
      LEFT JOIN jadwal j ON km.jadwal_id = j.id
      LEFT JOIN hari h ON j.hari_id = h.id
      LEFT JOIN kelas k ON j.kelas_id = k.id
      LEFT JOIN mapel m ON j.mapel_id = m.id
      LEFT JOIN status_kehadiran sk ON km.status_kehadiran_id = sk.id
      WHERE 1=1`;
    const args: any[] = [];

    if (guru_id) {
      sql += ' AND km.guru_id = ?';
      args.push(guru_id);
    }
    if (tanggal) {
      sql += ' AND km.tanggal = ?';
      args.push(tanggal);
    }
    if (tanggal_from) {
      sql += ' AND km.tanggal >= ?';
      args.push(tanggal_from);
    }
    if (tanggal_to) {
      sql += ' AND km.tanggal <= ?';
      args.push(tanggal_to);
    }
    if (kelas_id) {
      // For kelas_id filter, we need to check both snapshot and JOIN
      // since jadwal might be deleted (j.kelas_id would be NULL)
      sql += ' AND (j.kelas_id = ? OR (j.kelas_id IS NULL AND km.snapshot_kelas = (SELECT nama_kelas FROM kelas WHERE id = ?)))';
      args.push(kelas_id, kelas_id);
    }
    if (search) {
      sql += ' AND (u.nama LIKE ? OR u.nip LIKE ? OR km.snapshot_guru_nama LIKE ? OR km.snapshot_guru_nip LIKE ?)';
      args.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY km.tanggal DESC, km.snapshot_jam_ke ASC';

    const result = await turso.execute({ sql, args });
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('Kehadiran GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

/**
 * Get snapshot data for a jadwal at the time of kehadiran creation.
 * This "freezes" the jadwal data so changes later don't affect historical records.
 */
async function getSnapshotData(jadwalId: string, guruId: string): Promise<{
  snapshot_guru_nama: string;
  snapshot_guru_nip: string;
  snapshot_mapel: string;
  snapshot_kelas: string;
  snapshot_hari: string;
  snapshot_jam_ke: number;
  snapshot_jam_mulai: string;
  snapshot_jam_selesai: string;
}> {
  // Get guru name and NIP
  const guruResult = await turso.execute({
    sql: 'SELECT nama, nip FROM users WHERE id = ?',
    args: [guruId],
  });
  const guruNama = guruResult.rows[0]?.nama as string || '';
  const guruNip = guruResult.rows[0]?.nip as string || '';

  // Get jadwal info with joined names
  const jadwalResult = await turso.execute({
    sql: `SELECT j.jam_ke, j.jam_mulai, j.jam_selesai,
            h.nama_hari, k.nama_kelas, m.nama_mapel
          FROM jadwal j
          LEFT JOIN hari h ON j.hari_id = h.id
          LEFT JOIN kelas k ON j.kelas_id = k.id
          LEFT JOIN mapel m ON j.mapel_id = m.id
          WHERE j.id = ?`,
    args: [jadwalId],
  });

  const jadwalRow = jadwalResult.rows[0] || {};

  return {
    snapshot_guru_nama: guruNama,
    snapshot_guru_nip: guruNip,
    snapshot_mapel: jadwalRow.nama_mapel as string || '',
    snapshot_kelas: jadwalRow.nama_kelas as string || '',
    snapshot_hari: jadwalRow.nama_hari as string || '',
    snapshot_jam_ke: jadwalRow.jam_ke as number || 0,
    snapshot_jam_mulai: jadwalRow.jam_mulai as string || '',
    snapshot_jam_selesai: jadwalRow.jam_selesai as string || '',
  };
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });

    // Pegawai and Pimpinan CANNOT create kehadiran
    if (payload.role === 'pegawai' || payload.role === 'pimpinan') {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengisi kehadiran mengajar' }, { status: 403 });
    }

    const formData = await req.formData();
    const jadwal_id = formData.get('jadwal_id') as string;
    const status_kehadiran_id = formData.get('status_kehadiran_id') as string;
    const tanggal = formData.get('tanggal') as string;
    const materi_pembelajaran = (formData.get('materi_pembelajaran') as string) || '';
    const foto_mengajar_raw = (formData.get('foto_mengajar') as string) || null;
    const jumlah_hadir = parseInt(formData.get('jumlah_hadir') as string) || 0;
    const jumlah_izin_sakit = parseInt(formData.get('jumlah_izin_sakit') as string) || 0;
    const jumlah_alfa = parseInt(formData.get('jumlah_alfa') as string) || 0;
    const jumlah_siswa_total = parseInt(formData.get('jumlah_siswa_total') as string) || 0;
    const siswa_absen_json = (formData.get('siswa_absen_json') as string) || '{}';

    // Upload foto_mengajar to Cloudinary (dynamic import)
    let foto_mengajar: string | null = null;
    if (foto_mengajar_raw) {
      try {
        const { uploadImage } = await import('@/lib/cloudinary');
        foto_mengajar = await uploadImage(foto_mengajar_raw, 'neis/kehadiran');
      } catch {
        foto_mengajar = foto_mengajar_raw;
      }
    }

    // Determine guru_id
    const guru_id = payload.role === 'admin' ? (formData.get('guru_id') as string) : payload.userId;

    if (!jadwal_id || !status_kehadiran_id || !tanggal) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 });
    }

    // Time validation for guru (not admin)
    if (payload.role === 'guru') {
      const now = new Date();
      const jakartaOffset = 7 * 60; // WIB is UTC+7
      const jakartaTime = new Date(now.getTime() + (jakartaOffset + now.getTimezoneOffset()) * 60000);
      const dayOfWeek = jakartaTime.getDay();
      const hours = jakartaTime.getHours();
      const minutes = jakartaTime.getMinutes();
      const currentTime = hours * 60 + minutes;

      // Only Monday-Friday (1-5), 06:00-20:00 WIB
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return NextResponse.json({ error: 'Kehadiran hanya bisa diisi pada hari kerja (Senin-Jumat)' }, { status: 403 });
      }
      if (currentTime < 360 || currentTime > 1200) { // 06:00 = 360 min, 20:00 = 1200 min
        return NextResponse.json({ error: 'Kehadiran hanya bisa diisi pada pukul 06:00 - 20:00 WIB' }, { status: 403 });
      }

      // Check if today is a holiday
      const holiday = await turso.execute({
        sql: 'SELECT * FROM hari_libur WHERE tanggal = ?',
        args: [tanggal],
      });
      if (holiday.rows.length > 0) {
        return NextResponse.json({ error: 'Hari ini adalah hari libur. Tidak bisa mengisi kehadiran.' }, { status: 403 });
      }

      // Guru can only input for today
      const todayStr = jakartaTime.toISOString().split('T')[0];
      if (tanggal !== todayStr) {
        return NextResponse.json({ error: 'Anda hanya bisa mengisi kehadiran untuk hari ini' }, { status: 403 });
      }
    }

    // Check for duplicate kehadiran on same jadwal + tanggal
    const existing = await turso.execute({
      sql: 'SELECT id FROM kehadiran_mengajar WHERE jadwal_id = ? AND tanggal = ?',
      args: [jadwal_id, tanggal],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Kehadiran untuk jadwal dan tanggal ini sudah diisi' }, { status: 409 });
    }

    // Get snapshot data at the time of creation
    const snapshot = await getSnapshotData(jadwal_id, guru_id);

    const id = uuidv4();
    await turso.execute({
      sql: `INSERT INTO kehadiran_mengajar (id, guru_id, jadwal_id, status_kehadiran_id, tanggal, materi_pembelajaran, foto_mengajar, jumlah_hadir, jumlah_izin_sakit, jumlah_alfa, jumlah_siswa_total, siswa_absen_json, snapshot_guru_nama, snapshot_guru_nip, snapshot_mapel, snapshot_kelas, snapshot_hari, snapshot_jam_ke, snapshot_jam_mulai, snapshot_jam_selesai)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, guru_id, jadwal_id, status_kehadiran_id, tanggal, materi_pembelajaran, foto_mengajar, jumlah_hadir, jumlah_izin_sakit, jumlah_alfa, jumlah_siswa_total, siswa_absen_json, 
        snapshot.snapshot_guru_nama, snapshot.snapshot_guru_nip, snapshot.snapshot_mapel, snapshot.snapshot_kelas, snapshot.snapshot_hari, snapshot.snapshot_jam_ke, snapshot.snapshot_jam_mulai, snapshot.snapshot_jam_selesai],
    });

    return NextResponse.json({ message: 'Kehadiran berhasil disimpan', id });
  } catch (error) {
    console.error('Kehadiran POST error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });

    // Pegawai and Pimpinan CANNOT edit kehadiran
    if (payload.role === 'pegawai' || payload.role === 'pimpinan') {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengedit kehadiran mengajar' }, { status: 403 });
    }

    const formData = await req.formData();
    const id = formData.get('id') as string;
    const status_kehadiran_id = formData.get('status_kehadiran_id') as string;
    const tanggal = formData.get('tanggal') as string;
    const materi_pembelajaran = (formData.get('materi_pembelajaran') as string) || '';
    const foto_mengajar_raw = (formData.get('foto_mengajar') as string) || null;
    const jumlah_hadir = parseInt(formData.get('jumlah_hadir') as string) || 0;
    const jumlah_izin_sakit = parseInt(formData.get('jumlah_izin_sakit') as string) || 0;
    const jumlah_alfa = parseInt(formData.get('jumlah_alfa') as string) || 0;
    const jumlah_siswa_total = parseInt(formData.get('jumlah_siswa_total') as string) || 0;
    const siswa_absen_json = (formData.get('siswa_absen_json') as string) || '{}';

    if (!id) return NextResponse.json({ error: 'ID kehadiran wajib diisi' }, { status: 400 });

    // Get existing record for ownership check and old photo
    const existingRecord = await turso.execute({
      sql: 'SELECT guru_id, foto_mengajar FROM kehadiran_mengajar WHERE id = ?',
      args: [id],
    });
    if (existingRecord.rows.length === 0) {
      return NextResponse.json({ error: 'Data kehadiran tidak ditemukan' }, { status: 404 });
    }

    const oldFotoMengajar = existingRecord.rows[0].foto_mengajar as string | null;

    // Check ownership for guru
    if (payload.role === 'guru') {
      if (existingRecord.rows[0].guru_id !== payload.userId) {
        return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengedit kehadiran ini' }, { status: 403 });
      }

      // Time validation for guru edit
      const now = new Date();
      const jakartaOffset = 7 * 60;
      const jakartaTime = new Date(now.getTime() + (jakartaOffset + now.getTimezoneOffset()) * 60000);
      const dayOfWeek = jakartaTime.getDay();
      const hours = jakartaTime.getHours();
      const currentTime = hours * 60 + jakartaTime.getMinutes();

      if (dayOfWeek === 0 || dayOfWeek === 6 || currentTime < 360 || currentTime > 1200) {
        return NextResponse.json({ error: 'Kehadiran hanya bisa diedit pada hari kerja pukul 06:00-20:00 WIB' }, { status: 403 });
      }
    }

    // Upload foto_mengajar to Cloudinary (dynamic import)
    let foto_mengajar: string | null = null;
    let shouldDeleteOldFoto = false;
    if (foto_mengajar_raw) {
      try {
        const { uploadImage } = await import('@/lib/cloudinary');
        foto_mengajar = await uploadImage(foto_mengajar_raw, 'neis/kehadiran');
        // Mark old photo for deletion if new upload succeeded and old was on Cloudinary
        if (oldFotoMengajar && oldFotoMengajar.includes('cloudinary.com') && foto_mengajar !== oldFotoMengajar) {
          shouldDeleteOldFoto = true;
        }
      } catch {
        foto_mengajar = foto_mengajar_raw;
      }
    }

    // Build update query - only update provided fields
    let updateSql = `UPDATE kehadiran_mengajar SET 
      status_kehadiran_id = ?, materi_pembelajaran = ?, jumlah_hadir = ?, 
      jumlah_izin_sakit = ?, jumlah_alfa = ?, jumlah_siswa_total = ?, siswa_absen_json = ?,
      updated_at = datetime('now')`;
    const updateArgs: any[] = [status_kehadiran_id, materi_pembelajaran, jumlah_hadir, jumlah_izin_sakit, jumlah_alfa, jumlah_siswa_total, siswa_absen_json];

    if (foto_mengajar) {
      updateSql += ', foto_mengajar = ?';
      updateArgs.push(foto_mengajar);
    }

    if (tanggal && payload.role === 'admin') {
      updateSql += ', tanggal = ?';
      updateArgs.push(tanggal);
    }

    updateSql += ' WHERE id = ?';
    updateArgs.push(id);

    await turso.execute({ sql: updateSql, args: updateArgs });

    // Delete old photo from Cloudinary AFTER DB update succeeds
    if (shouldDeleteOldFoto && oldFotoMengajar) {
      try {
        const { deleteFromCloudinary } = await import('@/lib/cloudinary');
        await deleteFromCloudinary(oldFotoMengajar);
      } catch (e) {
        console.error('Failed to delete old kehadiran photo from Cloudinary:', e);
      }
    }

    return NextResponse.json({ message: 'Kehadiran berhasil diubah' });
  } catch (error) {
    console.error('Kehadiran PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });

    if (payload.role !== 'admin' && payload.role !== 'guru') {
      return NextResponse.json({ error: 'Anda tidak memiliki akses' }, { status: 403 });
    }

    const body = await req.json();
    const { id, ids } = body;

    // Bulk delete (admin only)
    if (ids && Array.isArray(ids) && ids.length > 0) {
      if (payload.role !== 'admin') {
        return NextResponse.json({ error: 'Hanya admin yang dapat menghapus beberapa kehadiran sekaligus' }, { status: 403 });
      }

      // Validate all IDs exist
      const placeholders = ids.map(() => '?').join(',');
      const existing = await turso.execute({
        sql: `SELECT id, foto_mengajar FROM kehadiran_mengajar WHERE id IN (${placeholders})`,
        args: ids,
      });
      if (existing.rows.length !== ids.length) {
        return NextResponse.json({ error: 'Beberapa data kehadiran tidak ditemukan' }, { status: 404 });
      }

      await turso.execute({
        sql: `DELETE FROM kehadiran_mengajar WHERE id IN (${placeholders})`,
        args: ids,
      });

      // Delete Cloudinary photos for bulk deleted records
      const cloudinaryPhotos = existing.rows
        .map(r => r.foto_mengajar as string)
        .filter((url): url is string => !!(url && url.includes('cloudinary.com')));
      if (cloudinaryPhotos.length > 0) {
        try {
          const { deleteFromCloudinary } = await import('@/lib/cloudinary');
          await Promise.allSettled(cloudinaryPhotos.map(url => deleteFromCloudinary(url)));
        } catch (e) {
          console.error('Failed to delete some kehadiran photos from Cloudinary:', e);
        }
      }

      return NextResponse.json({ message: `${ids.length} data kehadiran berhasil dihapus` });
    }

    // Single delete
    if (!id) {
      return NextResponse.json({ error: 'ID kehadiran wajib diisi' }, { status: 400 });
    }

    // Get existing record for photo cleanup
    const existingRecord = await turso.execute({
      sql: 'SELECT guru_id, foto_mengajar FROM kehadiran_mengajar WHERE id = ?',
      args: [id],
    });
    if (existingRecord.rows.length === 0) {
      return NextResponse.json({ error: 'Data kehadiran tidak ditemukan' }, { status: 404 });
    }

    if (payload.role === 'guru') {
      if (existingRecord.rows[0].guru_id !== payload.userId) {
        return NextResponse.json({ error: 'Anda tidak memiliki akses' }, { status: 403 });
      }
    }

    const fotoToDelete = existingRecord.rows[0].foto_mengajar as string | null;

    await turso.execute({
      sql: 'DELETE FROM kehadiran_mengajar WHERE id = ?',
      args: [id],
    });

    // Delete photo from Cloudinary AFTER DB delete succeeds
    if (fotoToDelete && fotoToDelete.includes('cloudinary.com')) {
      try {
        const { deleteFromCloudinary } = await import('@/lib/cloudinary');
        await deleteFromCloudinary(fotoToDelete);
      } catch (e) {
        console.error('Failed to delete kehadiran photo from Cloudinary:', e);
      }
    }

    return NextResponse.json({ message: 'Kehadiran berhasil dihapus' });
  } catch (error) {
    console.error('Kehadiran DELETE error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
