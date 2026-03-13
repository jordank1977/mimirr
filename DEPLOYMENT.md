# Mimirr Production Deployment Guide

This guide covers deploying Mimirr to production using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+ (optional, but recommended)
- 1GB+ RAM
- 10GB+ disk space for database and logs

## Quick Start (Docker Compose)

### 1. Prepare Environment

```bash
# Clone the repository
git clone <repository-url>
cd mimirr

# Copy environment template
cp .env.example .env

# Edit .env with your production values
nano .env
```

### 2. Optional Configuration

**All configuration is optional!** Mimirr uses sensible defaults.

If you want sessions to persist across container restarts, optionally set:
```env
JWT_SECRET=your-secret-key  # Generate with: openssl rand -base64 32
```

### 3. Deploy

```bash
# Start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Check health
curl http://localhost:8788/api/health
```

The application will be available at `http://localhost:8788`

### 4. First-Time Setup

1. Navigate to `http://localhost:8788`
2. Complete the setup wizard to create your administrator account
3. Configure Bookshelf integration in Settings → Bookshelf

## Manual Docker Deployment

### Build Image

```bash
docker build -t mimirr:latest .
```

### Run Container

```bash
docker run -d \
  --name mimirr \
  -p 8788:8788 \
  -v mimirr-data:/app/config \
  --restart unless-stopped \
  mimirr:latest
```

**Note:** No environment variables required! Use the setup wizard on first access.

### Create Volume (if not auto-created)

```bash
docker volume create mimirr-data
```

## Reverse Proxy Setup

### Nginx

```nginx
server {
    listen 80;
    server_name mimirr.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mimirr.yourdomain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:8788;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Traefik (docker-compose.yml)

```yaml
version: '3.8'

services:
  mimirr:
    build: .
    container_name: mimirr
    volumes:
      - mimirr-data:/app/config
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - DEFAULT_ADMIN_USERNAME=${DEFAULT_ADMIN_USERNAME}
      - DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mimirr.rule=Host(`mimirr.yourdomain.com`)"
      - "traefik.http.routers.mimirr.entrypoints=websecure"
      - "traefik.http.routers.mimirr.tls.certresolver=letsencrypt"
      - "traefik.http.services.mimirr.loadbalancer.server.port=8788"
    networks:
      - traefik
    restart: unless-stopped

volumes:
  mimirr-data:

networks:
  traefik:
    external: true
```

### Caddy (Caddyfile)

```
mimirr.yourdomain.com {
    reverse_proxy localhost:8788
}
```

## Database Backup

### Backup SQLite Database

```bash
# Stop the container
docker-compose down

# Backup the volume
docker run --rm -v mimirr-data:/data -v $(pwd):/backup alpine tar czf /backup/mimirr-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restart the container
docker-compose up -d
```

### Automated Backup Script

```bash
#!/bin/bash
# backup-mimirr.sh

BACKUP_DIR="/backups/mimirr"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="mimirr-backup-$DATE.tar.gz"

mkdir -p $BACKUP_DIR

docker run --rm \
  -v mimirr-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/$BACKUP_FILE -C /data .

# Keep only last 7 backups
find $BACKUP_DIR -name "mimirr-backup-*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

Add to crontab for daily backups:
```bash
0 2 * * * /path/to/backup-mimirr.sh
```

### Restore from Backup

```bash
# Stop the container
docker-compose down

# Restore the backup
docker run --rm \
  -v mimirr-data:/data \
  -v $(pwd):/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/mimirr-backup-YYYYMMDD.tar.gz -C /data"

# Restart the container
docker-compose up -d
```

## Updates

### Update to Latest Version

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Verify health
docker-compose logs -f
curl http://localhost:8788/api/health
```

### Rollback

```bash
# View previous images
docker images | grep mimirr

# Tag current as rollback
docker tag mimirr:latest mimirr:rollback

# Stop and use previous version
docker-compose down
docker tag mimirr:previous mimirr:latest
docker-compose up -d
```

## Monitoring

### View Logs

```bash
# All logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs -f mimirr
```

### Health Check

```bash
# HTTP health check
curl http://localhost:8788/api/health

# Container health
docker inspect --format='{{.State.Health.Status}}' mimirr
```

### Resource Usage

```bash
# Container stats
docker stats mimirr

# Disk usage
docker system df
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs

# Common issues:
# 1. Port 8788 already in use
sudo lsof -i :8788
# Kill the process or change port in docker-compose.yml

# 2. Permission issues with volume
docker-compose down
docker volume rm mimirr-data
docker-compose up -d
```

### Database Corruption

```bash
# Stop container
docker-compose down

# Access volume
docker run --rm -it -v mimirr-data:/data alpine sh

# Check database integrity
cd /data
apk add sqlite
sqlite3 db.sqlite "PRAGMA integrity_check;"

# Exit and restart
exit
docker-compose up -d
```

### Performance Issues

```bash
# Increase container resources
docker update --memory=2g --cpus=2 mimirr

# Or in docker-compose.yml:
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
```

## Security Best Practices

1. **Strong JWT Secret**: Use 32+ character random string
2. **Change Default Credentials**: Immediately after first login
3. **Use HTTPS**: Always use reverse proxy with SSL/TLS
4. **Regular Updates**: Keep Docker and application updated
5. **Firewall**: Only expose port 8788 to reverse proxy
6. **Backups**: Automate daily database backups
7. **Environment Files**: Never commit `.env` to git
8. **User Permissions**: Run as non-root (already configured)
9. **Volume Permissions**: Ensure proper ownership
10. **Security Headers**: Configure in reverse proxy

## Production Checklist

- [ ] Changed JWT_SECRET to strong random value
- [ ] Updated DEFAULT_ADMIN_PASSWORD
- [ ] Configured reverse proxy with HTTPS
- [ ] Set up automated backups
- [ ] Configured Bookshelf integration
- [ ] Tested health endpoint
- [ ] Verified database persistence
- [ ] Set up monitoring/logs
- [ ] Documented admin credentials securely
- [ ] Configured firewall rules
- [ ] Set up automatic updates (optional)
- [ ] Created disaster recovery plan

## Support

For issues and questions:
- Check logs: `docker-compose logs -f`
- Health endpoint: `http://localhost:8788/api/health`
- Database location: Docker volume `mimirr-data`
- Configuration: `.env` file and docker-compose.yml
