import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const execAsync = promisify(exec);

const PROJECT_DIR = '/home/z/my-project';
const GITHUB_USER = 'faridmawazi07';
const GITHUB_REPO = 'faridmawazi07/neis.git';
const AUTO_PUSH_SECRET = 'neis-internal-auto-push';
const COMMIT_TRACK_FILE = '/home/z/my-project/.neis-last-push-commit';
const NEIS_ENV_FILE = '/home/z/my-project/.neis.env';

// Load PAT from env var first, then fallback to .neis.env file (survives sandbox reset)
function getGitHubPAT(): string {
  if (process.env.NEIS_GITHUB_PAT) return process.env.NEIS_GITHUB_PAT;
  try {
    if (existsSync(NEIS_ENV_FILE)) {
      const content = readFileSync(NEIS_ENV_FILE, 'utf-8');
      // Try direct PAT
      const directMatch = content.match(/NEIS_GITHUB_PAT=(.+)/);
      if (directMatch) return directMatch[1].trim();
      // Try base64 encoded PAT
      const b64Match = content.match(/NEIS_GITHUB_PAT_B64=(.+)/);
      if (b64Match) return Buffer.from(b64Match[1].trim(), 'base64').toString('utf-8');
      // Try split parts (NEIS_GH_P1 + P2 + P3)
      const p1 = content.match(/NEIS_GH_P1=(.+)/);
      const p2 = content.match(/NEIS_GH_P2=(.+)/);
      const p3 = content.match(/NEIS_GH_P3=(.+)/);
      if (p1 && p2 && p3) return p1[1].trim() + p2[1].trim() + p3[1].trim();
    }
  } catch {}
  return '';
}
const GITHUB_PAT = getGitHubPAT();

// ========== SANDBOX RESET DETECTION ==========
// 
// How it works:
// 1. After each successful push, we save the latest commit hash to a file
// 2. Before each push (auto or manual), we check:
//    a. Fetch latest from GitHub
//    b. Compare local HEAD with remote HEAD
//    c. If local is BEHIND remote (local missing commits that GitHub has),
//       it means either:
//       - Sandbox was reset → local lost commits → DANGER! Don't push!
//       - Someone pushed from elsewhere → need to pull first
//    d. If the saved commit hash no longer exists in local history,
//       it DEFINITELY means sandbox was reset → BLOCK push!
//
// This prevents a reset sandbox from destroying GitHub backup data.

function getLastPushedCommit(): string | null {
  try {
    if (existsSync(COMMIT_TRACK_FILE)) {
      return readFileSync(COMMIT_TRACK_FILE, 'utf-8').trim();
    }
  } catch {}
  return null;
}

function saveLastPushedCommit(commitHash: string): void {
  try {
    writeFileSync(COMMIT_TRACK_FILE, commitHash, 'utf-8');
  } catch {}
}

async function getCurrentLocalCommit(): Promise<string> {
  const { stdout } = await execAsync('git rev-parse HEAD', { cwd: PROJECT_DIR });
  return stdout.trim();
}

async function getRemoteCommit(): Promise<string | null> {
  try {
    if (!GITHUB_PAT) return null;
    const authUrl = `https://${GITHUB_USER}:${GITHUB_PAT}@github.com/${GITHUB_REPO}`;
    await execAsync(`git remote set-url origin "${authUrl}"`, { cwd: PROJECT_DIR });
    try {
      await execAsync('git fetch origin main', { cwd: PROJECT_DIR, timeout: 30000 });
      const { stdout } = await execAsync('git rev-parse origin/main', { cwd: PROJECT_DIR });
      return stdout.trim();
    } finally {
      await execAsync(`git remote set-url origin https://github.com/${GITHUB_REPO}`, { cwd: PROJECT_DIR });
    }
  } catch {
    try { await execAsync(`git remote set-url origin https://github.com/${GITHUB_REPO}`, { cwd: PROJECT_DIR }); } catch {}
    return null;
  }
}

