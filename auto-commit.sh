#!/bin/bash

# Auto-commit and push script for TF-Agent project
# This script monitors for changes and automatically commits and pushes them

REPO_PATH="/home/ashed/Desktop/TF-Agent"
cd "$REPO_PATH" || exit 1

echo "Starting auto-commit script for TF-Agent..."
echo "Monitoring repository: $REPO_PATH"
echo "Press Ctrl+C to stop"
echo "----------------------------------------"

while true; do
    # Check if there are any changes (including untracked files)
    if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] No changes detected, waiting..."
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Changes detected!"
        
        # Show what changed
        echo "Changed files:"
        git status --short
        
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
        if git commit -m "$COMMIT_MSG"; then
            echo "✓ Changes committed successfully"
            
            # Push to GitHub
            echo "Pushing to GitHub..."
            if git push origin main; then
                echo "✓ Pushed to GitHub successfully"
            else
                echo "✗ Failed to push to GitHub (check authentication or network)"
            fi
        else
            echo "✗ Failed to commit changes (nothing to commit or error occurred)"
        fi
    fi
    
    # Wait for 30 seconds before checking again
    sleep 30
done
