# Local Development Setup Guide

This guide explains how to set up and run the Mimirr application locally on Windows for testing the new OnlyThisBook feature.

## Prerequisites

- Node.js (v18 or higher) installed
- npm (usually comes with Node.js)
- Git (for version control)

## Setup Steps

### 1. Environment Configuration

Copy the example environment file:
```bash
copy .env.example .env.local
```

Edit `.env.local` to configure your development settings.

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Initialization (Critical Fix for Local Development)

**Important**: Due to a known issue with the migration system in local development, you need to use schema push instead of migrations for proper table creation. Run these commands in sequence:

```bash
# Remove existing database file
del config\db.sqlite

# Push schema directly to database (bypasses broken migration system)
npx drizzle-kit push

# Or alternatively, if the above fails:
# npx drizzle-kit push --force
```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Troubleshooting - Admin User Creation Failure

If you encounter errors during setup when trying to create an admin user, this is because the database tables haven't been created. The local development environment has a broken migration system that prevents proper table creation.

**Solution**: Use the schema push method above to initialize the database properly.

## Testing OnlyThisBook Feature

Once the development server is running, you can test the OnlyThisBook functionality by:

1. Creating a request with `monitoringOption` set to `"specificBook"`
2. Using the API endpoints that support this feature
3. Verifying that the new database fields (`foreignBookId`, `foreignAuthorId`, `monitoringOption`) are properly populated

## Useful Commands

- `npm run db:studio` - Open Drizzle Studio for database inspection (will work after proper setup)
- `npm run lint` - Run code linting
- `npm run build` - Build for production (optional)