async function isLocalBehindRemote(): Promise<{ behind: boolean; localCommit: string; remoteCommit: string | null; sandboxReset: boolean }> {
  const localCommit = await getCurrentLocalCommit();
  const remoteCommit = await getRemoteCommit();
  const lastPushedCommit = getLastPushedCommit();

  // If no remote or can't fetch, allow push (first time or network issue)
  if (!remoteCommit) {
    return { behind: false, localCommit, remoteCommit, sandboxReset: false };
  }

  // If local and remote are the same, nothing to worry about
  if (localCommit === remoteCommit) {
    return { behind: false, localCommit, remoteCommit, sandboxReset: false };
  }

  // Check if local is behind remote (remote has commits local doesn't)
  try {
    const { stdout } = await execAsync(`git log --oneline ${localCommit}..${remoteCommit}`, { cwd: PROJECT_DIR });
    const remoteAheadCount = stdout.trim().split('\n').filter(Boolean).length;

    if (remoteAheadCount > 0) {
      // Remote is ahead of local - this could be sandbox reset
      // Check if the last pushed commit still exists in local history
      let sandboxReset = false;
      if (lastPushedCommit) {
        try {
          const { stdout: branchCheck } = await execAsync(
            `git branch --contains ${lastPushedCommit} 2>/dev/null`,
            { cwd: PROJECT_DIR }
          );
          // If the last pushed commit is NOT in any local branch, sandbox was reset
          sandboxReset = !branchCheck.trim().includes('main');
        } catch {
          // Commit doesn't exist locally at all → DEFINITELY sandbox reset
          sandboxReset = true;
        }
      }

      return { behind: true, localCommit, remoteCommit, sandboxReset };
    }
  } catch {}

  // Local is ahead of remote (normal case - we have new commits to push)
  return { behind: false, localCommit, remoteCommit, sandboxReset: false };
}

// ========== PUSH FUNCTION ==========

