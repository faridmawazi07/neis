#!/bin/bash
# Persistent Next.js starter - survives bash session termination
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js dev server..." >> /tmp/next-watchdog.log
  node node_modules/.bin/next dev -p 3000 >> /tmp/next-server.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Next.js exited with code $EXIT_CODE, restarting in 2s..." >> /tmp/next-watchdog.log
  sleep 2
done
