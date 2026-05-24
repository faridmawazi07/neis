import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

const turso = createClient({
  url: 'libsql://smknmaniis-1-ried-82.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk1MDM0NjMsImlkIjoiMDE5ZTUyYWItNjcwMS03Zjk4LWJkNDktOTIyYmI0Zjk5ZGI4IiwicmlkIjoiMTNiODk3MzQtZDM5YS00MDZhLTgwNzItYTBiNmJiZmU2MTUyIn0.eKpVbxXQBc3l7cYnDetQVp_9hiKanZRPTj98HurIDT_ll6HFM0f8B2BWHhfIBIXObHxrp04G3NFIruUtGJWbBQ',
});

async function reseed() {
  // Delete all data in reverse dependency order
  console.log('Cleaning old data...');
  await turso.execute('DELETE FROM kehadiran_mengajar');
  await turso.execute('DELETE FROM jadwal');
  await turso.execute('DELETE FROM siswa');
  await turso.execute('DELETE FROM hari_libur');
  await turso.execute('DELETE FROM status_kehadiran');
  await turso.execute('DELETE FROM mapel');
  await turso.execute('DELETE FROM kelas');
  await turso.execute('DELETE FROM hari');
  await turso.execute('DELETE FROM users');
  console.log('Old data cleaned');

  // Hash passwords
  const adminPw = await bcrypt.hash('admin123', 10);
  const guruPw = await bcrypt.hash('guru123', 10);
  const pegawaiPw = await bcrypt.hash('pegawai123', 10);
  const pimpinanPw = await bcrypt.hash('pimpinan123', 10);
  const pendingPw = await bcrypt.hash('pending123', 10);

  // Users
  console.log('Inserting users...');
  await turso.batch([
    { sql: `INSERT INTO users (id, nip, nama, password, role, status_persetujuan, jenis_kelamin, tanggal_lahir) VALUES ('u-admin', 'admin', 'Administrator', ?, 'admin', 'approved', NULL, NULL)`, args: [adminPw] },
    { sql: `INSERT INTO users (id, nip, nama, password, role, status_persetujuan, jenis_kelamin, tanggal_lahir) VALUES ('u-guru1', '198501012010011001', 'Budi Santoso', ?, 'guru', 'approved', 'Laki-laki', '1985-01-01')`, args: [guruPw] },
    { sql: `INSERT INTO users (id, nip, nama, password, role, status_persetujuan, jenis_kelamin, tanggal_lahir) VALUES ('u-guru2', '198602152011012002', 'Siti Rahayu', ?, 'guru', 'approved', 'Perempuan', '1986-02-15')`, args: [guruPw] },
    { sql: `INSERT INTO users (id, nip, nama, password, role, status_persetujuan, jenis_kelamin, tanggal_lahir) VALUES ('u-pegawai1', '199003202012011001', 'Ahmad Fauzi', ?, 'pegawai', 'approved', 'Laki-laki', '1990-03-20')`, args: [pegawaiPw] },
    { sql: `INSERT INTO users (id, nip, nama, password, role, status_persetujuan, jenis_kelamin, tanggal_lahir) VALUES ('u-pimpinan1', '197505102008011001', 'Dr. Hj. Rina Susanti, M.Pd', ?, 'pimpinan', 'approved', 'Perempuan', '1975-05-10')`, args: [pimpinanPw] },
    { sql: `INSERT INTO users (id, nip, nama, password, role, status_persetujuan, jenis_kelamin, tanggal_lahir) VALUES ('u-pending1', '199512082015022001', 'Dewi Lestari', ?, NULL, 'pending', 'Perempuan', '1995-12-08')`, args: [pendingPw] },
    { sql: `INSERT INTO users (id, nip, nama, password, role, status_persetujuan, jenis_kelamin, tanggal_lahir) VALUES ('u-pending2', '198809172013011001', 'Riko Pratama', ?, NULL, 'pending', 'Laki-laki', '1988-09-17')`, args: [pendingPw] },
  ]);

  // Hari
  await turso.batch([
    { sql: `INSERT INTO hari (id, nama_hari) VALUES ('h-1', 'Senin')`, args: [] },
    { sql: `INSERT INTO hari (id, nama_hari) VALUES ('h-2', 'Selasa')`, args: [] },
    { sql: `INSERT INTO hari (id, nama_hari) VALUES ('h-3', 'Rabu')`, args: [] },
    { sql: `INSERT INTO hari (id, nama_hari) VALUES ('h-4', 'Kamis')`, args: [] },
    { sql: `INSERT INTO hari (id, nama_hari) VALUES ('h-5', 'Jumat')`, args: [] },
  ]);

  // Kelas
  await turso.batch([
    { sql: `INSERT INTO kelas (id, nama_kelas) VALUES ('k-1', '12 RPL 1')`, args: [] },
    { sql: `INSERT INTO kelas (id, nama_kelas) VALUES ('k-2', '12 RPL 2')`, args: [] },
    { sql: `INSERT INTO kelas (id, nama_kelas) VALUES ('k-3', '12 TKJ 1')`, args: [] },
  ]);

  // Mapel
  await turso.batch([
    { sql: `INSERT INTO mapel (id, nama_mapel) VALUES ('m-1', 'Pemrograman Web')`, args: [] },
    { sql: `INSERT INTO mapel (id, nama_mapel) VALUES ('m-2', 'Basis Data')`, args: [] },
    { sql: `INSERT INTO mapel (id, nama_mapel) VALUES ('m-3', 'Administrasi Infrastruktur Jaringan')`, args: [] },
  ]);

  // Status Kehadiran
  await turso.batch([
    { sql: `INSERT INTO status_kehadiran (id, nama_status) VALUES ('sk-1', 'Hadir')`, args: [] },
    { sql: `INSERT INTO status_kehadiran (id, nama_status) VALUES ('sk-2', 'Izin')`, args: [] },
    { sql: `INSERT INTO status_kehadiran (id, nama_status) VALUES ('sk-3', 'Sakit')`, args: [] },
    { sql: `INSERT INTO status_kehadiran (id, nama_status) VALUES ('sk-4', 'Dinas Luar')`, args: [] },
  ]);

  // Hari Libur - this week's Wednesday
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const wed = new Date(today);
  wed.setDate(today.getDate() + mondayOffset + 2);
  const holidayDate = wed.toISOString().split('T')[0];
  await turso.execute({ sql: `INSERT INTO hari_libur (tanggal, keterangan) VALUES (?, ?)`, args: [holidayDate, 'Hari Libur Nasional - Simulasi Testing'] });

  // Siswa
  await turso.batch([
    { sql: `INSERT INTO siswa (id, nis, nisn, nama, kelas_id, jenis_kelamin) VALUES ('s-1', '2024001', '0012345001', 'Andi Pratama', 'k-1', 'Laki-laki')`, args: [] },
    { sql: `INSERT INTO siswa (id, nis, nisn, nama, kelas_id, jenis_kelamin) VALUES ('s-2', '2024002', '0012345002', 'Bunga Citra', 'k-1', 'Perempuan')`, args: [] },
    { sql: `INSERT INTO siswa (id, nis, nisn, nama, kelas_id, jenis_kelamin) VALUES ('s-3', '2024003', '0012345003', 'Cahya Nugraha', 'k-1', 'Laki-laki')`, args: [] },
    { sql: `INSERT INTO siswa (id, nis, nisn, nama, kelas_id, jenis_kelamin) VALUES ('s-4', '2024004', '0012345004', 'Dina Marlina', 'k-2', 'Perempuan')`, args: [] },
    { sql: `INSERT INTO siswa (id, nis, nisn, nama, kelas_id, jenis_kelamin) VALUES ('s-5', '2024005', '0012345005', 'Eko Saputra', 'k-2', 'Laki-laki')`, args: [] },
    { sql: `INSERT INTO siswa (id, nis, nisn, nama, kelas_id, jenis_kelamin) VALUES ('s-6', '2024006', '0012345006', 'Fitri Handayani', 'k-2', 'Perempuan')`, args: [] },
    { sql: `INSERT INTO siswa (id, nis, nisn, nama, kelas_id, jenis_kelamin) VALUES ('s-7', '2024007', '0012345007', 'Gilang Ramadhan', 'k-3', 'Laki-laki')`, args: [] },
    { sql: `INSERT INTO siswa (id, nis, nisn, nama, kelas_id, jenis_kelamin) VALUES ('s-8', '2024008', '0012345008', 'Hana Pertiwi', 'k-3', 'Perempuan')`, args: [] },
    { sql: `INSERT INTO siswa (id, nis, nisn, nama, kelas_id, jenis_kelamin) VALUES ('s-9', '2024009', '0012345009', 'Irfan Hakim', 'k-3', 'Laki-laki')`, args: [] },
  ]);

  // Jadwal - map to today's day
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const currentDayName = dayNames[today.getDay()];
  let hariId = 'h-1';
  if (currentDayName === 'Selasa') hariId = 'h-2';
  else if (currentDayName === 'Rabu') hariId = 'h-3';
  else if (currentDayName === 'Kamis') hariId = 'h-4';
  else if (currentDayName === 'Jumat') hariId = 'h-5';

  await turso.batch([
    { sql: `INSERT INTO jadwal (id, guru_id, hari_id, kelas_id, mapel_id, jam_ke, jam_mulai, jam_selesai) VALUES ('j-1', 'u-guru1', ?, 'k-1', 'm-1', 1, '07:00', '07:45')`, args: [hariId] },
    { sql: `INSERT INTO jadwal (id, guru_id, hari_id, kelas_id, mapel_id, jam_ke, jam_mulai, jam_selesai) VALUES ('j-2', 'u-guru1', ?, 'k-2', 'm-1', 2, '07:45', '08:30')`, args: [hariId] },
    { sql: `INSERT INTO jadwal (id, guru_id, hari_id, kelas_id, mapel_id, jam_ke, jam_mulai, jam_selesai) VALUES ('j-3', 'u-guru2', ?, 'k-3', 'm-2', 3, '08:30', '09:15')`, args: [hariId] },
    { sql: `INSERT INTO jadwal (id, guru_id, hari_id, kelas_id, mapel_id, jam_ke, jam_mulai, jam_selesai) VALUES ('j-4', 'u-guru2', ?, 'k-1', 'm-2', 4, '09:15', '10:00')`, args: [hariId] },
    { sql: `INSERT INTO jadwal (id, guru_id, hari_id, kelas_id, mapel_id, jam_ke, jam_mulai, jam_selesai) VALUES ('j-5', 'u-guru1', ?, 'k-3', 'm-3', 5, '10:15', '11:00')`, args: [hariId] },
  ]);

  console.log('Reseed complete!');
}

reseed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
