#!/usr/bin/env node

/**
 * Autonomous background runner for TF-Agent auto-post schedules.
 * Triggers tgcloud autoPost endpoint periodically so due posts are published
 * automatically even if no user is chatting with the bot.
 */

const { exec } = require('child_process');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const TGCLOUD_BIN = path.resolve(PROJECT_DIR, 'node_modules/.bin/tgcloud');
const NODE_BIN_DIR = path.dirname(process.execPath);
const FULL_PATH = `${NODE_BIN_DIR}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`;
const POLL_INTERVAL_MS = 5000; // Check every 5 seconds for rapid testing & scheduled posting

let isRunning = false;

function triggerAutoPost() {
  if (isRunning) return;
  isRunning = true;

  const cmd = `"${process.execPath}" "${TGCLOUD_BIN}" run endpoints/autoPost "{}"`;

  exec(cmd, { 
    cwd: PROJECT_DIR,
    env: { ...process.env, PATH: FULL_PATH }
  }, (error, stdout, stderr) => {
    isRunning = false;
    if (error) {
      console.error(`[AutoPost Error ${new Date().toISOString()}]:`, error.message);
      return;
    }
    const combined = `${stdout}\n${stderr}`;
    if (combined.includes('processed: 1') || combined.includes('processed:1') || (combined.includes('processed') && !combined.includes('processed: 0') && !combined.includes('processed:0'))) {
      console.log(`[AutoPost Runner ${new Date().toISOString()}] Successfully published auto post! Output:`, stdout.trim());
    }
  });
}

console.log(`🤖 TF-Agent Auto-Post daemon started (checking every ${POLL_INTERVAL_MS / 1000}s)`);
setInterval(triggerAutoPost, POLL_INTERVAL_MS);
triggerAutoPost();
