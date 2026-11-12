#!/usr/bin/env node

/**
 * Autonomous background runner for TF-Agent recommendation delivery.
 * Triggers tgcloud checkRecommendations endpoint periodically so due recommendations
 * are delivered automatically even if no user is chatting with the bot.
 */

const { exec } = require('child_process');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const TGCLOUD_BIN = path.resolve(PROJECT_DIR, 'node_modules/.bin/tgcloud');
const NODE_BIN_DIR = path.dirname(process.execPath);
const FULL_PATH = `${NODE_BIN_DIR}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`;
const POLL_INTERVAL_MS = 60000; // Check every 1 minute (60 seconds)

let isRunning = false;

function triggerRecommendationCheck() {
  if (isRunning) return;
  isRunning = true;

  const cmd = `"${process.execPath}" "${TGCLOUD_BIN}" run endpoints/checkRecommendations "{}"`;

  exec(cmd, {
    cwd: PROJECT_DIR,
    env: { ...process.env, PATH: FULL_PATH }
  }, (error, stdout, stderr) => {
    isRunning = false;
    if (error) {
      console.error(`[Recommendation Error ${new Date().toISOString()}]:`, error.message);
      return;
    }
    const combined = `${stdout}\n${stderr}`;
    // Log if any recommendations were processed
    if (combined.includes('processed:') && !combined.includes('processed: 0') && !combined.includes('processed:0')) {
      console.log(`[Recommendation Runner ${new Date().toISOString()}] Successfully processed recommendations! Output:`, stdout.trim());
    }
  });
}

console.log(`TF-Agent Recommendation daemon started (checking every ${POLL_INTERVAL_MS / 1000}s)`);
setInterval(triggerRecommendationCheck, POLL_INTERVAL_MS);
triggerRecommendationCheck();
