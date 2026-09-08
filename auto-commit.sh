#!/bin/bash

# Auto-commit and push script for TF-Agent project
# This script monitors for changes and automatically commits and pushes them

REPO_PATH="/home/ashed/Desktop/TF-Agent"
LOG_FILE="/home/ashed/Desktop/TF-Agent/auto-commit.log"

cd "$REPO_PATH" || exit 1

echo "Starting auto-commit script for TF-Agent..." >> "$LOG_FILE"
echo "Monitoring repository: $REPO_PATH" >> "$LOG_FILE"
echo "Press Ctrl+C to stop" >> "$LOG_FILE"
echo "----------------------------------------" >> "$LOG_FILE"

while true; do
    # Check if there are any changes (including untracked files)
    if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] No changes detected, waiting..." >> "$LOG_FILE"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Changes detected!" >> "$LOG_FILE"
        
        # Show what changed
        echo "Changed files:" >> "$LOG_FILE"
        git status --short >> "$LOG_FILE"
        
        # Add all changes
        git add .
        
        # Generate commit message based on changes
        COMMIT_MSG="Auto-commit: $(date '+%Y-%m-%d %H:%M:%S')"
        
        # Try to get more specific commit message based on changed files
        CHANGED_FILES=$(git diff --cached --name-only)
        if [ -n "$CHANGED_FILES" ]; then
            FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l)
            COMMIT_MSG="Auto-commit: $FILE_COUNT file(s) updated - $(date '+%Y-%m-%d %H:%M:%S')"
        fi
        
        # Commit changes
        if git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1; then
            echo "✓ Changes committed successfully" >> "$LOG_FILE"
            
            # Push to GitHub
            echo "Pushing to GitHub..." >> "$LOG_FILE"
            if git push origin main >> "$LOG_FILE" 2>&1; then
                echo "✓ Pushed to GitHub successfully" >> "$LOG_FILE"
            else
                echo "✗ Failed to push to GitHub (check authentication or network)" >> "$LOG_FILE"
            fi
        else
            echo "✗ Failed to commit changes (nothing to commit or error occurred)" >> "$LOG_FILE"
        fi
    fi
    
    # Wait for 5 seconds before checking again
    sleep 5
done
