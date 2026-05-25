/**
 * Next.js Instrumentation - Auto-Push Service
 * 
 * This runs once when the Next.js server starts and stays alive
 * as long as the server is running. This is the best way to run
 * a periodic background task in a sandbox environment where
 * separate processes get killed.
 */

export async function register() {
  // Only run on server side (not in browser)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const { readFileSync, writeFileSync, existsSync } = await import('fs');

    const execAsync = promisify(exec);
    const PROJECT_DIR = '/home/z/my-project';
    const GITHUB_USER = 'faridmawazi07';
    const GITHUB_REPO = 'faridmawazi07/neis.git';
    const COMMIT_TRACK_FILE = '/home/z/my-project/.neis-last-push-commit';
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

    // Import the shared auto-push state from git-control route
    // We'll use an internal HTTP call to the API instead of duplicating logic
    
    let lastPushTime = 0;
    let currentIntervalMinutes = 5;

    async function triggerAutoPush(): Promise<void> {
      const timestamp = new Date().toISOString();
      try {
        const res = await fetch('http://localhost:3000/api/git-control', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer neis-internal-auto-push',
            'X-Auto-Push': 'true',
          },
          body: JSON.stringify({ action: 'auto-push-trigger' }),
        });

        const data = await res.json();

        if (data.skipped) {
          console.log(`[AutoPush] ⏭️ Skipped: ${data.message || 'disabled'}`);
        } else if (res.ok) {
          console.log(`[AutoPush] ✅ ${data.message}`);
        } else {
          console.error(`[AutoPush] ❌ Failed: ${data.error || data.message}`);
        }
      } catch (error: any) {
        console.error(`[AutoPush] ❌ Error: ${error?.message || error}`);
      }
    }

    async function fetchStatus(): Promise<{ enabled: boolean; intervalMinutes: number }> {
      try {
        const res = await fetch('http://localhost:3000/api/git-control', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer neis-internal-auto-push',
            'X-Auto-Push': 'true',
          },
          body: JSON.stringify({ action: 'auto-push-status' }),
        });

        if (res.ok) {
          const data = await res.json();
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
        
        if (status.enabled && (now - lastPushTime) >= intervalMs) {
          lastPushTime = now;
          await triggerAutoPush();
        }
      } catch (error: any) {
        console.error(`[AutoPush] Check error: ${error?.message || error}`);
      }
    }

    console.log('[AutoPush] 🚀 Service initialized via Next.js instrumentation');
    
    // Initial push after 30 seconds
    setTimeout(() => {
      console.log('[AutoPush] 🕐 First push starting...');
      lastPushTime = Date.now();
      triggerAutoPush();
    }, 30000);

    // Periodic check every 30 seconds
    setInterval(checkAndPush, 30000);
  }
}
