import { NextRequest, NextResponse } from 'next/server';
import { turso, initSchema, seedData } from '@/lib/turso';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    // Check if database has been seeded by checking for any users
    const result = await turso.execute('SELECT COUNT(*) as count FROM users');
    const count = result.rows[0].count as number;

    // Also check hari as another indicator
    const hariResult = await turso.execute('SELECT COUNT(*) as count FROM hari');
    const hariCount = hariResult.rows[0].count as number;

    return NextResponse.json({
      seeded: count > 0,
      stats: {
        users: count,
        hari: hariCount,
      },
    });
  } catch (error) {
    console.error('GET /api/seed error:', error);
    // If tables don't exist yet, schema needs to be initialized
    return NextResponse.json({
      seeded: false,
      error: 'Schema belum diinisialisasi',
    }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden - Hanya admin yang dapat menginisialisasi database' }, { status: 403 });
    }

    // Initialize schema
    await initSchema();

    // Seed data
    await seedData();

    return NextResponse.json({ message: 'Database berhasil diinisialisasi dan di-seed' });
  } catch (error) {
    console.error('POST /api/seed error:', error);
    return NextResponse.json({ error: 'Gagal menginisialisasi database' }, { status: 500 });
  }
}
