#!/usr/bin/env node

/**
 * Autonomous background runner for TF-Agent recommendation delivery.
 * Triggers tgcloud checkRecommendations endpoint periodically so due recommendations
 * are delivered automatically even if no user is chatting with the bot.
 */

const { exec } = require('child_process');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const NVM_BIN = process.env.NVM_DIR ? `${process.env.NVM_DIR}/versions/node/v22.22.3/bin` : '';
const FULL_PATH = `${NVM_BIN}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`;
const POLL_INTERVAL_MS = 60000; // Check every 1 minute (60 seconds)

let isRunning = false;

function triggerRecommendationCheck() {
  if (isRunning) return;
  isRunning = true;

  const cmd = `npx tgcloud run endpoints/checkRecommendations "{}"`;

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

console.log(` TF-Agent Recommendation daemon started (checking every ${POLL_INTERVAL_MS / 1000}s)`);
setInterval(triggerRecommendationCheck, POLL_INTERVAL_MS);
triggerRecommendationCheck();
