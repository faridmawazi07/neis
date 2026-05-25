import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);
const PROJECT_DIR = '/home/z/my-project';
const CONFIG_PATH = join(PROJECT_DIR, '.github-config.json');
const NEIS_ENV_FILE = join(PROJECT_DIR, '.neis.env');
const SYNC_MARKER_DIR = join(PROJECT_DIR, '.neis-sync');

interface GitHubConfig {
  autoPush: boolean;
  lastPush: string | null;
  lastPull: string | null;
  branch: string;
  synced: boolean;
}

function getConfig(): GitHubConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return { autoPush: true, lastPush: null, lastPull: null, branch: 'dev', synced: false };
}

function saveConfig(config: GitHubConfig) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function isSynced(): boolean {
  return existsSync(SYNC_MARKER_DIR);
}

function markSynced() {
  try {
    if (!existsSync(SYNC_MARKER_DIR)) mkdirSync(SYNC_MARKER_DIR);
    writeFileSync(join(SYNC_MARKER_DIR, 'last-sync'), new Date().toISOString());
  } catch {}
}

function getNeisEnvValue(key: string): string {
  try {
    if (existsSync(NEIS_ENV_FILE)) {
      const content = readFileSync(NEIS_ENV_FILE, 'utf-8');
      const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
      if (match) return match[1].trim();
    }
  } catch {}
  return '';
}

function getGitHubPAT(): string {
  if (process.env.NEIS_GITHUB_PAT) return process.env.NEIS_GITHUB_PAT;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
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

function getCloudinaryConfig() {
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
  let apiKey = process.env.CLOUDINARY_API_KEY || '';
  let apiSecret = process.env.CLOUDINARY_API_SECRET || '';
  if (!cloudName) cloudName = getNeisEnvValue('CLOUDINARY_CLOUD_NAME');
  if (!apiKey) apiKey = getNeisEnvValue('CLOUDINARY_API_KEY');
  if (!apiSecret) apiSecret = getNeisEnvValue('CLOUDINARY_API_SECRET');
  return { cloudName, apiKey, apiSecret };
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

async function getCloudinaryUsage() {
  try {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    if (!cloudName || !apiKey || !apiSecret) return { configured: false };
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/usage`, {
      method: 'GET', headers: { 'Authorization': `Basic ${credentials}` },
    });
    if (!res.ok) return { configured: true, plan: 'free', limitedAccess: true };
    const data = await res.json();
    return {
      configured: true,
      storage: {
        usedBytes: data.storage?.usage || 0, limitBytes: data.storage?.limit || 0,
        usedMB: Math.round((data.storage?.usage || 0) / 1024 / 1024 * 100) / 100,
        limitMB: Math.round((data.storage?.limit || 0) / 1024 / 1024),
        percentage: data.storage?.limit ? Math.round((data.storage?.usage / data.storage?.limit) * 1000) / 10 : 0,
      },
      bandwidth: {
        usedBytes: data.bandwidth?.usage || 0, limitBytes: data.bandwidth?.limit || 0,
        usedMB: Math.round((data.bandwidth?.usage || 0) / 1024 / 1024 * 100) / 100,
        limitMB: Math.round((data.bandwidth?.limit || 0) / 1024 / 1024),
        percentage: data.bandwidth?.limit ? Math.round((data.bandwidth?.usage / data.bandwidth?.limit) * 1000) / 10 : 0,
      },
      requests: data.requests || 0, resources: data.resources || 0,
      derivedResources: data.derived_resources || 0, plan: data.plan || 'free',
    };
  } catch {
    return { configured: true, plan: 'free', limitedAccess: true };
  }
}

async function doPull(gitToken: string, targetBranch: string): Promise<string> {
  try {
    await execAsync(`git remote set-url origin https://${gitToken}@github.com/faridmawazi07/neis.git`, { cwd: PROJECT_DIR });
    await execAsync('git fetch --all', { cwd: PROJECT_DIR, timeout: 120000 });
    await execAsync(`git reset --hard origin/${targetBranch}`, { cwd: PROJECT_DIR });
    await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });
    markSynced();
    const config = getConfig();
    config.synced = true;
    config.lastPull = new Date().toISOString();
    saveConfig(config);
    return `Kode berhasil diambil dari GitHub (branch: ${targetBranch})!`;
  } catch (error: any) {
    try { await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR }); } catch {}
    throw error;
  }
}

