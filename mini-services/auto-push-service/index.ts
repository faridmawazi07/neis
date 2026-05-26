/**
 * NEIS Auto-Push Service
 * 
 * Periodically triggers auto-push to GitHub via the Next.js API.
 * This ensures all local changes in the sandbox are backed up to GitHub
 * even if the Admin doesn't manually push.
 * 
 * Interval is read dynamically from the API (configurable by admin in UI).
 * Default: every 5 minutes
 */

const API_BASE = 'http://localhost:3000';
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds

// Simple admin token for internal auto-push requests
const AUTO_PUSH_SECRET = process.env.NEIS_AUTO_PUSH_SECRET || 'neis-internal-auto-push';

let currentIntervalMs = DEFAULT_INTERVAL_MS;
let lastPushTime = 0;

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] 💥 Uncaught Exception:`, err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] 💥 Unhandled Rejection:`, reason);
});

async function triggerAutoPush(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔄 Auto-push triggered...`);

  try {
    const res = await fetch(`${API_BASE}/api/git-control`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTO_PUSH_SECRET}`,
        'X-Auto-Push': 'true',
      },
      body: JSON.stringify({ action: 'auto-push-trigger' }),
    });

    const data = await res.json();

    if (data.skipped) {
      console.log(`[${new Date().toISOString()}] ⏭️  Auto-push skipped: ${data.message || 'disabled'}`);
    } else if (res.ok) {
      console.log(`[${new Date().toISOString()}] ✅ Auto-push: ${data.message}`);
    } else {
      console.error(`[${new Date().toISOString()}] ❌ Auto-push failed: ${data.error || data.message}`);
    }
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] ❌ Auto-push error: ${error?.message || error}`);
  }
}

async function fetchAutoPushStatus(): Promise<{ enabled: boolean; intervalMinutes: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/git-control`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTO_PUSH_SECRET}`,
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
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Status fetch error: ${e}`);
  }
  return { enabled: true, intervalMinutes: 5 };
}

async function checkAndPush() {
  try {
    const status = await fetchAutoPushStatus();
    const newIntervalMs = status.intervalMinutes * 60 * 1000;

    if (newIntervalMs !== currentIntervalMs) {
      console.log(`📅 Interval changed: ${currentIntervalMs / 1000 / 60} min → ${status.intervalMinutes} min`);
      currentIntervalMs = newIntervalMs;
    }

    const now = Date.now();
    if (status.enabled && (now - lastPushTime) >= currentIntervalMs) {
      lastPushTime = now;
      await triggerAutoPush();
    }
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Check error: ${error?.message || error}`);
  }
}

console.log('🚀 NEIS Auto-Push Service started');
console.log(`📅 Default interval: every ${DEFAULT_INTERVAL_MS / 1000 / 60} minutes`);
console.log(`🔗 API: ${API_BASE}/api/git-control`);
console.log(`🆔 PID: ${process.pid}`);

// Initial push after 30 seconds
setTimeout(() => {
  console.log(`[${new Date().toISOString()}] 🕐 Initial push starting...`);
  lastPushTime = Date.now();
  triggerAutoPush().catch(e => console.error('Initial push error:', e));
}, 30000);

// Periodic check every 30 seconds
const mainInterval = setInterval(() => {
  checkAndPush().catch(e => console.error('Check and push error:', e));
}, CHECK_INTERVAL_MS);

// Ensure interval ref is never garbage collected
if (mainInterval) {
  console.log('✅ Main interval set up successfully');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Auto-push service shutting down...');
  clearInterval(mainInterval);
  process.exit(0);
});

process.on('SIGTERM', () => {
  clearInterval(mainInterval);
  process.exit(0);
});

console.log(`[${new Date().toISOString()}] ✅ Service running, waiting for first push in 30s...`);
