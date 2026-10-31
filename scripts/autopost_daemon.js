#!/usr/bin/env node

/**
 * Autonomous background runner for TF-Agent auto-post schedules.
 * Triggers tgcloud autoPost endpoint periodically so due posts are published
 * automatically even if no user is chatting with the bot.
 */

const { exec } = require('child_process');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const POLL_INTERVAL_MS = 5000; // Check every 5 seconds for test mode & rapid posting

let isRunning = false;

function triggerAutoPost() {
  if (isRunning) return;
  isRunning = true;

  exec('npx tgcloud run endpoints/autoPost "{}"', { cwd: PROJECT_DIR }, (error, stdout, stderr) => {
    isRunning = false;
    if (error) {
      // Ignore routine noise
      return;
    }
    try {
      if (stdout && stdout.includes('"processed":') && !stdout.includes('"processed":0')) {
        console.log(`[AutoPost Runner ${new Date().toISOString()}] Post processed:`, stdout.trim());
      }
    } catch (_) {}
  });
}

console.log(`🤖 TF-Agent Auto-Post daemon started (checking every ${POLL_INTERVAL_MS / 1000}s)`);
setInterval(triggerAutoPost, POLL_INTERVAL_MS);
triggerAutoPost();
