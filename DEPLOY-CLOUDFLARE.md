# Deploy to Cloudflare Workers

This guide explains how to deploy Node Monitor to Cloudflare Workers with D1 (SQLite-compatible) as the database.

## Prerequisites

- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Node.js 18+ installed

## Deployment Steps

### 1. Create D1 Database

```bash
# Create a new D1 database
wrangler d1 create node-monitor
```

This will output a `database_id`. Copy this ID.

### 2. Update Configuration

Open `wrangler.toml` and replace the placeholder with your actual D1 database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "node-monitor"
database_id = "<REPLACE_WITH_YOUR_D1_DATABASE_ID>"  # Paste your ID here
```

### 3. Run Migrations

Apply the schema to your D1 database:

```bash
# Apply migrations to remote database
npm run cf:migrate

# Or apply to local database (for testing)
npm run cf:migrate:local
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Deploy

```bash
npm run cf:deploy
```

Your worker will be available at: `https://node-monitor.<your-subdomain>.workers.dev`

## Development

For local development with D1:

```bash
# Start local dev server
npm run cf:dev
```

This uses a local D1 database and enables hot reload.

## Default Credentials

- **Password:** `123456`
- **Force Change:** You'll be prompted to change password on first login
- **Agent Token:** Auto-generated and displayed on the dashboard

## How It Works

### Maintenance Jobs

The worker runs maintenance tasks automatically every 5 minutes via a Cron Trigger:

- **Rollup History:** Aggregates raw history into hourly buckets
- **Prune Raw History:** Removes raw data older than 48 hours
- **Prune Rollup History:** Removes hourly rollups older than 90 days
- **Sweep Offline:** Marks servers as offline if no report received within 30 seconds

### Session Management

Sessions are stored in D1 (instead of in-memory) so they persist across worker invocations:

- **Duration:** 24 hours
- **Storage:** D1 `sessions` table
- **Security:** HttpOnly, Secure, SameSite=Lax cookies

### Authentication

- **Agent Reports:** Token-based authentication (timing-safe comparison)
- **Dashboard:** Session-based authentication with password hashing

## Differences from Express Version

### Storage

| Feature | Express + SQLite | Cloudflare Worker + D1 |
|---------|------------------|------------------------|
| Database | Local `data/monitor.db` | Cloudflare D1 (SQLite) |
| Sessions | In-memory Map | D1 `sessions` table |
| File System | Full access | Read-only (Worker runtime) |

### Rate Limiting

- **Express:** Per-connection, shared across all requests
- **Worker:** Per-isolate, best-effort (each worker invocation is stateless)

For strict rate limiting across all worker instances, use Cloudflare Rate Limiting rules.

### Password Hashing

- **Express:** scrypt (`saltB64:hashB64`)
- **Worker:** PBKDF2 (`pbkdf2$iterations$saltB64$hashB64`)

The formats are incompatible but the worker handles both.

### Scheduled Jobs

- **Express:** `setInterval` in Node.js process
- **Worker:** Cloudflare Cron Triggers (every 5 minutes)

## Troubleshooting

### D1 Errors

If you see database errors, ensure migrations have been run:

```bash
npm run cf:migrate
```

### Worker Not Starting

Check Wrangler logs:

```bash
wrangler tail
```

### Session Issues

Sessions are stored in D1 and persist across invocations. If you're having login issues:

1. Clear your browser cookies
2. Try again

## Monitoring

Enable observability in `wrangler.toml`:

```toml
[observability]
enabled = true
```

This enables Workers Logs for debugging.

## Security Notes

1. **Default Password:** Change immediately after first login
2. **Agent Token:** Auto-generated, displayed on dashboard
3. **Secrets:** Don't commit sensitive data to Git
4. **Environment Variables:** Use Cloudflare Secrets for production

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
