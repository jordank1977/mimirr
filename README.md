# 📚 Mimirr

A self-hosted book discovery and request management system. Mimirr helps you discover books and manage download requests through [Bookshelf](https://github.com/pennydreadful/bookshelf).

> **Perfect for:** Book enthusiasts running personal media servers who want an intuitive interface for discovering and requesting books.

## ✨ Features

- 📖 **Book Discovery** - Search and browse thousands of books via Bookinfo.pro
- 🎯 **Smart Requests** - Request books with quality profile preferences
- 👥 **Multi-User** - Role-based access (Admin/User) with approval workflow
- 🔔 **Notifications** - Discord webhooks for request updates
- 🎨 **Modern UI** - Dark theme inspired by Hardcover, fully responsive
- 🔗 **Bookshelf Integration** - Seamless connection to your download manager

## 🚀 Quick Start

### Docker (Recommended)

```bash
# Pull from GitHub Container Registry
docker run -d \
  --name mimirr \
  -p 8788:8788 \
  -v mimirr-data:/app/config \
  ghcr.io/jordank1977/mimirr:latest

# Or use docker-compose
curl -o docker-compose.yml https://raw.githubusercontent.com/jordank1977/mimirr/main/docker-compose.yml
docker-compose up -d
```

**First-time setup:**
1. Access **http://localhost:8788**
2. You'll be greeted by the setup wizard
3. Create your administrator account
4. Start discovering books!

### From Source

```bash
git clone https://github.com/jordank1977/mimirr.git
cd mimirr
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

## ⚙️ Configuration

> **Zero Configuration Required!** Mimirr works out of the box. On first launch, you'll use the setup wizard to create your admin account.

### Bookshelf Setup

1. Navigate to **Settings → Bookshelf**
2. Enter your Bookshelf URL (e.g., `http://localhost:8787`)
3. Enter your Bookshelf API key
4. Click **Test Connection**
5. Save settings

## 📖 Usage

### For Users

1. **Discover** - Browse personalized recommendations or search for books
2. **Request** - Click a book and select your preferred quality profile
3. **Track** - Monitor request status in "My Requests"
4. **Enjoy** - Books automatically download via Bookshelf

### For Admins

1. **Approve** - Review and approve/decline user requests
2. **Manage** - Configure Bookshelf integration and quality profiles
3. **Users** - Add/remove users and assign roles
4. **Notifications** - Set up Discord webhooks for alerts

## 🏗️ Technology Stack

- **Framework:** Next.js 15 + TypeScript
- **Database:** SQLite with Drizzle ORM
- **Styling:** Tailwind CSS
- **Auth:** JWT with HTTP-only cookies
- **APIs:** Bookinfo.pro for metadata

## 📦 Docker Images

Images are automatically built and published to GitHub Container Registry:

- `ghcr.io/jordank1977/mimirr:latest` - Latest stable release
- `ghcr.io/jordank1977/mimirr:main` - Latest commit on main branch
- `ghcr.io/jordank1977/mimirr:v1.0.0` - Specific version tags

**Supported Platforms:** `linux/amd64`, `linux/arm64`

## 🔧 Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Run migrations
npm run db:migrate

# Start dev server
npm run dev

# Database management
npm run db:studio    # Open Drizzle Studio
npm run db:generate  # Generate migrations
```

## 🐳 Docker Development (Recommended)

For a consistent development environment, use Docker:

```bash
# Build and start the development container
docker-compose -f docker-compose.dev.yml up

# Stop the container
docker-compose -f docker-compose.dev.yml down

# Rebuild after dependency changes
docker-compose -f docker-compose.dev.yml up --build
```

See [DOCKER-DEV.md](DOCKER-DEV.md) for full development workflow and troubleshooting.

## 📝 Documentation

- [**DEPLOYMENT.md**](DEPLOYMENT.md) - Production deployment guide with reverse proxy examples
- [**PRODUCTION-READY.md**](PRODUCTION-READY.md) - Production checklist and architecture
- [**.env.example**](.env.example) - Environment variables reference

## 🔒 Security

- Non-root container user (UID 1001)
- JWT authentication with HTTP-only cookies
- Environment-based secrets (not hardcoded)
- bcrypt password hashing (12 rounds)
- Input validation with Zod schemas

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

[MIT License](LICENSE)

## 🙏 Acknowledgments

- [Bookshelf](https://github.com/pennydreadful/bookshelf) - Download manager
- [Overseerr](https://github.com/sct/overseerr) - Inspiration
- [Hardcover](https://hardcover.app) - UI design inspiration
- [Bookinfo.pro](https://bookinfo.pro) - Book metadata API

## 💬 Support

- **Issues:** [GitHub Issues](https://github.com/jordank1977/mimirr/issues)
- **Discussions:** [GitHub Discussions](https://github.com/jordank1977/mimirr/discussions)

---

**Built with ❤️ for book lovers**
