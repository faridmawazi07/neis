import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);
const PROJECT_DIR = '/home/z/my-project';
const CONFIG_PATH = join(PROJECT_DIR, '.github-config.json');
const NEIS_ENV_FILE = join(PROJECT_DIR, '.neis.env');

interface GitHubConfig {
  autoPush: boolean;
  lastPush: string | null;
  lastPull: string | null;
  branch: string;
}

function getConfig(): GitHubConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return { autoPush: true, lastPush: null, lastPull: null, branch: 'main' };
}

function saveConfig(config: GitHubConfig) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getGitHubPAT(): string {
  // 1. Try environment variable
  if (process.env.NEIS_GITHUB_PAT) return process.env.NEIS_GITHUB_PAT;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;

  // 2. Try .neis.env file (same format as instrumentation.ts)
  try {
    if (existsSync(NEIS_ENV_FILE)) {
      const content = readFileSync(NEIS_ENV_FILE, 'utf-8');
      const directMatch = content.match(/NEIS_GITHUB_PAT=(.+)/);
      if (directMatch) return directMatch[1].trim();
      const b64Match = content.match(/NEIS_GITHUB_PAT_B64=(.+)/);
      if (b64Match) return Buffer.from(b64Match[1].trim(), 'base64').toString('utf-8');
      const p1 = content.match(/NEIS_GH_P1=(.+)/);
      const p2 = content.match(/NEIS_GH_P2=(.+)/);
      const p3 = content.match(/NEIS_GH_P3=(.+)/);
      if (p1 && p2 && p3) return p1[1].trim() + p2[1].trim() + p3[1].trim();
    }
  } catch {}

  return '';
}

function isAdmin(req: NextRequest): { authorized: boolean; isAutoPush: boolean } {
  const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
  const isAutoPush = req.headers.get('X-Auto-Push') === 'true' && token === 'neis-internal-auto-push';
  if (isAutoPush) return { authorized: true, isAutoPush: true };

  if (!token) return { authorized: false, isAutoPush: false };
  const payload = verifyToken(token);
  if (!payload) return { authorized: false, isAutoPush: false };
  if (payload.role !== 'admin') return { authorized: false, isAutoPush: false };
  return { authorized: true, isAutoPush: false };
}

