#!/bin/bash

# Setup cron jobs for TF-Agent auto-features
# This script sets up cron jobs to trigger auto-post and auto-recommendation endpoints

# The bot's endpoint URL
BOT_URL="https://app8909892200.tgcloud.ai"

echo "Setting up cron jobs for TF-Agent..."
echo ""

# Add cron job for auto-post (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * curl -s ${BOT_URL}/api/autoPost > /dev/null 2>&1") | crontab -
echo "✅ Auto-post cron job added (runs every 5 minutes)"

# Add cron job for auto-recommendations (every 1 minute)
(crontab -l 2>/dev/null; echo "* * * * * curl -s ${BOT_URL}/api/checkRecommendations > /dev/null 2>&1") | crontab -
echo "✅ Auto-recommendation cron job added (runs every 1 minute)"

echo ""
echo "Current crontab:"
crontab -l
echo ""
echo "Done! Cron jobs will now run automatically in the background."
