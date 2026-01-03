#!/bin/sh
set -e

# Fix permissions on config directory (mounted volume) as root
echo "Fixing config directory permissions..."
chown -R nextjs:nodejs /app/config

# Switch to nextjs user and run migrations + server
echo "Running database migrations as nextjs user..."
gosu nextjs npx drizzle-kit migrate || {
  echo "Warning: Migrations failed, but continuing startup..."
}

echo "Starting application as nextjs user..."
exec gosu nextjs node server.js
