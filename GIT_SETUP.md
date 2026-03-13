# Git Setup for Joint Attribution

This guide ensures commits are properly attributed to both authors.

## Configure Git

```bash
# Set your identity
git config user.name "jordank1977"
git config user.email "jordank1977@proton.me"
```

## Commit with Joint Attribution

For each commit, add the co-author trailer:

```bash
# Stage changes
git add .

# Commit with joint attribution
git commit -m "Your commit message

Co-authored-by: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## Or Create a Commit Template

```bash
# Create commit template
cat > ~/.gitmessage << 'EOF'


Co-authored-by: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF

# Configure git to use template
git config commit.template ~/.gitmessage
```

Now when you commit, the template will be pre-filled:

```bash
git commit
# Editor opens with co-author already added
```

## Example Commit Message

```
Initial commit: Production-ready book management system

- Next.js 15 with TypeScript
- SQLite database with Drizzle ORM
- Docker deployment configured
- GitHub Actions for GHCR publishing
- Mobile-responsive UI

Co-authored-by: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Verify Attribution

After committing, verify:

```bash
git log --pretty=full
```

You should see both authors listed.
