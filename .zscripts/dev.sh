#!/bin/bash

set -euo pipefail

# 获取脚本所在目录（.zscripts）
# 使用 $0 获取脚本路径（与 build.sh 保持一致）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log_step_start() {
        local step_name="$1"
        echo "=========================================="
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting: $step_name"
        echo "=========================================="
        export STEP_START_TIME
        STEP_START_TIME=$(date +%s)
}

log_step_end() {
        local step_name="${1:-Unknown step}"
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - STEP_START_TIME))
        echo "=========================================="
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Completed: $step_name"
        echo "[LOG] Step: $step_name | Duration: ${duration}s"
        echo "=========================================="
        echo ""
}

start_mini_services() {
        local mini_services_dir="$PROJECT_DIR/mini-services"
        local started_count=0

        log_step_start "Starting mini-services"
        if [ ! -d "$mini_services_dir" ]; then
                echo "Mini-services directory not found, skipping..."
                log_step_end "Starting mini-services"
                return 0
        fi

        echo "Found mini-services directory, scanning for sub-services..."

        for service_dir in "$mini_services_dir"/*; do
                if [ ! -d "$service_dir" ]; then
                        continue
                fi

                local service_name
                service_name=$(basename "$service_dir")
                echo "Checking service: $service_name"

                if [ ! -f "$service_dir/package.json" ]; then
                        echo "[$service_name] No package.json found, skipping..."
                        continue
                fi

                if ! grep -q '"dev"' "$service_dir/package.json"; then
                        echo "[$service_name] No dev script found, skipping..."
                        continue
                fi

                echo "Starting $service_name in background..."
                (
                        cd "$service_dir"
                        echo "[$service_name] Installing dependencies..."
                        bun install
                        echo "[$service_name] Running bun run dev..."
                        exec bun run dev
                ) >"$PROJECT_DIR/.zscripts/mini-service-${service_name}.log" 2>&1 &

                local service_pid=$!
                echo "[$service_name] Started in background (PID: $service_pid)"
                echo "[$service_name] Log: $PROJECT_DIR/.zscripts/mini-service-${service_name}.log"
                disown "$service_pid" 2>/dev/null || true
                started_count=$((started_count + 1))
        done

        echo "Mini-services startup completed. Started $started_count service(s)."
        log_step_end "Starting mini-services"
}

wait_for_service() {
        local host="$1"
        local port="$2"
        local service_name="$3"
        local max_attempts="${4:-60}"
        local attempt=1

        echo "Waiting for $service_name to be ready on $host:$port..."

        while [ "$attempt" -le "$max_attempts" ]; do
                if curl -s --connect-timeout 2 --max-time 5 "http://$host:$port" >/dev/null 2>&1; then
                        echo "$service_name is ready!"
                        return 0
                fi

                echo "Attempt $attempt/$max_attempts: $service_name not ready yet, waiting..."
                sleep 1
                attempt=$((attempt + 1))
        done

        echo "ERROR: $service_name failed to start within $max_attempts seconds"
        return 1
}

cleanup() {
        if [ -n "${DEV_PID:-}" ] && kill -0 "$DEV_PID" >/dev/null 2>&1; then
                echo "Stopping Next.js dev server (PID: $DEV_PID)..."
                kill "$DEV_PID" >/dev/null 2>&1 || true
        fi
}

trap cleanup EXIT INT TERM

cd "$PROJECT_DIR"

if ! command -v bun >/dev/null 2>&1; then
        echo "ERROR: bun is not installed or not in PATH"
        exit 1
fi

# ========== NEIS AUTO-RECOVERY FROM GITHUB ==========
# If sandbox was reset, pull latest code from GitHub to restore changes
log_step_start "NEIS auto-recovery check"
NEIS_ENV_FILE="$PROJECT_DIR/.neis.env"
if [ -f "$NEIS_ENV_FILE" ]; then
        # Read PAT parts from .neis.env
        GH_P1=$(grep 'NEIS_GH_P1=' "$NEIS_ENV_FILE" | cut -d'=' -f2 | tr -d ' ')
        GH_P2=$(grep 'NEIS_GH_P2=' "$NEIS_ENV_FILE" | cut -d'=' -f2 | tr -d ' ')
        GH_P3=$(grep 'NEIS_GH_P3=' "$NEIS_ENV_FILE" | cut -d'=' -f2 | tr -d ' ')
        GH_PAT="${GH_P1}${GH_P2}${GH_P3}"
        GH_REPO="faridmawazi07/neis.git"

        if [ -n "$GH_PAT" ] && [ ${#GH_PAT} -gt 10 ]; then
                # Set remote with PAT
                git remote set-url origin "https://faridmawazi07:${GH_PAT}@github.com/${GH_REPO}" 2>/dev/null || true

                # Fetch from GitHub
                echo "[NEIS] Fetching from GitHub to check for updates..."
                if git fetch origin main 2>/dev/null; then
                        LOCAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
                        REMOTE_COMMIT=$(git rev-parse origin/main 2>/dev/null || echo "unknown")

                        if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
                                echo "[NEIS] 🔄 Sandbox reset detected! Local is behind remote."
                                echo "[NEIS] Local:  $LOCAL_COMMIT"
                                echo "[NEIS] Remote: $REMOTE_COMMIT"
                                echo "[NEIS] Restoring code from GitHub..."
                                git reset --hard origin/main 2>/dev/null
                                echo "[NEIS] ✅ Code restored from GitHub!"
                        else
                                echo "[NEIS] ✅ Local is up to date with GitHub."
                        fi
                else
                        echo "[NEIS] ⚠️ Could not fetch from GitHub (network issue?)"
                fi

                # Reset remote URL (remove PAT)
                git remote set-url origin "https://github.com/${GH_REPO}" 2>/dev/null || true
        else
                echo "[NEIS] ⚠️ GitHub PAT not found in .neis.env, skipping auto-recovery"
        fi
else
        echo "[NEIS] ⚠️ .neis.env not found, skipping auto-recovery"
fi
log_step_end "NEIS auto-recovery check"

log_step_start "bun install"
echo "[BUN] Installing dependencies..."
bun install
log_step_end "bun install"

log_step_start "bun run db:push"
echo "[BUN] Setting up database..."
bun run db:push
log_step_end "bun run db:push"

log_step_start "Starting Next.js dev server"
echo "[BUN] Starting development server..."
bun run dev &
DEV_PID=$!
log_step_end "Starting Next.js dev server"

log_step_start "Waiting for Next.js dev server"
wait_for_service "localhost" "3000" "Next.js dev server"
log_step_end "Waiting for Next.js dev server"

log_step_start "Health check"
echo "[BUN] Performing health check..."
curl -fsS localhost:3000 >/dev/null
echo "[BUN] Health check passed"
log_step_end "Health check"

start_mini_services

echo "Next.js dev server is running in background (PID: $DEV_PID)."
echo "Use 'kill $DEV_PID' to stop it."
disown "$DEV_PID" 2>/dev/null || true
unset DEV_PID
