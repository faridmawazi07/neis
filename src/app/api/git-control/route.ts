import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);
const PROJECT_DIR = '/home/z/my-project';
const CONFIG_PATH = join(PROJECT_DIR, '.github-config.json');
const NEIS_ENV_FILE = join(PROJECT_DIR, '.neis.env');
const SYNC_MARKER_DIR = join(PROJECT_DIR, '.neis-sync');
const SANDBOX_ID_FILE = join(PROJECT_DIR, '.neis-sandbox-id');

interface GitHubConfig {
  autoPush: boolean;
  lastPush: string | null;
  lastPull: string | null;
  branch: string;
  synced: boolean;
  sandboxId: string | null;
}

function getConfig(): GitHubConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return { autoPush: true, lastPush: null, lastPull: null, branch: 'dev', synced: false, sandboxId: null };
}

function saveConfig(config: GitHubConfig) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function isSyncMarkerPresent(): boolean {
  return existsSync(SYNC_MARKER_DIR);
}

function markSynced() {
  try {
    if (!existsSync(SYNC_MARKER_DIR)) mkdirSync(SYNC_MARKER_DIR);
    writeFileSync(join(SYNC_MARKER_DIR, 'last-sync'), new Date().toISOString());
  } catch {}
}

function clearSyncMarker() {
  try {
    if (existsSync(SYNC_MARKER_DIR)) rmSync(SYNC_MARKER_DIR, { recursive: true, force: true });
  } catch {}
}

/**
 * Generate a unique sandbox ID based on filesystem attributes.
 * This ID changes when the sandbox is reset.
 * Uses: inode of project dir + mtime of package.json
 */
function generateSandboxId(): string {
  try {
    const projStat = statSync(PROJECT_DIR);
    const pkgStat = statSync(join(PROJECT_DIR, 'package.json'));
    return `${projStat.ino}-${pkgStat.mtimeMs}-${pkgStat.ctimeMs}`;
  } catch {
    // Fallback: use current timestamp + random (always new = always triggers sync)
    return `unknown-${Date.now()}-${Math.random()}`;
  }
}

/**
 * Check if sandbox has been reset by comparing current sandbox ID
 * with the stored one. If they differ, sandbox was reset.
 */
function isSandboxReset(): boolean {
  const currentId = generateSandboxId();
  const config = getConfig();
  
  if (!config.sandboxId) {
    // First run ever - save current ID, not a reset
    config.sandboxId = currentId;
    saveConfig(config);
    return false;
  }
  
  if (config.sandboxId !== currentId) {
    // Sandbox ID changed = RESET DETECTED!
    console.log(`[SandboxProtection] 🚨 RESET DETECTED! Old ID: ${config.sandboxId}, New ID: ${currentId}`);
    return true;
  }
  
  return false;
}

/**
 * Update sandbox ID after a successful pull (recovery).
 * This prevents re-detecting the same reset.
 */
function updateSandboxId() {
  const config = getConfig();
  config.sandboxId = generateSandboxId();
  saveConfig(config);
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

/**
 * Fetch from GitHub and get ahead/behind counts
 */
async function fetchAndGetAheadBehind(gitToken: string, targetBranch: string): Promise<{ ahead: number; behind: number; fetched: boolean }> {
  let ahead = 0;
  let behind = 0;
  let fetched = false;
  
  if (gitToken) {
    try {
      await execAsync(`git remote set-url origin https://${gitToken}@github.com/faridmawazi07/neis.git`, { cwd: PROJECT_DIR });
      await execAsync('git fetch origin', { cwd: PROJECT_DIR, timeout: 30000 });
      fetched = true;
    } catch {
      // fetch might fail if no network
    } finally {
      try { await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR }); } catch {}
    }
  }
  
  if (fetched) {
    try {
      const { stdout } = await execAsync(`git rev-list --left-right --count origin/${targetBranch}...HEAD`, { cwd: PROJECT_DIR });
      const parts = stdout.trim().split(/\s+/);
      ahead = parseInt(parts[0] || '0');
      behind = parseInt(parts[1] || '0');
    } catch {}
  }
  
  return { ahead, behind, fetched };
}

