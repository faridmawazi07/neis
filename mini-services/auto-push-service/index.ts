/**
 * NEIS Auto-Push Service
 * 
 * Periodically triggers auto-push to GitHub via the Next.js API.
 * This ensures all local changes in the sandbox are backed up to GitHub
 * even if the Admin doesn't manually push.
 * 
 * Default: every 5 minutes
 */

const API_BASE = 'http://localhost:3000';
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Simple admin token for internal auto-push requests
// This uses a shared secret that the API route can validate
const AUTO_PUSH_SECRET = process.env.NEIS_AUTO_PUSH_SECRET || 'neis-internal-auto-push';

let running = true;

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
      console.log(`[${new Date().toISOString()}}] ⏭️  Auto-push skipped (disabled)`);
    } else if (res.ok) {
      console.log(`[${new Date().toISOString()}}] ✅ Auto-push: ${data.message}`);
    } else {
      console.error(`[${new Date().toISOString()}}] ❌ Auto-push failed: ${data.error || data.message}`);
    }
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}()] ❌ Auto-push error: ${error.message}`);
  }
}

// Main loop
async function main() {
  console.log('🚀 NEIS Auto-Push Service started');
  console.log(`📅 Interval: every ${INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`🔗 API: ${API_BASE}/api/git-control`);

  // Initial push after 30 seconds (wait for Next.js to be ready)
  setTimeout(async () => {
    if (running) await triggerAutoPush();
  }, 30000);

  // Periodic push
  const interval = setInterval(async () => {
    if (running) await triggerAutoPush();
  }, INTERVAL_MS);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Auto-push service shutting down...');
    running = false;
    clearInterval(interval);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    running = false;
    clearInterval(interval);
    process.exit(0);
  });
}

main();
