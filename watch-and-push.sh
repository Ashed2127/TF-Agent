#!/bin/bash

# Continuous monitoring script to track changes and push to GitHub
# Checks for changes every 10 seconds (reasonable interval to avoid overwhelming GitHub)

INTERVAL=10
LOG_FILE="/home/ashed/Desktop/TF-Agent/git-monitor.log"

echo "Starting git monitoring at $(date)" >> "$LOG_FILE"
echo "Checking for changes every $INTERVAL seconds..." >> "$LOG_FILE"

while true; do
    cd /home/ashed/Desktop/TF-Agent
    
    # Check if there are any changes
    if git diff --quiet && git diff --cached --quiet; then
        echo "$(date): No changes detected" >> "$LOG_FILE"
    else
        echo "$(date): Changes detected!" >> "$LOG_FILE"
        
        # Get list of changed files
        CHANGED_FILES=$(git status --porcelain)
        echo "Changed files: $CHANGED_FILES" >> "$LOG_FILE"
        
        # Get diff for reference
        git diff >> "$LOG_FILE" 2>&1
        
        # Add all changes
        git add -A
        
        # Create commit with auto-generated message
        COMMIT_MESSAGE="Auto-commit: $(git status --porcelain | wc -l) file(s) updated - $(date '+%Y-%m-%d %H:%M:%S')"
        
        git commit -m "$COMMIT_MESSAGE" >> "$LOG_FILE" 2>&1
        
        if [ $? -eq 0 ]; then
            echo "Commit successful: $COMMIT_MESSAGE" >> "$LOG_FILE"
            
            # Push to GitHub
            git push origin main >> "$LOG_FILE" 2>&1
            
            if [ $? -eq 0 ]; then
                echo "Push successful at $(date)" >> "$LOG_FILE"
            else
                echo "Push failed at $(date)" >> "$LOG_FILE"
            fi
        else
            echo "Commit failed at $(date)" >> "$LOG_FILE"
        fi
    fi
    
    sleep $INTERVAL
done