async function doPull(gitToken: string, targetBranch: string): Promise<string> {
  try {
    await execAsync(`git remote set-url origin https://${gitToken}@github.com/faridmawazi07/neis.git`, { cwd: PROJECT_DIR });
    await execAsync('git fetch --all', { cwd: PROJECT_DIR, timeout: 120000 });
    await execAsync(`git reset --hard origin/${targetBranch}`, { cwd: PROJECT_DIR });
    await execAsync('git remote set-url origin https://github.com/faridmawazi07/neis.git', { cwd: PROJECT_DIR });
    markSynced();
    updateSandboxId(); // Update sandbox ID after successful pull (recovery)
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

/**
 * Check if push is allowed based on sync state.
 * Returns { allowed: boolean, reason: string }
 */
async function canPush(gitToken: string, targetBranch: string): Promise<{ allowed: boolean; reason: string; behind: number }> {
  // Check 1: Sync marker must exist
  if (!isSyncMarkerPresent()) {
    return { allowed: false, reason: 'Sandbox belum sinkron. Ambil kode dari GitHub terlebih dahulu.', behind: 0 };
  }
  
  // Check 2: Sandbox reset detection
  if (isSandboxReset()) {
    return { allowed: false, reason: 'Sandbox reset terdeteksi! Push diblokir untuk melindungi kode di GitHub.', behind: 0 };
  }
  
  // Check 3: Must not be behind GitHub (would overwrite newer code)
  if (gitToken) {
    const { behind } = await fetchAndGetAheadBehind(gitToken, targetBranch);
    if (behind > 0) {
      return { allowed: false, reason: `Kode lokal tertinggal ${behind} commit dari GitHub. Pull terlebih dahulu.`, behind };
    }
  }
  
  return { allowed: true, reason: '', behind: 0 };
}

async function doPush(gitToken: string, targetBranch: string, commitPrefix: string) {
  // Pre-flight check
  const canPushResult = await canPush(gitToken, targetBranch);
  if (!canPushResult.allowed) {
    return { success: false, message: canPushResult.reason, blocked: true };
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
    let fetched = false;
    
    try { const { stdout } = await execAsync('git status --porcelain', { cwd: PROJECT_DIR }); hasUncommittedChanges = stdout.trim().length > 0; } catch {}
    try { const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_DIR }); currentBranch = stdout.trim(); } catch {}
    
    // Fetch and get ahead/behind
    if (gitToken) {
      const result = await fetchAndGetAheadBehind(gitToken, config.branch);
      ahead = result.ahead;
      behind = result.behind;
      fetched = result.fetched;
    }
    
    const syncMarkerPresent = isSyncMarkerPresent();
    const sandboxReset = isSandboxReset();
    
    // Determine synced status:
    // synced = true ONLY when: marker exists AND no reset detected AND not behind GitHub
    const synced = syncMarkerPresent && !sandboxReset && behind === 0;
    const needsPull = behind > 0 || sandboxReset || !syncMarkerPresent;
    
    // If reset detected, clear sync marker to enforce pull
    if (sandboxReset && syncMarkerPresent) {
      clearSyncMarker();
      config.synced = false;
      saveConfig(config);
    }
    
    const cloudinary = await getCloudinaryUsage();
    
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
      synced, 
      needsPull,
      sandboxReset,
      syncMarkerPresent,
      fetched,
      cloudinary 
    });
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

    // ===== STARTUP SYNC - Auto-detect reset and recover =====
    if (action === 'startup-sync') {
      if (!gitToken) return NextResponse.json({ synced: false, message: 'Token tidak tersedia', resetDetected: false });
      
      const config = getConfig();
      const syncMarkerPresent = isSyncMarkerPresent();
      const sandboxReset = isSandboxReset();
      
      console.log(`[SandboxProtection] 🔍 Startup check: marker=${syncMarkerPresent}, reset=${sandboxReset}`);
      
      if (!syncMarkerPresent || sandboxReset) {
        // SANDBOX RESET DETECTED! Auto-pull from GitHub
        console.log('[SandboxProtection] 🔄 Reset detected! Auto-pulling from GitHub...');
        try {
          const message = await doPull(gitToken, config.branch);
          console.log(`[SandboxProtection] ✅ Recovery successful: ${message}`);
          return NextResponse.json({ 
            synced: true, 
            resetDetected: true, 
            recovered: true, 
            message: `Sandbox reset terdeteksi & kode dipulihkan dari GitHub!` 
          });
        } catch (error: any) {
          console.error(`[SandboxProtection] ❌ Recovery failed: ${error.message}`);
          return NextResponse.json({ 
            synced: false, 
            resetDetected: true, 
            recovered: false, 
            message: `Reset terdeteksi tapi gagal pull: ${error.message}` 
          }, { status: 500 });
        }
      }
      
      // No reset - check if behind
      const { behind } = await fetchAndGetAheadBehind(gitToken, config.branch);
      if (behind > 0) {
        console.log(`[SandboxProtection] ⚠️ Behind ${behind} commits. Auto-pulling...`);
        try {
          const message = await doPull(gitToken, config.branch);
          return NextResponse.json({ synced: true, resetDetected: false, recovered: true, message: `Kode diperbarui dari GitHub (${behind} commit).` });
        } catch (error: any) {
          return NextResponse.json({ synced: false, resetDetected: false, recovered: false, message: `Gagal pull: ${error.message}` }, { status: 500 });
        }
      }
      
      // Everything is synced
      return NextResponse.json({ synced: true, resetDetected: false, recovered: false, message: 'Sandbox sudah sinkron dengan GitHub' });
    }

    // ===== AUTO-PULL TRIGGER =====
    if (action === 'auto-pull-trigger') {
      if (!gitToken) return NextResponse.json({ skipped: true, message: 'Token tidak tersedia' });
      try { const config = getConfig(); const message = await doPull(gitToken, config.branch); return NextResponse.json({ message }); }
      catch (error: any) { return NextResponse.json({ error: `Auto-pull gagal: ${error.message}` }, { status: 500 }); }
    }

    // ===== SYNC STATUS =====
    if (action === 'sync-status') {
      const syncMarkerPresent = isSyncMarkerPresent();
      const sandboxReset = isSandboxReset();
      const config = getConfig();
      let behind = 0;
      if (gitToken) {
        const result = await fetchAndGetAheadBehind(gitToken, config.branch);
        behind = result.behind;
      }
      const synced = syncMarkerPresent && !sandboxReset && behind === 0;
      return NextResponse.json({ synced, sandboxReset, behind, syncMarkerPresent });
    }

    // ===== AUTO-PUSH TRIGGER - Smart: pull if behind, push if ahead =====
    if (action === 'auto-push-trigger') {
      const config = getConfig();
      if (!config.autoPush || !gitToken) return NextResponse.json({ skipped: true, message: !config.autoPush ? 'Auto-push dinonaktifkan' : 'Token tidak tersedia' });
      
      // Check sandbox reset
      if (isSandboxReset() || !isSyncMarkerPresent()) {
        console.log('[SandboxProtection] 🚫 Auto-push BLOCKED - sandbox not synced. Triggering auto-pull instead...');
        try {
          const message = await doPull(gitToken, config.branch);
          return NextResponse.json({ blocked: true, autoRecovered: true, message: `Auto-push diblokir, kode dipulihkan dari GitHub: ${message}` });
        } catch (error: any) {
          return NextResponse.json({ blocked: true, autoRecovered: false, message: `Auto-push diblokir & auto-pull gagal: ${error.message}` });
        }
      }
      
      // Check if behind GitHub
      const { behind } = await fetchAndGetAheadBehind(gitToken, config.branch);
      if (behind > 0) {
        console.log(`[SandboxProtection] ⚠️ Behind ${behind} commits. Auto-pulling instead of pushing...`);
        try {
          const message = await doPull(gitToken, config.branch);
          return NextResponse.json({ blocked: true, autoRecovered: true, message: `Kode lokal tertinggal, diperbarui dari GitHub: ${message}` });
        } catch (error: any) {
          return NextResponse.json({ blocked: true, autoRecovered: false, message: `Gagal pull: ${error.message}` });
        }
      }
      
      // All checks passed - safe to push
      try {
        const result = await doPush(gitToken, config.branch, 'chore: auto backup');
        if (result.blocked) return NextResponse.json({ blocked: true, message: result.message });
        if (result.nothingNew) return NextResponse.json({ skipped: true, message: 'Tidak ada perubahan baru' });
        return NextResponse.json({ message: result.message });
      } catch (error: any) { return NextResponse.json({ error: `Auto-push gagal: ${error.message}` }, { status: 500 }); }
    }

    // ===== AUTO-PUSH STATUS =====
    if (action === 'auto-push-status') {
      const config = getConfig();
      const syncMarkerPresent = isSyncMarkerPresent();
      const sandboxReset = isSandboxReset();
      const synced = syncMarkerPresent && !sandboxReset;
      return NextResponse.json({ enabled: config.autoPush && synced, intervalMinutes: 5, synced, sandboxReset });
    }

    // ===== SAVE CONFIG =====
    if (action === 'save-config') {
      const config = getConfig();
      if (body.autoPush !== undefined) config.autoPush = body.autoPush;
      if (body.branch !== undefined) config.branch = body.branch;
      saveConfig(config);
      return NextResponse.json({ message: 'Konfigurasi berhasil disimpan', connected: !!gitToken });
    }

    // ===== MANUAL PUSH =====
    if (action === 'push') {
      if (!gitToken) return NextResponse.json({ error: 'GitHub Token belum dikonfigurasi.' }, { status: 400 });
      
      // Use canPush for consistent checking
      const canPushResult = await canPush(gitToken, getConfig().branch);
      if (!canPushResult.allowed) {
        return NextResponse.json({ 
          error: canPushResult.reason, 
          blocked: true,
          needsPull: true 
        }, { status: 403 });
      }
      
      try {
        const config = getConfig();
        const result = await doPush(gitToken, config.branch, 'chore: manual backup');
        if (result.blocked) return NextResponse.json({ error: result.message, blocked: true }, { status: 403 });
        if (result.nothingNew) return NextResponse.json({ message: `Tidak ada perubahan baru, branch ${config.branch} sudah terbaru` });
        return NextResponse.json({ message: `Kode berhasil disimpan ke GitHub (branch: ${config.branch})!` });
      } catch (error: any) { return NextResponse.json({ error: `Gagal push ke GitHub: ${error.message}` }, { status: 500 }); }
    }

    // ===== MANUAL PULL =====
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
