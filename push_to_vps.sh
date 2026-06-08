#!/bin/bash

# Configuration
SERVER_IP="176.103.218.35"
SERVER_USER="root"

echo "🚀 Syncing local changes to the VPS..."
# This will copy any modified files from your computer to the server
rsync -avz --exclude 'node_modules' --exclude '.git' ./ ${SERVER_USER}@${SERVER_IP}:~/RMS/

echo "⚙️ Rebuilding and restarting the application on the VPS..."
# This logs into the server and runs the deployment script to apply the changes
ssh ${SERVER_USER}@${SERVER_IP} "cd ~/RMS && ./deploy.sh"

echo "✅ Update complete! Your live server has been updated."