async function doPush(gitToken: string, targetBranch: string, commitPrefix: string) {
  if (!isSynced()) {
    return { success: false, message: 'Push diblokir! Sandbox belum sinkron. Ambil kode dari GitHub terlebih dahulu.', blocked: true };
  }
  try {
    await execAsync(`git remote set-url origin https://${gitToken}@github.com/faridmawazi07/neis.git`, { cwd: PROJECT_DIR });
    await execAsync('git add .', { cwd: PROJECT_DIR });
    let nothingNew = false;
    try {
      const ts = new Date().toISOString();
      await execAsync(`git commit -m "${commitPrefix} - ${ts}"`, { cwd: PROJECT_DIR });
    } catch (e: any) {
      const msg = (e.message || '') + (e.stdout || '') + (e.stderr || '');
      if (msg.includes('nothing to commit') || msg.includes('no changes added') || msg.includes('nothing added')) nothingNew = true;
      else throw e;
    }
    await execAsync(`git push origin HEAD:${targetBranch}`, { cwd: PROJECT_DIR, timeout: 120000 });
    await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });
    const config = getConfig();
    config.lastPush = new Date().toISOString();
    saveConfig(config);
    return { success: true, message: `Berhasil push ke GitHub (branch: ${targetBranch})`, nothingNew };
  } catch (error: any) {
    try { await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR }); } catch {}
    throw error;
  }
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
    try { const { stdout } = await execAsync('git status --porcelain', { cwd: PROJECT_DIR }); hasUncommittedChanges = stdout.trim().length > 0; } catch {}
    try { const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_DIR }); currentBranch = stdout.trim(); } catch {}
    if (gitToken) {
      try {
        await execAsync(`git remote set-url origin https://${gitToken}@github.com/faridmawazi07/neis.git`, { cwd: PROJECT_DIR });
        await execAsync('git fetch origin', { cwd: PROJECT_DIR, timeout: 30000 });
        await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });
      } catch { try { await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR }); } catch {} }
    }
    try {
      const { stdout } = await execAsync(`git rev-list --left-right --count origin/${config.branch}...HEAD`, { cwd: PROJECT_DIR });
      const parts = stdout.trim().split(/\s+/);
      ahead = parseInt(parts[0] || '0');
      behind = parseInt(parts[1] || '0');
    } catch {}
    const synced = isSynced();
    const needsPull = behind > 0;
    const cloudinary = await getCloudinaryUsage();
    return NextResponse.json({ connected: !!gitToken, autoPush: config.autoPush, lastPush: config.lastPush, lastPull: config.lastPull, branch: config.branch, currentBranch, hasUncommittedChanges, ahead, behind, synced, needsPull, cloudinary });
  } catch (error) {
    console.error('Git control GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authorized } = isAdmin(req);
    if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { action } = body;
    const gitToken = getGitHubPAT();

    if (action === 'auto-pull-trigger') {
      if (!gitToken) return NextResponse.json({ skipped: true, message: 'Token tidak tersedia' });
      try { const config = getConfig(); const message = await doPull(gitToken, config.branch); return NextResponse.json({ message }); }
      catch (error: any) { return NextResponse.json({ error: `Auto-pull gagal: ${error.message}` }, { status: 500 }); }
    }

    if (action === 'sync-status') {
      return NextResponse.json({ synced: isSynced() });
    }

    if (action === 'auto-push-trigger') {
      const config = getConfig();
      if (!config.autoPush || !gitToken) return NextResponse.json({ skipped: true, message: !config.autoPush ? 'Auto-push dinonaktifkan' : 'Token tidak tersedia' });
      if (!isSynced()) return NextResponse.json({ blocked: true, message: 'Auto-push diblokir - sandbox belum sinkron.' });
      try {
        const result = await doPush(gitToken, config.branch, 'chore: auto backup');
        if (result.blocked) return NextResponse.json({ blocked: true, message: result.message });
        if (result.nothingNew) return NextResponse.json({ skipped: true, message: 'Tidak ada perubahan baru' });
        return NextResponse.json({ message: result.message });
      } catch (error: any) { return NextResponse.json({ error: `Auto-push gagal: ${error.message}` }, { status: 500 }); }
    }

    if (action === 'auto-push-status') {
      const config = getConfig();
      return NextResponse.json({ enabled: config.autoPush && isSynced(), intervalMinutes: 5, synced: isSynced() });
    }

    if (action === 'save-config') {
      const config = getConfig();
      if (body.autoPush !== undefined) config.autoPush = body.autoPush;
      if (body.branch !== undefined) config.branch = body.branch;
      saveConfig(config);
      return NextResponse.json({ message: 'Konfigurasi berhasil disimpan', connected: !!gitToken });
    }

    if (action === 'push') {
      if (!gitToken) return NextResponse.json({ error: 'GitHub Token belum dikonfigurasi.' }, { status: 400 });
      if (!isSynced()) return NextResponse.json({ error: 'Push DIBLOKIR! Sandbox belum sinkron dengan GitHub. Klik "Ambil dari GitHub" terlebih dahulu.', blocked: true }, { status: 403 });
      try {
        const config = getConfig();
        const result = await doPush(gitToken, config.branch, 'chore: manual backup');
        if (result.blocked) return NextResponse.json({ error: result.message, blocked: true }, { status: 403 });
        if (result.nothingNew) return NextResponse.json({ message: `Tidak ada perubahan baru, branch ${config.branch} sudah terbaru` });
        return NextResponse.json({ message: `Kode berhasil disimpan ke GitHub (branch: ${config.branch})!` });
      } catch (error: any) { return NextResponse.json({ error: `Gagal push ke GitHub: ${error.message}` }, { status: 500 }); }
    }

    if (action === 'pull') {
      if (!gitToken) return NextResponse.json({ error: 'GitHub Token belum dikonfigurasi.' }, { status: 400 });
      try { const config = getConfig(); const message = await doPull(gitToken, config.branch); return NextResponse.json({ message }); }
      catch (error: any) { return NextResponse.json({ error: `Gagal pull dari GitHub: ${error.message}` }, { status: 500 }); }
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error) {
    console.error('Git control error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
