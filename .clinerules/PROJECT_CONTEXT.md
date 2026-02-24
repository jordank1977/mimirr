# Project Context

## 1. PROJECT OVERVIEW

**Mimirr** is a self-hosted book discovery and request management system designed for book enthusiasts running personal media servers. It integrates with **Bookshelf** for downloading books and uses **Bookinfo.pro** / **Hardcover** for metadata.

**Core Features:**
- **Book Discovery**: Search and browse books with rich metadata.
- **Smart Requests**: Request books with customizable quality profiles.
- **Multi-User**: Role-based access (Admin/User) with approval workflows.
- **Notifications**: Discord webhooks and internal notifications for request updates.
- **Personalization**: Recommendation engine based on user preferences.
- **Monitoring**: Ability to monitor specific books or authors ("Only This Book").

## 2. ARCHITECTURE

**Tech Stack:**
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, Shadcn/UI.
- **Backend**: Next.js API Routes.
- **Database**: SQLite (via LibSQL) with Drizzle ORM.
- **Authentication**: Custom JWT implementation with HTTP-only cookies (`lib/middleware/auth.middleware.ts`).
- **Validation**: Zod schemas (`lib/utils/validation.ts`).

**Key Components:**
- **Service Layer** (`lib/services/`): Encapsulates business logic.
  - `RequestService`: Manages book requests and status polling.
  - `BookService`: Interfaces with metadata providers. Includes resilient fetching logic for bulk operations.
  - `BookshelfService`: Interfaces with the Bookshelf download manager.
  - `NotificationService`: Handles internal and Discord notifications.
  - `RecommendationService`: Generates personalized book suggestions.
- **Database Layer** (`lib/db/`):
  - `schema.ts`: Defines Drizzle ORM schema.
  - `migrations/`: SQL migration files.
- **API Layer** (`app/api/`): Next.js route handlers exposing endpoints for the frontend.
- **Configuration**:
  - `drizzle.config.ts`: Uses `dotenv` to load environment variables for local development.

**Infrastructure:**
- Docker & Docker Compose for containerization.
- SQLite database persisted via volume mount.
- **Logging**: Custom logger (`lib/utils/logger.ts`) with proper Error object serialization.

## 3. CONVENTIONS

- **Language**: TypeScript throughout.
- **Database Management**: Drizzle Kit for schema management and migrations.
- **Styling**: Tailwind CSS with utility classes.
- **Component Library**: Shadcn/UI components located in `components/ui/`.
- **Project Structure**:
  - `app/`: Next.js App Router pages and API routes.
  - `components/`: Reusable React components.
  - `lib/`: Shared utilities, database config, and business logic services.
  - `types/`: Global type definitions.
  - `.cline-dev/`: Developer documentation and plans.
  - `.clinerules/`: Context and rules for AI assistants.

## 4. CURRENT STATE

- **Status**: Active Development.
- **Latest Feature**: "Only This Book" monitoring (Migration 0011), allowing users to track specific books/authors.
- **Database Schema**:
  - `users`: User accounts and roles.
  - `requests`: Book requests with status tracking.
  - `book_cache`: Cached metadata from Hardcover.
  - `settings`: System configuration.
  - `notifications` / `notification_settings`: Notification system.
  - `user_preferences`: User-specific recommendation data.
  - `quality_profile_configs`: Integration settings for Bookshelf quality profiles.
- **Resolved Issues**:
  - Updated default application port to 8788 (from 3000) to resolve Dockge defaults conflict.
  - Fixed "Failed to get books by IDs" error by adding individual error handling in `BookService`.
  - Fixed logger swallowing Error details.
  - Fixed `local_dev_workflow.md` PowerShell compatibility issues.
- **Repository**: Hosted at `https://github.com/jordank1977/mimirr` (Fresh push as of 2026-02-07).

## 5. CHANGELOG

Recent database migrations (`lib/db/migrations`):
- **0011**: Add "Only This Book" monitoring fields (`foreign_book_id`, `foreign_author_id`, `monitoring_option`).
- **0010**: Add recommendation caching.
- **0009**: Add quality profile configs.
- **0008**: Add user preferences table.
- **0007**: Add notifications.
- **0006**: Rename tutorial preference.
- **0005**: Add user preferences.
- **0004**: Fix foreign keys.
- **0003**: Add polling fields.
- **0002**: Add quality profile.

## 6. QUICK REFERENCE

**Environment**
- You are executing all commands on PowerShell in Windows 10.
- **Repository**: `https://github.com/jordank1977/mimirr`

**Commands:**
- `npm run dev`: Start development server.
- `npm run db:generate`: Generate SQL migrations from schema changes.
- `npm run db:migrate`: Apply pending migrations to the database (use `drizzle-kit push` for local dev).
- `npm run db:studio`: Open Drizzle Studio to inspect the database.

**Ports:**
- **Web Interface**: 8788 (default)

**Environment Variables**:
- `DATABASE_URL`: Path to SQLite database (e.g., `file:local.db`).
- `JWT_SECRET`: Secret for signing tokens.

## SESSION CHANGELOG (2026-02-24 - 10:41 AM)
- Fixed `TypeError: Cannot read properties of undefined (reading 'discordEnabled')` in `NotificationService.updateSettings`.
- Implemented automatic creation of notification settings row (ID 1) if it doesn't exist during update.
- Pushed fix to GitHub.

## SESSION CHANGELOG (2026-02-07 - 11:21 PM)
- Updated default application port from 3000 to 8788 in `Dockerfile`, `docker-compose.yml`, and documentation files.
- Verified Docker build configuration and port mappings.
- Pushed changes to `master` branch.

## SESSION CHANGELOG (2026-02-07 - 9:48 PM)
- Reset local git repository to remove all history containing sensitive user information.
- Initialized fresh git repository and configured user as `jordank1977 <jordank1977@proton.me>`.
- Pushed initial commit to new remote `https://github.com/jordank1977/mimirr`.

## SESSION CHANGELOG (2026-02-07 - 9:28 PM)
- Fixed `Failed to get books by IDs` error in `BookService` by implementing resilient bulk fetching.
- Updated `lib/utils/logger.ts` to properly serialize Error objects using a custom JSON replacer.
- Updated `.clinerules/workflows/local_dev_workflow.md` with PowerShell commands to resolve `ParserError`.
- Updated `drizzle.config.ts` to load environment variables using `dotenv` (added as dev dependency).
- Verified local development workflow and server startup.

## SESSION CHANGELOG (2026-02-07 - 8:52 PM)
- Initial population of PROJECT_CONTEXT.md based on codebase analysis.
