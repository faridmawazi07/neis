import { createClient, type Client } from '@libsql/client';

const globalForTurso = globalThis as unknown as {
  turso: Client | undefined;
};

const TURSO_URL = process.env.TURSO_URL || 'libsql://smknmaniis-1-ried-82.aws-ap-northeast-1.turso.io';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk1MDM0NjMsImlkIjoiMDE5ZTUyYWItNjcwMS03Zjk4LWJkNDktOTIyYmI0Zjk5ZGI4IiwicmlkIjoiMTNiODk3MzQtZDM5YS00MDZhLTgwNzItYTBiNmJiZmU2MTUyIn0.eKpVbxXQBc3l7cYnDetQVp_9hiKanZRPTj98HurIDT_ll6HFM0f8B2BWHhfIBIXObHxrp04G3NFIruUtGJWbBQ';

if (!process.env.TURSO_URL) {
  console.warn('[NEIS] ⚠️ TURSO_URL not set, using default. Set env var for production!');
}
if (!process.env.TURSO_AUTH_TOKEN) {
  console.warn('[NEIS] ⚠️ TURSO_AUTH_TOKEN not set, using default. Set env var for production!');
}

export const turso: Client =
  globalForTurso.turso ??
  createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== 'production') globalForTurso.turso = turso;

