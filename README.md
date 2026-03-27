# 📚 Mimirr

**A clean, user-friendly book request application for [Bookshelf](https://github.com/pennydreadful/Bookshelf).**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.30-purple?style=flat-square)](https://orm.drizzle.team/)

## 🎯 What is Mimirr?

Mimirr is a self-hosted web application that gives your friends and family a beautiful, easy-to-use interface to discover books, check if they are already in your library, and request new ones. 

Mimirr provides a modern, book-focused experience that connects directly to your local Bookshelf instance, acting as the perfect "front door" to your digital library.

---

## ✨ Features

### 1. Direct Bookshelf Integration
Mimirr doesn't rely on fragile third-party websites to look up book covers or descriptions. All search queries and book data are pulled directly from your local Bookshelf API, meaning your search results are always accurate and perfectly matched to your setup.

### 2. Smart Sync & Status Tracking
Mimirr doesn't just handle new requests; it knows exactly what you already own. It automatically scans your existing Bookshelf library in the background to prevent duplicate requests. When searching, users will see clear, color-coded badges indicating if a book is **Available** (already in your library), **Processing** (currently downloading), **Requested** (waiting for approval), or **Unreleased**. 

---

## 🚀 Quick Start (Docker)

Mimirr is designed to be easily deployed via Docker Compose. Ensure you have your Bookshelf API key and URL ready.

```yaml
version: '3.8'

services:
  mimirr:
    image: ghcr.io/jordank1977/mimirr:latest
    container_name: mimirr
    ports:
      - "8788:8788"
    volumes:
      - mimirr-data:/app/config
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/config/db.sqlite
    restart: unless-stopped

volumes:
  mimirr-data:
    driver: local
```

Start the container:
```bash
docker-compose up -d
```
Access the initial setup wizard at `http://localhost:8788`.

---

## 📚 Documentation Hub

For deep-dive configurations, production rollouts, or local development, consult the detailed guides in our `/docs` folder:

* [**Deployment Guide (`docs/DEPLOYMENT.md`)**](docs/DEPLOYMENT.md): Detailed reverse-proxy setups, volume persistence, and environment configurations.
* [**Production Checklist (`docs/PRODUCTION-READY.md`)**](docs/PRODUCTION-READY.md): Security best practices and logging configurations.
* [**Development Setup (`docs/GIT_SETUP.md`)**](docs/GIT_SETUP.md): Instructions for cloning, migrating the database, and running the dev server.

---

## 🔧 Technology Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Database**: SQLite with Drizzle ORM
- **Styling**: Tailwind CSS & Shadcn/UI
- **Containerization**: Multi-arch Docker (`linux/amd64`, `linux/arm64`)

---

## 🤝 Contributing

Contributions are welcome! Please ensure you review the Development Setup guide in the `/docs` folder before opening Pull Requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
