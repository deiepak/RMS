#!/bin/bash
# RMS Database Restore Script
# Restores a MySQL dump file into the Docker container

set -e

if [ -z "$1" ]; then
  echo "Usage: ./restore.sh <path-to-dump.sql>"
  echo ""
  echo "Available backups:"
  ls -lt "$(dirname "$0")/dumps/"*.sql 2>/dev/null || echo "  No backups found."
  exit 1
fi

DUMP_FILE="$1"

if [ ! -f "$DUMP_FILE" ]; then
  echo "❌ File not found: $DUMP_FILE"
  exit 1
fi

echo "⚠️  This will overwrite the current database. Continue? (y/N)"
read -r confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Cancelled."
  exit 0
fi

echo "🗄️  Restoring database from: $DUMP_FILE"
docker exec -i rms_mysql mysql -u rms_user -prms_pass_2026 rms_db < "$DUMP_FILE"

echo "✅ Database restored successfully!"