export async function initSchema() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nip TEXT UNIQUE,
      nama TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT NULL,
      status_persetujuan TEXT DEFAULT 'pending',
      foto_profile TEXT DEFAULT NULL,
      jenis_kelamin TEXT DEFAULT NULL,
      tanggal_lahir TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS hari (
      id TEXT PRIMARY KEY,
      nama_hari TEXT NOT NULL UNIQUE
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS kelas (
      id TEXT PRIMARY KEY,
      nama_kelas TEXT NOT NULL UNIQUE
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS mapel (
      id TEXT PRIMARY KEY,
      nama_mapel TEXT NOT NULL UNIQUE
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS status_kehadiran (
      id TEXT PRIMARY KEY,
      nama_status TEXT NOT NULL UNIQUE
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS hari_libur (
      tanggal TEXT PRIMARY KEY,
      keterangan TEXT NOT NULL
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS jadwal (
      id TEXT PRIMARY KEY,
      guru_id TEXT NOT NULL,
      hari_id TEXT NOT NULL,
      kelas_id TEXT NOT NULL,
      mapel_id TEXT NOT NULL,
      jam_ke INTEGER NOT NULL,
      jam_mulai TEXT NOT NULL,
      jam_selesai TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (guru_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (hari_id) REFERENCES hari(id),
      FOREIGN KEY (kelas_id) REFERENCES kelas(id),
      FOREIGN KEY (mapel_id) REFERENCES mapel(id)
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS siswa (
      id TEXT PRIMARY KEY,
      nis TEXT UNIQUE,
      nisn TEXT UNIQUE,
      nama TEXT NOT NULL,
      kelas_id TEXT DEFAULT NULL,
      jenis_kelamin TEXT DEFAULT NULL,
      status TEXT DEFAULT 'aktif',
      FOREIGN KEY (kelas_id) REFERENCES kelas(id)
    )
  `);

  // Migration: add status column if not exists
  try {
    const cols = await turso.execute("PRAGMA table_info(siswa)");
    const hasStatus = cols.rows.some((r: any) => r.name === 'status');
    if (!hasStatus) {
      await turso.execute("ALTER TABLE siswa ADD COLUMN status TEXT DEFAULT 'aktif'");
      console.log('Migration: added status column to siswa table');
    }
  } catch (e) {
    console.log('Migration check for siswa.status:', e);
  }

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS kehadiran_mengajar (
      id TEXT PRIMARY KEY,
      guru_id TEXT NOT NULL,
      jadwal_id TEXT NOT NULL,
      status_kehadiran_id TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      materi_pembelajaran TEXT DEFAULT '',
      foto_mengajar TEXT DEFAULT NULL,
      jumlah_hadir INTEGER DEFAULT 0,
      jumlah_izin_sakit INTEGER DEFAULT 0,
      jumlah_alfa INTEGER DEFAULT 0,
      jumlah_siswa_total INTEGER DEFAULT 0,
      siswa_absen_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (guru_id) REFERENCES users(id),
      FOREIGN KEY (jadwal_id) REFERENCES jadwal(id),
      FOREIGN KEY (status_kehadiran_id) REFERENCES status_kehadiran(id)
    )
  `);

  console.log('Database schema initialized successfully');
}

export async function seedData() {
  // Check if already seeded
  const existing = await turso.execute('SELECT COUNT(*) as count FROM users');
  if (existing.rows[0].count > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs');
  const adminPassword = await bcrypt.hash('admin123', 10);
  const guruPassword = await bcrypt.hash('guru123', 10);
  const pegawaiPassword = await bcrypt.hash('pegawai123', 10);
  const pimpinanPassword = await bcrypt.hash('pimpinan123', 10);
  const pendingPassword = await bcrypt.hash('pending123', 10);

  // Users
  await turso.execute(`
    INSERT INTO users (id, nip, nama, password, role, status_persetujuan, jenis_kelamin, tanggal_lahir) VALUES
    ('u-admin', 'admin', 'Administrator', '${adminPassword}', 'admin', 'approved', NULL, NULL),
    ('u-guru1', '198501012010011001', 'Budi Santoso', '${guruPassword}', 'guru', 'approved', 'Laki-laki', '1985-01-01'),
    ('u-guru2', '198602152011012002', 'Siti Rahayu', '${guruPassword}', 'guru', 'approved', 'Perempuan', '1986-02-15'),
    ('u-pegawai1', '199003202012011001', 'Ahmad Fauzi', '${pegawaiPassword}', 'pegawai', 'approved', 'Laki-laki', '1990-03-20'),
    ('u-pimpinan1', '197505102008011001', 'Dr. Hj. Rina Susanti, M.Pd', '${pimpinanPassword}', 'pimpinan', 'approved', 'Perempuan', '1975-05-10'),
    ('u-pending1', '199512082015022001', 'Dewi Lestari', '${pendingPassword}', NULL, 'pending', 'Perempuan', '1995-12-08'),
    ('u-pending2', '198809172013011001', 'Riko Pratama', '${pendingPassword}', NULL, 'pending', 'Laki-laki', '1988-09-17')
  `);

  // Hari
  await turso.execute(`
    INSERT INTO hari (id, nama_hari) VALUES
    ('h-1', 'Senin'),
    ('h-2', 'Selasa'),
    ('h-3', 'Rabu'),
    ('h-4', 'Kamis'),
    ('h-5', 'Jumat')
  `);

  // Kelas
  await turso.execute(`
    INSERT INTO kelas (id, nama_kelas) VALUES
    ('k-1', '12 RPL 1'),
    ('k-2', '12 RPL 2'),
    ('k-3', '12 TKJ 1')
  `);

  // Mapel
  await turso.execute(`
    INSERT INTO mapel (id, nama_mapel) VALUES
    ('m-1', 'Pemrograman Web'),
    ('m-2', 'Basis Data'),
    ('m-3', 'Administrasi Infrastruktur Jaringan')
  `);

  // Status Kehadiran
  await turso.execute(`
    INSERT INTO status_kehadiran (id, nama_status) VALUES
    ('sk-1', 'Hadir'),
    ('sk-2', 'Izin'),
    ('sk-3', 'Sakit'),
    ('sk-4', 'Dinas Luar')
  `);

  // Hari Libur - use current week
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const wednesday = new Date(today);
  wednesday.setDate(today.getDate() + mondayOffset + 2);
  const holidayDate = wednesday.toISOString().split('T')[0];

  await turso.execute(`
    INSERT INTO hari_libur (tanggal, keterangan) VALUES
    ('${holidayDate}', 'Hari Libur Nasional - Simulasi Testing')
  `);

  // Siswa
  await turso.execute(`
    INSERT INTO siswa (id, nis, nisn, nama, kelas_id, jenis_kelamin) VALUES
    ('s-1', '2024001', '0012345001', 'Andi Pratama', 'k-1', 'Laki-laki'),
    ('s-2', '2024002', '0012345002', 'Bunga Citra', 'k-1', 'Perempuan'),
    ('s-3', '2024003', '0012345003', 'Cahya Nugraha', 'k-1', 'Laki-laki'),
    ('s-4', '2024004', '0012345004', 'Dina Marlina', 'k-2', 'Perempuan'),
    ('s-5', '2024005', '0012345005', 'Eko Saputra', 'k-2', 'Laki-laki'),
    ('s-6', '2024006', '0012345006', 'Fitri Handayani', 'k-2', 'Perempuan'),
    ('s-7', '2024007', '0012345007', 'Gilang Ramadhan', 'k-3', 'Laki-laki'),
    ('s-8', '2024008', '0012345008', 'Hana Pertiwi', 'k-3', 'Perempuan'),
    ('s-9', '2024009', '0012345009', 'Irfan Hakim', 'k-3', 'Laki-laki')
  `);

  // Jadwal - map to current day names
  const currentDayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][today.getDay()];
  let hariId1 = 'h-1'; // Default Senin
  if (currentDayName === 'Selasa') hariId1 = 'h-2';
  else if (currentDayName === 'Rabu') hariId1 = 'h-3';
  else if (currentDayName === 'Kamis') hariId1 = 'h-4';
  else if (currentDayName === 'Jumat') hariId1 = 'h-5';

  await turso.execute(`
    INSERT INTO jadwal (id, guru_id, hari_id, kelas_id, mapel_id, jam_ke, jam_mulai, jam_selesai) VALUES
    ('j-1', 'u-guru1', '${hariId1}', 'k-1', 'm-1', 1, '07:00', '07:45'),
    ('j-2', 'u-guru1', '${hariId1}', 'k-2', 'm-1', 2, '07:45', '08:30'),
    ('j-3', 'u-guru2', '${hariId1}', 'k-3', 'm-2', 3, '08:30', '09:15')
  `);

  console.log('Database seeded successfully');
}
