#!/bin/bash
# RMS Database Backup Script
# Dumps MySQL database and optionally commits to GitHub

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DUMP_DIR="$SCRIPT_DIR/dumps"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DUMP_FILE="$DUMP_DIR/rms_backup_$TIMESTAMP.sql"

# Ensure dump directory exists
mkdir -p "$DUMP_DIR"

echo "🗄️  Starting database backup..."

# Dump from Docker container
docker exec rms_mysql mysqldump -u rms_user -prms_pass_2026 rms_db > "$DUMP_FILE"

echo "✅ Backup saved to: $DUMP_FILE"

# Keep only last 5 backups
cd "$DUMP_DIR"
ls -t rms_backup_*.sql | tail -n +6 | xargs -r rm --

# Git commit and push if in a git repo
if git -C "$SCRIPT_DIR/.." rev-parse --git-dir > /dev/null 2>&1; then
  echo "📦 Committing backup to Git..."
  cd "$SCRIPT_DIR/.."
  git add "backup/dumps/$DUMP_FILE"
  git commit -m "backup: database dump $TIMESTAMP" || true
  git push origin main 2>/dev/null || git push origin master 2>/dev/null || echo "⚠️  Could not push to remote. Push manually."
  echo "✅ Backup committed and pushed."
else
  echo "⚠️  Not a git repository. Skipping git commit."
fi

echo "🎉 Backup complete!"