async function pushToGitHub(commitMessage: string = 'chore: auto backup by NEIS', forceOverride: boolean = false): Promise<{ success: boolean; message: string; hadChanges: boolean; sandboxResetDetected?: boolean }> {
  if (!GITHUB_PAT) {
    return { success: false, message: 'GitHub PAT belum dikonfigurasi di server', hadChanges: false };
  }

  // SANDBOX RESET CHECK (skip if forceOverride for manual admin override)
  if (!forceOverride) {
    const check = await isLocalBehindRemote();
    if (check.behind) {
      if (check.sandboxReset) {
        console.error('🚨 SANDBOX RESET DETECTED! Blocking push to protect GitHub data.');
        return {
          success: false,
          message: '🚨 TERDETEKSI SANDBOX RESET! Push diblokir untuk melindungi data di GitHub. Gunakan "Ambil dari GitHub" untuk memulihkan data, atau "Force Push" jika Anda yakin ingin menimpa data GitHub.',
          hadChanges: false,
          sandboxResetDetected: true,
        };
      } else {
        // Remote is ahead but it's not a sandbox reset (someone else pushed)
        return {
          success: false,
          message: 'Remote GitHub lebih baru dari lokal. Pull terlebih dahulu sebelum push.',
          hadChanges: false,
        };
      }
    }
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
      if (forceOverride) {
        await execAsync('git push -u origin main --force', { cwd: PROJECT_DIR, timeout: 60000 });
      } else {
        await execAsync('git push -u origin main', { cwd: PROJECT_DIR, timeout: 60000 });
      }
      // Save the commit we just pushed
      const newCommit = await getCurrentLocalCommit();
      saveLastPushedCommit(newCommit);
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

// ========== AUTO-PUSH STATE ==========

let autoPushEnabled = true;
let lastAutoPushTime: string | null = null;
let lastAutoPushStatus: 'success' | 'failed' | 'no_changes' | 'sandbox_reset_blocked' | null = null;
let autoPushIntervalMinutes = 5;
let sandboxResetDetected = false;

// ========== API HANDLER ==========

export async function POST(req: NextRequest) {
  // Blokir semua akses Git Control di production (deploy)
  // Git Control hanya diperlukan di development (lokal sandbox)
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Git Control tidak tersedia di versi yang sudah di-deploy. Kode dikelola melalui GitHub dan platform deploy (Vercel) secara otomatis.' },
      { status: 403 }
    );
  }

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

      // If sandbox reset was already detected, don't try again
      if (sandboxResetDetected) {
        return NextResponse.json({
          message: '🚨 Auto-push diblokir: Sandbox reset terdeteksi! Manual admin action diperlukan.',
          skipped: true,
          sandboxResetDetected: true,
        });
      }

      const timestamp = new Date().toISOString();
      const result = await pushToGitHub(`chore: auto backup ${timestamp}`);
      lastAutoPushTime = timestamp;

      if (result.sandboxResetDetected) {
        sandboxResetDetected = true;
        lastAutoPushStatus = 'sandbox_reset_blocked';
        return NextResponse.json({
          message: result.message,
          hadChanges: false,
          sandboxResetDetected: true,
        });
      }

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
      if (result.sandboxResetDetected) {
        return NextResponse.json({
          error: result.message,
          sandboxResetDetected: true,
        }, { status: 409 }); // 409 Conflict
      }
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 500 });
      }
      return NextResponse.json({ message: result.message, hadChanges: result.hadChanges });
    } else if (action === 'force-push') {
      // Admin explicitly wants to overwrite GitHub - use with caution
      const result = await pushToGitHub('chore: force backup by Admin (override)', true);
      if (result.success) {
        // Reset sandbox reset flag since admin chose to force push
        sandboxResetDetected = false;
      }
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 500 });
      }
      return NextResponse.json({
        message: result.hadChanges
          ? '⚠️ Force push berhasil! Data GitHub telah ditimpa dengan data lokal.'
          : 'Tidak ada perubahan baru.',
        hadChanges: result.hadChanges,
      });
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
          // After pull, save the new commit and reset sandbox flag
          const newCommit = await getCurrentLocalCommit();
          saveLastPushedCommit(newCommit);
          sandboxResetDetected = false;
        } finally {
          await execAsync(`git remote set-url origin https://github.com/${GITHUB_REPO}`, { cwd: PROJECT_DIR });
        }

        return NextResponse.json({ message: 'Kode berhasil diambil dari GitHub! Data lokal telah dipulihkan.' });
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
        sandboxResetDetected,
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
    } else if (action === 'dismiss-sandbox-reset') {
      // Admin acknowledges the reset and wants to start fresh
      sandboxResetDetected = false;
      const currentCommit = await getCurrentLocalCommit();
      saveLastPushedCommit(currentCommit);
      return NextResponse.json({ message: 'Peringatan sandbox reset diabaikan. Auto-push akan berjalan normal lagi.' });
    } else if (action === 'recovery') {
      // Full recovery: pull from GitHub + re-seed database
      if (!GITHUB_PAT) {
        return NextResponse.json({ error: 'GitHub PAT belum dikonfigurasi. Tidak bisa memulihkan data.' }, { status: 500 });
      }
      try {
        // Step 1: Pull latest code from GitHub
        const authUrl = `https://${GITHUB_USER}:${GITHUB_PAT}@github.com/${GITHUB_REPO}`;
        await execAsync(`git remote set-url origin "${authUrl}"`, { cwd: PROJECT_DIR });

        try {
          await execAsync('git fetch --all', { cwd: PROJECT_DIR, timeout: 60000 });
          await execAsync('git reset --hard origin/main', { cwd: PROJECT_DIR });
        } finally {
          await execAsync(`git remote set-url origin https://github.com/${GITHUB_REPO}`, { cwd: PROJECT_DIR });
        }

        // Step 2: Install dependencies (in case new packages were added)
        try { await execAsync('bun install', { cwd: PROJECT_DIR, timeout: 120000 }); } catch {}

        // Step 3: Push database schema
        try { await execAsync('bun run db:push', { cwd: PROJECT_DIR, timeout: 30000 }); } catch {}

        // Step 4: Update commit tracking
        const newCommit = await getCurrentLocalCommit();
        saveLastPushedCommit(newCommit);
        sandboxResetDetected = false;

        return NextResponse.json({
          message: '✅ Pemulihan berhasil! Kode dan database telah dipulihkan dari GitHub. Halaman akan dimuat ulang.',
          recovered: true,
        });
      } catch (error: any) {
        try {
          await execAsync(`git remote set-url origin https://github.com/${GITHUB_REPO}`, { cwd: PROJECT_DIR });
        } catch {}
        return NextResponse.json({ error: `Gagal memulihkan data: ${error.message}` }, { status: 500 });
      }
    } else if (action === 'check-recovery') {
      // Check if recovery is needed (compare local vs remote)
      if (!GITHUB_PAT) {
        return NextResponse.json({ patAvailable: false, recoveryNeeded: false });
      }
      try {
        const check = await isLocalBehindRemote();
        return NextResponse.json({
          patAvailable: true,
          recoveryNeeded: check.behind,
          sandboxReset: check.sandboxReset,
          localCommit: check.localCommit,
          remoteCommit: check.remoteCommit,
        });
      } catch {
        return NextResponse.json({ patAvailable: true, recoveryNeeded: false, error: 'Gagal cek status' });
      }
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error) {
    console.error('Git control error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
