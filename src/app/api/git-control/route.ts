import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);
const PROJECT_DIR = '/home/z/my-project';
const CONFIG_PATH = join(PROJECT_DIR, '.github-config.json');

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

function getToken(): string {
  return process.env.GITHUB_TOKEN || '';
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat mengakses fitur ini' }, { status: 403 });
    }

    const config = getConfig();
    const gitToken = getToken();
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
        await execAsync('git fetch origin', { cwd: PROJECT_DIR, timeout: 30000 });
      } catch {}
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
    const token = req.cookies.get('neis-token')?.value || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat mengakses fitur ini' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;
    const gitToken = getToken();

    if (action === 'save-config') {
      const config = getConfig();
      if (body.autoPush !== undefined) config.autoPush = body.autoPush;
      if (body.branch !== undefined) config.branch = body.branch;
      saveConfig(config);
      return NextResponse.json({ message: 'Konfigurasi berhasil disimpan', connected: !!gitToken });
    }

    if (action === 'push') {
      if (!gitToken) {
        return NextResponse.json({ error: 'GitHub Token belum dikonfigurasi. Hubungi administrator.' }, { status: 400 });
      }

      try {
        // Set remote URL with token for push
        await execAsync(`git remote set-url origin https://${gitToken}@github.com/faridmawazi07/neis.git`, { cwd: PROJECT_DIR });

        // Add and commit
        await execAsync('git add .', { cwd: PROJECT_DIR });
        try {
          const timestamp = new Date().toLocaleString('id-ID');
          await execAsync(`git commit -m "chore: auto backup - ${timestamp}"`, { cwd: PROJECT_DIR });
        } catch (e: any) {
          if (!e.message?.includes('nothing to commit')) throw e;
        }

        // Push
        await execAsync(`git push -u origin ${getConfig().branch}`, { cwd: PROJECT_DIR, timeout: 120000 });

        // Reset remote URL to hide token
        await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });

        const config = getConfig();
        config.lastPush = new Date().toISOString();
        saveConfig(config);

        return NextResponse.json({ message: `Kode berhasil disimpan ke GitHub (branch: ${config.branch})!` });
      } catch (error: any) {
        // Always reset remote URL
        try {
          await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });
        } catch {}
        return NextResponse.json({ error: `Gagal push ke GitHub: ${error.message}` }, { status: 500 });
      }
    }

    if (action === 'pull') {
      if (!gitToken) {
        return NextResponse.json({ error: 'GitHub Token belum dikonfigurasi. Hubungi administrator.' }, { status: 400 });
      }

      try {
        // Set remote URL with token for fetch
        await execAsync(`git remote set-url origin https://${gitToken}@github.com/faridmawazi07/neis.git`, { cwd: PROJECT_DIR });

        await execAsync('git fetch --all', { cwd: PROJECT_DIR, timeout: 120000 });
        const config = getConfig();
        await execAsync(`git reset --hard origin/${config.branch}`, { cwd: PROJECT_DIR });

        // Reset remote URL
        await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });

        config.lastPull = new Date().toISOString();
        saveConfig(config);

        return NextResponse.json({ message: `Kode berhasil diambil dari GitHub (branch: ${config.branch})!` });
      } catch (error: any) {
        try {
          await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });
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