export async function GET(req: NextRequest) {
  try {
    const { authorized } = isAdmin(req);
    if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const config = getConfig();
    const gitToken = getGitHubPAT();
    let hasUncommittedChanges = false;
    let currentBranch = 'main';
    let ahead = 0;
    let behind = 0;

    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: PROJECT_DIR });
      hasUncommittedChanges = stdout.trim().length > 0;
    } catch {}

    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_DIR });
      currentBranch = stdout.trim();
    } catch {}

    if (gitToken) {
      try {
        await execAsync(`git remote set-url origin https://${gitToken}@github.com/faridmawazi07/neis.git`, { cwd: PROJECT_DIR });
        await execAsync('git fetch origin', { cwd: PROJECT_DIR, timeout: 30000 });
        await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });
      } catch {
        try { await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR }); } catch {}
      }
    }

    try {
      const { stdout } = await execAsync(`git rev-list --left-right --count origin/${config.branch}...HEAD`, { cwd: PROJECT_DIR });
      const parts = stdout.trim().split(/\s+/);
      ahead = parseInt(parts[0] || '0');
      behind = parseInt(parts[1] || '0');
    } catch {}

    return NextResponse.json({
      connected: !!gitToken,
      autoPush: config.autoPush,
      lastPush: config.lastPush,
      lastPull: config.lastPull,
      branch: config.branch,
      currentBranch,
      hasUncommittedChanges,
      ahead,
      behind,
    });
  } catch (error) {
    console.error('Git control GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authorized, isAutoPush } = isAdmin(req);
    if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;
    const gitToken = getGitHubPAT();

    // Auto-push trigger from instrumentation.ts
    if (action === 'auto-push-trigger') {
      const config = getConfig();
      if (!config.autoPush || !gitToken) {
        return NextResponse.json({ skipped: true, message: !config.autoPush ? 'Auto-push dinonaktifkan' : 'Token tidak tersedia' });
      }
      try {
        await execAsync(`git remote set-url origin https://${gitToken}@github.com/faridmawazi07/neis.git`, { cwd: PROJECT_DIR });
        await execAsync('git add .', { cwd: PROJECT_DIR });
        try {
          const ts = new Date().toISOString();
          await execAsync(`git commit -m "chore: auto backup - ${ts}"`, { cwd: PROJECT_DIR });
        } catch (e: any) {
          if (!e.message?.includes('nothing to commit')) throw e;
          await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });
          return NextResponse.json({ skipped: true, message: 'Tidak ada perubahan baru' });
        }
        await execAsync(`git push -u origin ${config.branch}`, { cwd: PROJECT_DIR, timeout: 120000 });
        await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });
        config.lastPush = new Date().toISOString();
        saveConfig(config);
        return NextResponse.json({ message: `Auto-push berhasil (branch: ${config.branch})` });
      } catch (error: any) {
        try { await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR }); } catch {}
        return NextResponse.json({ error: `Auto-push gagal: ${error.message}` }, { status: 500 });
      }
    }

    // Auto-push status from instrumentation.ts
    if (action === 'auto-push-status') {
      const config = getConfig();
      return NextResponse.json({ enabled: config.autoPush, intervalMinutes: 5 });
    }

    // Save config
    if (action === 'save-config') {
      const config = getConfig();
      if (body.autoPush !== undefined) config.autoPush = body.autoPush;
      if (body.branch !== undefined) config.branch = body.branch;
      saveConfig(config);
      return NextResponse.json({ message: 'Konfigurasi berhasil disimpan', connected: !!gitToken });
    }

    // Manual push
    if (action === 'push') {
      if (!gitToken) {
        return NextResponse.json({ error: 'GitHub Token belum dikonfigurasi. Hubungi administrator.' }, { status: 400 });
      }
      try {
        await execAsync(`git remote set-url origin https://${gitToken}@github.com/faridmawazi07/neis.git`, { cwd: PROJECT_DIR });
        await execAsync('git add .', { cwd: PROJECT_DIR });
        try {
          const timestamp = new Date().toLocaleString('id-ID');
          await execAsync(`git commit -m "chore: manual backup - ${timestamp}"`, { cwd: PROJECT_DIR });
        } catch (e: any) {
          if (!e.message?.includes('nothing to commit')) throw e;
        }
        const config = getConfig();
        await execAsync(`git push -u origin ${config.branch}`, { cwd: PROJECT_DIR, timeout: 120000 });
        await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });
        config.lastPush = new Date().toISOString();
        saveConfig(config);
        return NextResponse.json({ message: `Kode berhasil disimpan ke GitHub (branch: ${config.branch})!` });
      } catch (error: any) {
        try { await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR }); } catch {}
        return NextResponse.json({ error: `Gagal push ke GitHub: ${error.message}` }, { status: 500 });
      }
    }

    // Manual pull
    if (action === 'pull') {
      if (!gitToken) {
        return NextResponse.json({ error: 'GitHub Token belum dikonfigurasi. Hubungi administrator.' }, { status: 400 });
      }
      try {
        await execAsync(`git remote set-url origin https://${gitToken}@github.com/faridmawazi07/neis.git`, { cwd: PROJECT_DIR });
        await execAsync('git fetch --all', { cwd: PROJECT_DIR, timeout: 120000 });
        const config = getConfig();
        await execAsync(`git reset --hard origin/${config.branch}`, { cwd: PROJECT_DIR });
        await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });
        config.lastPull = new Date().toISOString();
        saveConfig(config);
        return NextResponse.json({ message: `Kode berhasil diambil dari GitHub (branch: ${config.branch})!` });
      } catch (error: any) {
        try { await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR }); } catch {}
        return NextResponse.json({ error: `Gagal pull dari GitHub: ${error.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error) {
    console.error('Git control error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
