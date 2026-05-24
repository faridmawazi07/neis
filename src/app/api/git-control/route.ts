import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PROJECT_DIR = '/home/z/my-project';
const GITHUB_PAT = process.env.NEIS_GITHUB_PAT || '';
const GITHUB_USER = 'faridmawazi07';
const GITHUB_REPO = 'faridmawazi07/neis.git';
const AUTO_PUSH_SECRET = 'neis-internal-auto-push';

// Shared push function used by both manual and auto-push
async function pushToGitHub(commitMessage: string = 'chore: auto backup by NEIS'): Promise<{ success: boolean; message: string; hadChanges: boolean }> {
  if (!GITHUB_PAT) {
    return { success: false, message: 'GitHub PAT belum dikonfigurasi di server', hadChanges: false };
  }

  try {
    await execAsync('git add .', { cwd: PROJECT_DIR });

    let hadChanges = false;
    try {
      const { stdout } = await execAsync('git diff --cached --stat', { cwd: PROJECT_DIR });
      if (stdout.trim()) {
        hadChanges = true;
        await execAsync(`git commit -m "${commitMessage}"`, { cwd: PROJECT_DIR });
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

    return { success: true, message: hadChanges ? 'Kode berhasil disimpan ke GitHub!' : 'Tidak ada perubahan baru. Status sudah sinkron.', hadChanges };
  } catch (error: any) {
    // Ensure we always reset the URL even on error
    try {
      await execAsync(`git remote set-url origin https://github.com/${GITHUB_REPO}`, { cwd: PROJECT_DIR });
    } catch {}
    return { success: false, message: `Gagal push ke GitHub: ${error.message}`, hadChanges: false };
  }
}

// In-memory auto-push state
let autoPushEnabled = true;
let lastAutoPushTime: string | null = null;
let lastAutoPushStatus: 'success' | 'failed' | 'no_changes' | null = null;
let autoPushIntervalMinutes = 5;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Auto-push trigger can be called by internal service with secret header
    const isAutoPushInternal = req.headers.get('X-Auto-Push') === 'true' &&
                                req.headers.get('Authorization')?.replace('Bearer ', '') === AUTO_PUSH_SECRET;

    if (action === 'auto-push-trigger') {
      // Internal auto-push from cron service - uses secret header instead of JWT
      if (!isAutoPushInternal) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!autoPushEnabled) {
        return NextResponse.json({ message: 'Auto-push dinonaktifkan', skipped: true });
      }
      const timestamp = new Date().toISOString();
      const result = await pushToGitHub(`chore: auto backup ${timestamp}`);
      lastAutoPushTime = timestamp;
      lastAutoPushStatus = result.success ? (result.hadChanges ? 'success' : 'no_changes') : 'failed';
      return NextResponse.json({ message: result.message, hadChanges: result.hadChanges });
    }

    // All other actions require admin JWT auth
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });

    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat mengakses fitur ini' }, { status: 403 });
    }

    if (action === 'push') {
      const result = await pushToGitHub('chore: manual backup by Admin');
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 500 });
      }
      return NextResponse.json({ message: result.message, hadChanges: result.hadChanges });
    } else if (action === 'pull') {
      if (!GITHUB_PAT) {
        return NextResponse.json({ error: 'GitHub PAT belum dikonfigurasi di server' }, { status: 500 });
      }
      try {
        const authUrl = `https://${GITHUB_USER}:${GITHUB_PAT}@github.com/${GITHUB_REPO}`;
        await execAsync(`git remote set-url origin "${authUrl}"`, { cwd: PROJECT_DIR });

        try {
          await execAsync('git fetch --all', { cwd: PROJECT_DIR, timeout: 60000 });
          await execAsync('git reset --hard origin/main', { cwd: PROJECT_DIR });
        } finally {
          await execAsync(`git remote set-url origin https://github.com/${GITHUB_REPO}`, { cwd: PROJECT_DIR });
        }

        return NextResponse.json({ message: 'Kode berhasil diambil dari GitHub!' });
      } catch (error: any) {
        try {
          await execAsync(`git remote set-url origin https://github.com/${GITHUB_REPO}`, { cwd: PROJECT_DIR });
        } catch {}
        return NextResponse.json({ error: `Gagal pull dari GitHub: ${error.message}` }, { status: 500 });
      }
    } else if (action === 'auto-push-status') {
      return NextResponse.json({
        enabled: autoPushEnabled,
        intervalMinutes: autoPushIntervalMinutes,
        lastAutoPushTime,
        lastAutoPushStatus,
      });
    } else if (action === 'auto-push-toggle') {
      autoPushEnabled = body.enabled ?? !autoPushEnabled;
      return NextResponse.json({
        enabled: autoPushEnabled,
        message: autoPushEnabled ? 'Auto-push diaktifkan' : 'Auto-push dinonaktifkan',
      });
    } else if (action === 'auto-push-interval') {
      const newInterval = body.intervalMinutes;
      if (newInterval && newInterval >= 1 && newInterval <= 60) {
        autoPushIntervalMinutes = newInterval;
        return NextResponse.json({ intervalMinutes: autoPushIntervalMinutes, message: `Interval auto-push diubah ke ${autoPushIntervalMinutes} menit` });
      }
      return NextResponse.json({ error: 'Interval harus antara 1-60 menit' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error) {
    console.error('Git control error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
