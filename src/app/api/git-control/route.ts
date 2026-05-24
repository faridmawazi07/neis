import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });

    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat mengakses fitur ini' }, { status: 403 });
    }

    const { action } = await req.json();

    if (action === 'push') {
      try {
        // Git push to GitHub
        await execAsync('git add .', { cwd: '/home/z/my-project' });
        try {
          await execAsync('git commit -m "chore: manual code backup by admin"', { cwd: '/home/z/my-project' });
        } catch (e: any) {
          if (!e.message?.includes('nothing to commit')) throw e;
        }
        await execAsync('git push -u origin main', { cwd: '/home/z/my-project', timeout: 60000 });
        return NextResponse.json({ message: 'Kode berhasil disimpan ke GitHub!' });
      } catch (error: any) {
        return NextResponse.json({ error: `Gagal push ke GitHub: ${error.message}` }, { status: 500 });
      }
    } else if (action === 'pull') {
      try {
        await execAsync('git fetch --all', { cwd: '/home/z/my-project', timeout: 60000 });
        await execAsync('git reset --hard origin/main', { cwd: '/home/z/my-project' });
        return NextResponse.json({ message: 'Kode berhasil diambil dari GitHub!' });
      } catch (error: any) {
        return NextResponse.json({ error: `Gagal pull dari GitHub: ${error.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error) {
    console.error('Git control error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
