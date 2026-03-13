# 📚 Mimirr

**Automated book discovery and homelab workflow engine**

[![Docker Pulls](https://img.shields.io/docker/pulls/jordank1977/mimirr?style=flat-square)](https://github.com/jordank1977/mimirr/pkgs/container/mimirr)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

## 🎯 What is Mimirr?

Mimirr is a self-hosted book discovery and request management system that bridges your frontend reading experience with backend homelab automation. It transforms your personal media server into an intelligent book discovery platform by integrating with **Readarr (Bookshelf)** for automated downloads and **BookLore** for comprehensive library management.

Unlike simple request systems, Mimirr orchestrates complete workflow automation—from discovery and approval to download and library synchronization—creating a seamless bridge between your reading preferences and your homelab infrastructure.

## ✨ Core Features

### 🔄 Automated Request Lifecycles
- **Intelligent Polling Engine**: Continuously monitors request status and automatically advances requests through approval → processing → available stages
- **Historical Search Triggers**: Automatically searches for approved books in your download manager
- **State Management**: Full lifecycle tracking with automatic status updates and user notifications

### 🧠 Smart Discovery & Recommendations
- **User Preference Tracking**: Analyzes reading habits to build personalized mood and pace profiles
- **Recommendation Engine**: Suggests books based on aggregated user preferences and reading history
- **Metadata Enrichment**: Caches book metadata with mood and pace classifications for smarter recommendations

### 🏠 Homelab Integrations
- **Readarr (Bookshelf) Integration**: Automated book downloads with customizable quality profiles
- **BookLore Integration**: Library management, scanning, and metadata synchronization
- **Library Mirroring**: Real-time synchronization between your download manager and reading library

### 👥 Role-Based Access Control
- **Admin Experience**: Full system control, request approval, user management, and integration configuration
- **User Experience**: Intuitive discovery interface, request tracking, and personalized recommendations
- **Granular Permissions**: Fine-grained control over system features and user capabilities

### 🔔 Notification Engine
- **Discord Webhooks**: Real-time status updates for request approvals, downloads, and system events
- **In-App Notifications**: User-specific alerts for request status changes and system updates
- **Configurable Alerts**: Customizable notification preferences per user and event type

## 🚀 Prerequisites & Setup

Before deploying Mimirr, ensure you have:

### Required Services
- **Readarr (Bookshelf)**: Version 1.0+ with API access enabled
- **BookLore**: Self-hosted book library management system
- **Discord Server**: For webhook notifications (optional but recommended)

### Credentials Needed
- Readarr API key and base URL
- BookLore URL, username, password, and library ID
- Discord webhook URL (for notifications)

## 🐳 Deployment

### Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  mimirr:
    image: ghcr.io/jordank1977/mimirr:latest
    container_name: mimirr
    ports:
      - "8788:8788"
    volumes:
      # Persist SQLite database and logs
      - mimirr-data:/app/config
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/config/db.sqlite
      # Optional: Set JWT_SECRET to persist sessions across restarts
      # - JWT_SECRET=your-secret-key-here
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8788/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  mimirr-data:
    driver: local
```

Start the container:
```bash
docker-compose up -d
```

### Docker Run (Quick Start)
```bash
docker run -d \
  --name mimirr \
  -p 8788:8788 \
  -v mimirr-data:/app/config \
  ghcr.io/jordank1977/mimirr:latest
```

## ⚙️ Configuration Guide

After deployment, access Mimirr at `http://localhost:8788` and complete the setup:

### 1. Initial Setup Wizard
- Create your administrator account
- Configure basic system settings
- Set up initial integrations

### 2. Admin Settings Dashboard
Navigate to **Settings → Integrations** to configure:

#### Bookshelf (Readarr) Integration
1. Enter your Bookshelf URL (e.g., `http://localhost:8787`)
2. Add your Bookshelf API key
3. Test the connection
4. Sync quality profiles for request customization

#### BookLore Integration
1. Configure BookLore URL, username, and password
2. Set the target library ID
3. Test authentication and connection
4. Enable library scanning and synchronization

#### Discord Notifications
1. Create a webhook in your Discord server
2. Add the webhook URL to Mimirr
3. Configure which events trigger notifications
4. Test notification delivery

### 3. User Management
- Add additional users with appropriate roles
- Configure user permissions and access levels
- Set up personalized recommendation preferences

## 🔧 Environment Variables

Mimirr supports the following environment variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | SQLite database file path | `file:./config/db.sqlite` | No |
| `NODE_ENV` | Application environment | `development` | No |
| `PORT` | Application port | `3000` (dev) / `8788` (prod) | No |
| `JWT_SECRET` | JWT signing secret | Auto-generated | No |
| `JWT_EXPIRES_IN` | JWT token expiration | `7d` | No |

**Note**: Most configuration is managed through the web interface after initial deployment. Environment variables are primarily for advanced deployment scenarios.

## 🏗️ Technology Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Language**: TypeScript 5.7
- **Database**: SQLite with Drizzle ORM
- **Styling**: Tailwind CSS with Shadcn/UI components
- **Authentication**: Custom JWT with HTTP-only cookies
- **Logging**: Pino NDJSON with daily rotation
- **Container**: Docker with multi-architecture support

## 📦 Docker Images

Available on GitHub Container Registry:

- `ghcr.io/jordank1977/mimirr:latest` - Latest stable release
- `ghcr.io/jordank1977/mimirr:main` - Latest commit on main branch
- `ghcr.io/jordank1977/mimirr:v1.0.0` - Specific version tags

**Supported Platforms**: `linux/amd64`, `linux/arm64`

## 🔧 Development

```bash
# Clone repository
git clone https://github.com/jordank1977/mimirr.git
cd mimirr

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# Database management
npm run db:studio    # Open Drizzle Studio
npm run db:generate  # Generate migrations
```

## 📚 Documentation

- [**DEPLOYMENT.md**](DEPLOYMENT.md) - Production deployment with reverse proxy examples
- [**PRODUCTION-READY.md**](PRODUCTION-READY.md) - Production checklist and architecture details
- [**GIT_SETUP.md**](GIT_SETUP.md) - Development environment setup guide

## 🔒 Security

- Non-root container user (UID 1001)
- JWT authentication with HTTP-only cookies
- Environment-based secrets (never hardcoded)
- bcrypt password hashing (12 rounds)
- Input validation with Zod schemas
- SQL injection protection via Drizzle ORM

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

## 🙏 Acknowledgments

- [Readarr/Bookshelf](https://github.com/pennydreadful/bookshelf) - Download manager integration
- [BookLore](https://github.com/booklore-app/booklore) - Library management system
- [Overseerr](https://github.com/sct/overseerr) - Inspiration for request workflows
- [Hardcover](https://hardcover.app) - UI design inspiration
- [Bookinfo.pro](https://bookinfo.pro) - Book metadata API

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/jordank1977/mimirr/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jordank1977/mimirr/discussions)

---

**Built with ❤️ for the homelab book community**