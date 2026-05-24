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

    let sql = `SELECT km.*, u.nama as guru_nama, u.nip as guru_nip, u.foto_profile as guru_foto,
      j.jam_ke, j.jam_mulai, j.jam_selesai,
      h.nama_hari, k.nama_kelas, m.nama_mapel, sk.nama_status,
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
      sql += ' AND j.kelas_id = ?';
      args.push(kelas_id);
    }
    if (search) {
      sql += ' AND (u.nama LIKE ? OR u.nip LIKE ?)';
      args.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY km.tanggal DESC, j.jam_ke ASC';

    const result = await turso.execute({ sql, args });
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('Kehadiran GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
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
    const foto_mengajar = (formData.get('foto_mengajar') as string) || null;
    const jumlah_hadir = parseInt(formData.get('jumlah_hadir') as string) || 0;
    const jumlah_izin_sakit = parseInt(formData.get('jumlah_izin_sakit') as string) || 0;
    const jumlah_alfa = parseInt(formData.get('jumlah_alfa') as string) || 0;
    const jumlah_siswa_total = parseInt(formData.get('jumlah_siswa_total') as string) || 0;
    const siswa_absen_json = (formData.get('siswa_absen_json') as string) || '{}';

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

    const id = uuidv4();
    await turso.execute({
      sql: `INSERT INTO kehadiran_mengajar (id, guru_id, jadwal_id, status_kehadiran_id, tanggal, materi_pembelajaran, foto_mengajar, jumlah_hadir, jumlah_izin_sakit, jumlah_alfa, jumlah_siswa_total, siswa_absen_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, guru_id, jadwal_id, status_kehadiran_id, tanggal, materi_pembelajaran, foto_mengajar, jumlah_hadir, jumlah_izin_sakit, jumlah_alfa, jumlah_siswa_total, siswa_absen_json],
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
    const foto_mengajar = (formData.get('foto_mengajar') as string) || null;
    const jumlah_hadir = parseInt(formData.get('jumlah_hadir') as string) || 0;
    const jumlah_izin_sakit = parseInt(formData.get('jumlah_izin_sakit') as string) || 0;
    const jumlah_alfa = parseInt(formData.get('jumlah_alfa') as string) || 0;
    const jumlah_siswa_total = parseInt(formData.get('jumlah_siswa_total') as string) || 0;
    const siswa_absen_json = (formData.get('siswa_absen_json') as string) || '{}';

    if (!id) return NextResponse.json({ error: 'ID kehadiran wajib diisi' }, { status: 400 });

    // Check ownership for guru
    if (payload.role === 'guru') {
      const existing = await turso.execute({
        sql: 'SELECT guru_id FROM kehadiran_mengajar WHERE id = ?',
        args: [id],
      });
      if (existing.rows.length === 0 || existing.rows[0].guru_id !== payload.userId) {
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

    const { id } = await req.json();

    if (payload.role === 'guru') {
      const existing = await turso.execute({
        sql: 'SELECT guru_id FROM kehadiran_mengajar WHERE id = ?',
        args: [id],
      });
      if (existing.rows.length === 0 || existing.rows[0].guru_id !== payload.userId) {
        return NextResponse.json({ error: 'Anda tidak memiliki akses' }, { status: 403 });
      }
    }

    await turso.execute({
      sql: 'DELETE FROM kehadiran_mengajar WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ message: 'Kehadiran berhasil dihapus' });
  } catch (error) {
    console.error('Kehadiran DELETE error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
