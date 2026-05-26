import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tanggal = searchParams.get('tanggal') || new Date().toISOString().split('T')[0];

    // Get current day name in Indonesian
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dateObj = new Date(tanggal + 'T00:00:00');
    const dayName = dayNames[dateObj.getDay()];

    // Get hari_id for the day
    const hariResult = await turso.execute({
      sql: 'SELECT id FROM hari WHERE nama_hari = ?',
      args: [dayName],
    });
    const hari_id = hariResult.rows.length > 0 ? hariResult.rows[0].id : null;

    // Count stats
    const totalGuru = await turso.execute("SELECT COUNT(*) as count FROM users WHERE role = 'guru' AND status_persetujuan = 'approved'");
    const totalPegawai = await turso.execute("SELECT COUNT(*) as count FROM users WHERE role = 'pegawai' AND status_persetujuan = 'approved'");
    const pendingCount = await turso.execute("SELECT COUNT(*) as count FROM users WHERE status_persetujuan = 'pending'");

    // Kehadiran hari ini count
    let kehadiranHariIni = { rows: [{ count: 0 }] };
    if (hari_id) {
      kehadiranHariIni = await turso.execute({
        sql: `SELECT COUNT(*) as count FROM kehadiran_mengajar WHERE tanggal = ?`,
        args: [tanggal],
      });
    }

    // Check if today is holiday
    const holiday = await turso.execute({
      sql: 'SELECT * FROM hari_libur WHERE tanggal = ?',
      args: [tanggal],
    });

    // Get jadwal for the day
    let jadwalData: any[] = [];
    if (hari_id) {
      let jadwalSql = `SELECT j.*, u.nama as guru_nama, h.nama_hari, k.nama_kelas, m.nama_mapel,
        (SELECT COUNT(*) FROM kehadiran_mengajar km WHERE km.jadwal_id = j.id AND km.tanggal = ?) as sudah_mengajar
        FROM jadwal j
        LEFT JOIN users u ON j.guru_id = u.id
        LEFT JOIN hari h ON j.hari_id = h.id
        LEFT JOIN kelas k ON j.kelas_id = k.id
        LEFT JOIN mapel m ON j.mapel_id = m.id
        WHERE j.hari_id = ?`;
      const jadwalArgs: any[] = [tanggal, hari_id];

      // If guru, only show their jadwal
      if (payload.role === 'guru') {
        jadwalSql += ' AND j.guru_id = ?';
        jadwalArgs.push(payload.userId);
      }

      jadwalSql += ' ORDER BY j.jam_ke ASC';
      const jadwalResult = await turso.execute({ sql: jadwalSql, args: jadwalArgs });
      jadwalData = jadwalResult.rows;
    }

    // Get available jam_ke options for the day (from kehadiran_mengajar)
    let jamKeOptions: string[] = [];
    const jamKeResult = await turso.execute({
      sql: `SELECT DISTINCT j.jam_ke FROM kehadiran_mengajar km
        LEFT JOIN jadwal j ON km.jadwal_id = j.id
        WHERE km.tanggal = ?
        ORDER BY j.jam_ke ASC`,
      args: [tanggal],
    });
    jamKeOptions = jamKeResult.rows.map((r: any) => String(r.jam_ke));

    // Get kehadiran siswa for the day, filtered by jam_ke if specified
    const jamKeParam = searchParams.get('jam_ke') || '';
    let kehadiranSiswa: any[] = [];
    if (jamKeParam) {
      // Filter by specific jam_ke — no need for MAX, each kelas has one record per jam_ke
      const kehadiranSiswaResult = await turso.execute({
        sql: `SELECT j.kelas_id, k.nama_kelas,
          km.jumlah_hadir, km.jumlah_izin_sakit, km.jumlah_alfa,
          km.jumlah_siswa_total, km.siswa_absen_json
          FROM kehadiran_mengajar km
          LEFT JOIN jadwal j ON km.jadwal_id = j.id
          LEFT JOIN kelas k ON j.kelas_id = k.id
          WHERE km.tanggal = ? AND j.jam_ke = ?
          ORDER BY k.nama_kelas ASC`,
        args: [tanggal, jamKeParam],
      });
      kehadiranSiswa = kehadiranSiswaResult.rows;
    } else {
      // No jam_ke filter — show all, aggregate by kelas using MAX (fallback)
      const kehadiranSiswaResult = await turso.execute({
        sql: `SELECT j.kelas_id, k.nama_kelas,
          MAX(km.jumlah_hadir) as jumlah_hadir,
          MAX(km.jumlah_izin_sakit) as jumlah_izin_sakit,
          MAX(km.jumlah_alfa) as jumlah_alfa,
          MAX(km.jumlah_siswa_total) as jumlah_siswa_total,
          MAX(km.siswa_absen_json) as siswa_absen_json
          FROM kehadiran_mengajar km
          LEFT JOIN jadwal j ON km.jadwal_id = j.id
          LEFT JOIN kelas k ON j.kelas_id = k.id
          WHERE km.tanggal = ?
          GROUP BY j.kelas_id
          ORDER BY k.nama_kelas ASC`,
        args: [tanggal],
      });
      kehadiranSiswa = kehadiranSiswaResult.rows;
    }

    // Monthly attendance count for guru
    let kehadiranBulanIni = 0;
    if (payload.role === 'guru') {
      const monthStart = tanggal.substring(0, 7) + '-01';
      const monthResult = await turso.execute({
        sql: `SELECT COUNT(*) as count FROM kehadiran_mengajar WHERE guru_id = ? AND tanggal >= ? AND tanggal <= ?`,
        args: [payload.userId, monthStart, tanggal],
      });
      kehadiranBulanIni = Number(monthResult.rows[0].count);
    }

    // Get pending users for pegawai/pimpinan/admin
    let pendingUsers: any[] = [];
    if (payload.role === 'admin' || payload.role === 'pegawai' || payload.role === 'pimpinan') {
      const pendingResult = await turso.execute(
        `SELECT id, nip, nama, role, foto_profile, jenis_kelamin, created_at FROM users WHERE status_persetujuan = 'pending' ORDER BY created_at ASC`
      );
      pendingUsers = pendingResult.rows;
    }

    return NextResponse.json({
      stats: {
        totalGuru: Number(totalGuru.rows[0].count),
        totalPegawai: Number(totalPegawai.rows[0].count),
        pendingCount: Number(pendingCount.rows[0].count),
        kehadiranHariIni: Number(kehadiranHariIni.rows[0].count),
        kehadiranBulanIni,
      },
      hari_id,
      dayName,
      isHoliday: holiday.rows.length > 0,
      holidayInfo: holiday.rows.length > 0 ? holiday.rows[0] : null,
      jadwal: jadwalData,
      kehadiranSiswa,
      jamKeOptions,
      pendingUsers,
    });
  } catch (error) {
    console.error('Dashboard GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
