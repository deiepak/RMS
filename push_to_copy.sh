#!/bin/bash

# Configuration for the Copy Website
SERVER_IP="adventinfosys"
SERVER_USER="adventinfosys"

echo "🚀 Syncing local changes to the Copy VPS..."
# This will copy any modified files from your computer to the server
rsync -avz --exclude 'node_modules' --exclude '.git' ./ ${SERVER_USER}@${SERVER_IP}:~/RMS/

echo "⚙️ Rebuilding and restarting the application on the Copy VPS..."
# This logs into the server and runs the deployment script to apply the changes
ssh ${SERVER_USER}@${SERVER_IP} "cd ~/RMS && ./deploy.sh"

echo "✅ Update complete! Your copy server has been updated."
