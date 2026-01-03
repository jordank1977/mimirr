#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit migrate || {
  echo "Warning: Migrations failed, but continuing startup..."
}

echo "Starting application..."
exec node server.js
