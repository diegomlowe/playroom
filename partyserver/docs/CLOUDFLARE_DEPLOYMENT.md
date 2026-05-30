# Cloudflare Workers Deployment Guide

Deploy the Solplayroom backend (Hono API) to Cloudflare Workers.

---

## Prerequisites

- Cloudflare account (free tier available at https://dash.cloudflare.com)
- GitHub repo with code pushed ✅
- Backend configured in `partyserver/wrangler.toml`

---

## Step 1: Install Wrangler CLI

Wrangler is Cloudflare's deployment tool. Install globally:

```bash
npm install -g @cloudflare/wrangler
# or
yarn global add @cloudflare/wrangler
```

Verify installation:
```bash
wrangler --version
```

---

## Step 2: Authenticate with Cloudflare

Login to your Cloudflare account:

```bash
wrangler login
```

This opens a browser window to authorize. Follow the prompts and return to terminal.

---

## Step 3: Check wrangler.toml Configuration

View `partyserver/wrangler.toml`:

```toml
name = "playroom-api"
type = "javascript"
account_id = "your-account-id"
workers_dev = true
route = "api.example.com/*"
zone_id = "your-zone-id"
compatibility_date = "2024-12-16"

[env.production]
vars = { ENVIRONMENT = "production" }

[env.preview]
vars = { ENVIRONMENT = "preview" }
```

**Update:**
- `name` — Your service name (e.g., `playroom-api`)
- `account_id` — From Cloudflare dashboard (Settings → Account)
- `route` — (Optional) Custom domain. Leave empty for `*.workers.dev`
- `zone_id` — (Optional) If using custom domain

---

## Step 4: Set Environment Variables

Create `.env.local` in `partyserver/` directory:

```env
DATABASE_URL=postgresql://user:password@db.example.com/solplayroom
ADMIN_ADDRESSES=11111111111111111111111111111111,22222222222222222222222222222222
CHAIN=solana_mainnet
RPC_URL=https://api.mainnet-beta.solana.com
```

**Production Secrets** (set in Wrangler):

```bash
wrangler secret put DATABASE_URL
# Paste your production database URL, press Enter

wrangler secret put ADMIN_ADDRESSES
# Paste comma-separated admin wallet addresses

# Repeat for other secrets as needed
```

---

## Step 5: Deploy to Cloudflare Workers

### Development Deploy (Staging)

```bash
cd partyserver
wrangler deploy --env preview
```

Gets a URL like: `https://playroom-api-preview.your-name.workers.dev`

### Production Deploy

```bash
cd partyserver
wrangler deploy --env production
```

Gets a URL like: `https://playroom-api.your-name.workers.dev`

---

## Step 6: Verify Deployment

Test the API:

```bash
# Test health endpoint (no auth required)
curl https://playroom-api.your-name.workers.dev/health

# Test authenticated endpoint
curl -X GET https://playroom-api.your-name.workers.dev/api/games \
  -H "Authorization: Bearer test-token" \
  -H "X-Wallet-Address: 11111111111111111111111111111111"
```

Should return:
```json
{
  "success": true,
  "data": { /* games array */ },
  "timestamp": "2024-05-29T...",
  "requestId": "req_..."
}
```

---

## Step 7: Connect to Frontend

Update frontend environment variables in Vercel:

```env
VITE_PARTYSERVER_URL=https://playroom-api.your-name.workers.dev
```

Or create a `.env.production` in project root:

```
VITE_PARTYSERVER_URL=https://playroom-api.your-name.workers.dev
```

---

## Database Connection

### Supabase (PostgreSQL)

1. Get connection string from Supabase dashboard:
   - Go to **Settings → Database → Connection Pooling**
   - Copy the connection string
   - Add `?schema=public` to the end

2. Store in Wrangler secrets:
   ```bash
   wrangler secret put DATABASE_URL
   # Paste: postgresql://user:password@host/db?schema=public
   ```

3. Backend automatically connects via Prisma

### Migrations

Run migrations before first deploy:

```bash
cd partyserver
npx prisma migrate deploy
```

Or use Prisma to generate schema:

```bash
npx prisma db push
```

---

## Monitoring & Logs

### View Logs

```bash
# Stream live logs
wrangler tail --env production

# or via Cloudflare dashboard:
# Settings → Account → Workers → playroom-api → Logs
```

### Monitor Errors

1. Cloudflare dashboard → **Workers → playroom-api**
2. View **Errors** tab for 4xx/5xx responses
3. Check **Real-time analytics**

---

## CORS Configuration

CORS is auto-configured for your frontend domain.

To add additional origins, edit `partyserver/src/lib/cors-helpers.ts`:

```typescript
const allowedOrigins = [
  'https://playroom.vercel.app',      // Frontend
  'https://api.example.com',          // Custom domain
  'http://localhost:3000',            // Local dev
];
```

Then redeploy.

---

## Custom Domain (Optional)

To use `api.yourdomain.com` instead of `*.workers.dev`:

1. Add a CNAME record in your domain registrar:
   - Name: `api`
   - Value: `playroom-api.your-name.workers.dev`

2. Update `wrangler.toml`:
   ```toml
   route = "api.yourdomain.com/*"
   zone_id = "your-zone-id"  # From Cloudflare
   ```

3. Redeploy:
   ```bash
   wrangler deploy --env production
   ```

---

## Environment-Specific Deployments

### Preview (Staging)

```bash
wrangler deploy --env preview
```

Sets up `https://playroom-api-preview.your-name.workers.dev`
- Points to staging database
- Uses preview chain/RPC

### Production

```bash
wrangler deploy --env production
```

Sets up `https://playroom-api.your-name.workers.dev`
- Points to production database
- Uses mainnet chain/RPC

---

## Rollback

If deployment breaks:

1. Check Cloudflare dashboard → **Workers → playroom-api → Deployments**
2. Find last working version
3. Click **Rollback** button

Or via CLI:
```bash
wrangler deployments rollback
```

---

## Common Issues

### Error: "Cannot find module '@prisma/client'"

**Fix:** Ensure Prisma is installed:
```bash
cd partyserver
npm install @prisma/client
```

### Error: "DATABASE_URL is not set"

**Fix:** Set environment variable:
```bash
wrangler secret put DATABASE_URL
# Paste your connection string
```

### CORS Errors from Frontend

**Fix:** Add frontend URL to `cors-helpers.ts`:
```typescript
domains.push('https://playroom.vercel.app');
```

Then redeploy backend.

### 401 Errors (Unauthorized)

**Fix:** Ensure frontend sends headers:
```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'X-Wallet-Address': walletAddress,
}
```

Check `partyserver/src/lib/wallet-auth.ts` validation.

---

## Deployment Checklist

- [ ] Wrangler CLI installed and authenticated
- [ ] `wrangler.toml` configured with correct account/service name
- [ ] Environment variables set (DATABASE_URL, ADMIN_ADDRESSES, etc.)
- [ ] Database migrations applied (`prisma migrate deploy`)
- [ ] Preview deploy successful: `wrangler deploy --env preview`
- [ ] Can test health endpoint without auth
- [ ] Can test authenticated endpoint with headers
- [ ] Production deploy successful: `wrangler deploy --env production`
- [ ] Frontend `VITE_PARTYSERVER_URL` points to production URL
- [ ] CORS allows frontend domain

---

## Monitoring After Deployment

### Daily Checks

- [ ] Error logs in Cloudflare dashboard (< 0.1% error rate)
- [ ] Database connection healthy (no timeouts)
- [ ] API response times normal (< 1s median)
- [ ] Frontend can create/join games successfully

### Weekly Tasks

- [ ] Review slow queries in database logs
- [ ] Check worker CPU time usage
- [ ] Verify backups running on database

---

## Support

For issues:
- Cloudflare docs: https://developers.cloudflare.com/workers/
- Wrangler docs: https://developers.cloudflare.com/workers/wrangler/
- Prisma docs: https://www.prisma.io/docs/
- Check backend logs: `wrangler tail --env production`
- Check frontend console: Browser DevTools
