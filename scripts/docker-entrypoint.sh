#!/bin/sh
set -e

# Fix permissions on config directory (mounted volume) as root
echo "Fixing config directory permissions..."
chown -R nextjs:nodejs /app/config

# Switch to nextjs user and sync database schema
echo "Syncing database schema as nextjs user..."
gosu nextjs npx drizzle-kit push --force || {
  echo "Warning: Schema push failed, but continuing startup..."
}

echo "Starting application as nextjs user..."
exec gosu nextjs node server.js
