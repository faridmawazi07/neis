import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PROJECT_DIR = '/home/z/my-project';
const GITHUB_PAT = process.env.NEIS_GITHUB_PAT || '';
const GITHUB_USER = 'faridmawazi07';
const GITHUB_REPO = 'faridmawazi07/neis.git';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });

    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat mengakses fitur ini' }, { status: 403 });
    }

    if (!GITHUB_PAT) {
      return NextResponse.json({ error: 'GitHub PAT belum dikonfigurasi di server' }, { status: 500 });
    }

    const { action } = await req.json();

    if (action === 'push') {
      try {
        await execAsync('git add .', { cwd: PROJECT_DIR });
        try {
          const { stdout } = await execAsync('git diff --cached --stat', { cwd: PROJECT_DIR });
          if (stdout.trim()) {
            await execAsync('git commit -m "chore: auto backup by NEIS"', { cwd: PROJECT_DIR });
          }
        } catch {
          // commit might fail if nothing to commit, that's fine
        }

        // Set remote URL with PAT for authentication
        const authUrl = `https://${GITHUB_USER}:${GITHUB_PAT}@github.com/${GITHUB_REPO}`;
        await execAsync(`git remote set-url origin "${authUrl}"`, { cwd: PROJECT_DIR });

        try {
          await execAsync('git push -u origin main', { cwd: PROJECT_DIR, timeout: 60000 });
        } finally {
          // Reset remote URL to remove PAT from visible config
          await execAsync(`git remote set-url origin https://github.com/${GITHUB_REPO}`, { cwd: PROJECT_DIR });
        }

        return NextResponse.json({ message: 'Kode berhasil disimpan ke GitHub!' });
      } catch (error: any) {
        // Ensure we always reset the URL even on error
        try {
          await execAsync(`git remote set-url origin https://github.com/${GITHUB_REPO}`, { cwd: PROJECT_DIR });
        } catch {}
        return NextResponse.json({ error: `Gagal push ke GitHub: ${error.message}` }, { status: 500 });
      }
    } else if (action === 'pull') {
      try {
        // Set remote URL with PAT for authentication
        const authUrl = `https://${GITHUB_USER}:${GITHUB_PAT}@github.com/${GITHUB_REPO}`;
        await execAsync(`git remote set-url origin "${authUrl}"`, { cwd: PROJECT_DIR });

        try {
          await execAsync('git fetch --all', { cwd: PROJECT_DIR, timeout: 60000 });
          await execAsync('git reset --hard origin/main', { cwd: PROJECT_DIR });
        } finally {
          // Reset remote URL
          await execAsync(`git remote set-url origin https://github.com/${GITHUB_REPO}`, { cwd: PROJECT_DIR });
        }

        return NextResponse.json({ message: 'Kode berhasil diambil dari GitHub!' });
      } catch (error: any) {
        try {
          await execAsync(`git remote set-url origin https://github.com/${GITHUB_REPO}`, { cwd: PROJECT_DIR });
        } catch {}
        return NextResponse.json({ error: `Gagal pull dari GitHub: ${error.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error) {
    console.error('Git control error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
