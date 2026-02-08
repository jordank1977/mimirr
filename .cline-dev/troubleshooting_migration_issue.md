# Migration System Issue in Local Development

## Problem Summary

The local development environment has a broken database migration system that prevents proper table creation on fresh installs. This causes the setup wizard to fail when trying to create admin users.

## Root Cause Analysis

### 1. Migration Command Failure
The package.json defines:
```json
"db:migrate": "drizzle-kit migrate"
```

However, this command doesn't exist in your version of drizzle-kit, causing:
```
error: unknown command 'migrate'
```

### 2. LibSQL Library Bug
When attempting to run `npx tsx lib/db/migrate.ts`, the following error occurs:
```
Error: [libsql] Internal error: SQLITE_OK: not an error
```

This is a known bug in the libsql library that prevents proper migration execution.

### 3. Migration Journal Inconsistency
The migration journal (`lib/db/migrations/meta/_journal.json`) doesn't include the new 0011 migration for OnlyThisBook fields, so even if migrations worked, they wouldn't apply the latest changes.

## Docker vs Local Difference

**Docker works correctly** because it uses:
```bash
drizzle-kit push --force
```

This directly syncs the schema from `lib/db/schema.ts` to the database without relying on the broken migration system.

**Local development fails** because it relies on the broken migration approach.

## Solutions

### Immediate Fix (Recommended)
Use schema push instead of migrations:
```bash
# Remove existing database
del config\db.sqlite

# Push schema directly
npx drizzle-kit push

# Start dev server
npm run dev
```

### Long-term Fix
The migration system needs to be fixed by either:
1. Replacing the broken `drizzle-kit migrate` command with proper implementation
2. Adding automatic schema push for local development environments
3. Updating documentation to always use schema push for local dev

## Verification

After applying the fix, you should see:
- Database tables created properly (users, requests, etc.)
- Setup wizard completes successfully
- Admin user can be created without errors
