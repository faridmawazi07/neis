import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    if (payload.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Export all tables as JSON
    const tables = ['users', 'hari', 'kelas', 'mapel', 'status_kehadiran', 'hari_libur', 'jadwal', 'siswa', 'kehadiran_mengajar'];
    const backup: Record<string, any[]> = {};

    for (const table of tables) {
      const result = await turso.execute(`SELECT * FROM ${table}`);
      backup[table] = result.rows.map(row => {
        const obj: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          obj[key] = value;
        }
        return obj;
      });
    }

    return NextResponse.json({ backup, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    if (payload.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { backup } = await req.json();
    if (!backup) return NextResponse.json({ error: 'Data backup tidak valid' }, { status: 400 });

    // Restore data - clear tables and re-insert
    const tables = ['kehadiran_mengajar', 'jadwal', 'siswa', 'hari_libur', 'status_kehadiran', 'mapel', 'kelas', 'hari', 'users'];

    for (const table of tables) {
      if (backup[table]) {
        await turso.execute(`DELETE FROM ${table}`);
        for (const row of backup[table]) {
          const columns = Object.keys(row);
          const values = Object.values(row);
          const placeholders = columns.map(() => '?').join(', ');
          await turso.execute({
            sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            args: values as any[],
          });
        }
      }
    }

    return NextResponse.json({ message: 'Database berhasil dipulihkan!' });
  } catch (error) {
    console.error('Restore error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
