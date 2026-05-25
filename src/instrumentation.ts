/**
 * Next.js Instrumentation - Auto-Push & Sandbox Reset Protection
 * 
 * This runs once when the Next.js server starts and stays alive
 * as long as the server is running.
 * 
 * Features:
 * 1. On startup: Detect sandbox reset → auto-pull from GitHub
 * 2. Every 5 min: Smart auto-push (pull if behind, push if ahead)
 * 3. Prevents stale code from overwriting good GitHub code
 */

export async function register() {
  // Only run on server side (not in browser)
  // Only run in development (sandbox) - not in production (Vercel)
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV !== 'production') {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const { readFileSync, existsSync } = await import('fs');

    const execAsync = promisify(exec);
    const PROJECT_DIR = '/home/z/my-project';
    const NEIS_ENV_FILE = '/home/z/my-project/.neis.env';

    function getGitHubPAT(): string {
      if (process.env.NEIS_GITHUB_PAT) return process.env.NEIS_GITHUB_PAT;
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

    const GITHUB_PAT = getGitHubPAT();

    let lastPushTime = 0;
    let currentIntervalMinutes = 5;
    let startupSyncDone = false;

    /**
     * Call the git-control API with internal auth
     */
    async function callGitControl(action: string): Promise<any> {
      const res = await fetch('http://localhost:3000/api/git-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer neis-internal-auto-push',
          'X-Auto-Push': 'true',
        },
        body: JSON.stringify({ action }),
      });
      return { status: res.status, data: await res.json() };
    }

    /**
     * STEP 1: Startup sync - Detect sandbox reset and auto-recover
     * This runs FIRST before any auto-push attempts
     */
    async function startupSync(): Promise<void> {
      try {
        console.log('[SandboxProtection] 🔍 Checking sandbox state on startup...');
        const { status, data } = await callGitControl('startup-sync');

        if (data.resetDetected && data.recovered) {
          console.log('[SandboxProtection] ✅ RESET DETECTED & RECOVERED! Code pulled from GitHub.');
        } else if (data.resetDetected && !data.recovered) {
          console.error('[SandboxProtection] ❌ RESET DETECTED but recovery FAILED:', data.message);
        } else if (data.recovered) {
          console.log('[SandboxProtection] ✅ Code updated from GitHub:', data.message);
        } else {
          console.log('[SandboxProtection] ✅ Sandbox is synced with GitHub.');
        }
      } catch (error: any) {
        console.error(`[SandboxProtection] ❌ Startup sync error: ${error?.message || error}`);
      }
      startupSyncDone = true;
    }

    /**
     * STEP 2: Smart auto-push - Pull if behind, push if ahead
     */
    async function triggerSmartAutoPush(): Promise<void> {
      try {
        // First check sync status
        const { data: syncData } = await callGitControl('sync-status');
        
        if (!syncData.synced || syncData.sandboxReset) {
          // Not synced or reset detected - auto-pull instead of push
          console.log('[SandboxProtection] 🔄 Not synced. Auto-pulling from GitHub...');
          const { data: pullData } = await callGitControl('auto-pull-trigger');
          if (pullData.message) {
            console.log(`[SandboxProtection] ✅ Auto-pull: ${pullData.message}`);
          } else if (pullData.error) {
            console.error(`[SandboxProtection] ❌ Auto-pull failed: ${pullData.error}`);
          }
          return;
        }

        // Synced - safe to push
        const { data } = await callGitControl('auto-push-trigger');

        if (data.blocked && data.autoRecovered) {
          console.log(`[SandboxProtection] 🔄 Push blocked, auto-recovered: ${data.message}`);
        } else if (data.blocked) {
          console.log(`[SandboxProtection] 🚫 Push blocked: ${data.message}`);
        } else if (data.skipped) {
          console.log(`[AutoPush] ⏭️ Skipped: ${data.message || 'disabled'}`);
        } else if (data.error) {
          console.error(`[AutoPush] ❌ Failed: ${data.error}`);
        } else {
          console.log(`[AutoPush] ✅ ${data.message}`);
        }
      } catch (error: any) {
        console.error(`[AutoPush] ❌ Error: ${error?.message || error}`);
      }
    }

    async function fetchStatus(): Promise<{ enabled: boolean; intervalMinutes: number }> {
      try {
        const { data } = await callGitControl('auto-push-status');
        if (data) {
          return {
            enabled: data.enabled ?? true,
            intervalMinutes: data.intervalMinutes ?? 5,
          };
        }
      } catch {}
      return { enabled: true, intervalMinutes: 5 };
    }

    async function checkAndPush() {
      try {
        const status = await fetchStatus();
        
        if (status.intervalMinutes !== currentIntervalMinutes) {
          console.log(`[AutoPush] 📅 Interval changed: ${currentIntervalMinutes} min → ${status.intervalMinutes} min`);
          currentIntervalMinutes = status.intervalMinutes;
        }

        const now = Date.now();
        const intervalMs = currentIntervalMinutes * 60 * 1000;
        
        if ((now - lastPushTime) >= intervalMs) {
          lastPushTime = now;
          await triggerSmartAutoPush();
        }
      } catch (error: any) {
        console.error(`[AutoPush] Check error: ${error?.message || error}`);
      }
    }

    console.log('[SandboxProtection] 🚀 Service initialized via Next.js instrumentation');
    
    // STEP 1: Startup sync after 15 seconds (check for sandbox reset)
    setTimeout(() => {
      console.log('[SandboxProtection] 🔍 Running startup sync check...');
      startupSync();
    }, 15000);

    // STEP 2: First auto-push after 60 seconds (after startup sync is done)
    setTimeout(() => {
      if (startupSyncDone) {
        console.log('[AutoPush] 🕐 First push check starting...');
        lastPushTime = Date.now();
        triggerSmartAutoPush();
      } else {
        console.log('[AutoPush] ⏳ Waiting for startup sync to complete...');
        // Retry after 30 more seconds
        setTimeout(() => {
          lastPushTime = Date.now();
          triggerSmartAutoPush();
        }, 30000);
      }
    }, 60000);

    // STEP 3: Periodic check every 30 seconds
    setInterval(checkAndPush, 30000);
  }
}
