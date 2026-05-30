# Deployment Documentation

## Table of Contents

1. [Overview](#overview)
2. [Environment Explanation](#environment-explanation)
3. [Prerequisites](#prerequisites)
4. [Deployment Runbook](#deployment-runbook)
5. [Environment Variables](#environment-variables)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring & Verification](#monitoring--verification)

---

## Overview

**SolPlayroom** is deployed as a **split-stack application** across multiple platforms:

- **Frontend:** Vite SPA deployed to Poof Cloud CDN (static hosting)
- **Backend:** Hono API running on Cloudflare Workers (serverless)
- **Database:** Tarobase (Poof's on-chain state layer on Solana)
- **Scheduled Tasks:** Cloudflare Heartbeat (cron-like tasks)

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Vite)                      │
│        Static SPA deployed to Poof Cloud CDN             │
│     (Preview: *-preview.poof.new | Live: *.poof.new)   │
└────────────────────────────────────────────────────────┬─┘
                                                            │
                          HTTPS                            │
                                                            │
┌───────────────────────────────────────────────────────┬──┘
│         Backend (Hono on Cloudflare Workers)          │
│                                                        │
│  • API Routes (/api/games/*, /api/coinflip/*, etc)  │
│  • Heartbeat Tasks (distribute-fee-pool, etc)        │
│  • Queue Dispatcher                                   │
└────────────────┬─────────────────────────────────────┘
                 │
                 │ Fetch + Auth
                 ▼
         ┌──────────────────┐
         │    Tarobase      │
         │ (On-chain State) │
         │   (Solana)       │
         └──────────────────┘
```

---

## Environment Explanation

### PREVIEW (Staging)

**Purpose:** Testing and validation before production release.

**Characteristics:**
- Slower release cycle (manual deploys)
- Dev/test wallets acceptable
- Can reset data if needed
- Full feature testing

**URLs:**
- Frontend: `69f0360a525daf9178c8a6a7-preview.poof.new`
- Backend: `69f0360a525daf9178c8a6a7-api.poof.new`

**Databases:**
- **Tarobase App ID:** `69f0360a525daf9178c8a6a7`
- **Chain:** `offchain` (staging Solana cluster)

**Configuration:**
- `wrangler.toml`: `ENV = "PREVIEW"`
- `vite.config.ts`: Injects `VITE_ENV="PREVIEW"`
- Build profile: Unminified, sourcemaps disabled

---

### LIVE (Production)

**Purpose:** Production environment serving real users and real transactions.

**Characteristics:**
- Faster, automated release cycle (CI/CD)
- Real SOL and MNY transactions
- Permanent data (no resets)
- High availability requirements

**URLs:**
- Frontend: `solplayroom.poof.new` (custom domain) or `69f0360a525daf9178c8a6a7.poof.new`
- Backend: Same as frontend API subdomain

**Databases:**
- **Tarobase App ID:** `69f0360a525daf9178c8a6a7` (same, but mainnet cluster)
- **Chain:** `mainnet` (production Solana cluster)

**Configuration:**
- `vite.config.prod.ts`: Minified, optimized, no sourcemaps
- `VITE_ENV="LIVE"`
- Build profile: `production` (aggressive minification, tree-shaking)

---

## Prerequisites

### Local Development Requirements

- **Bun** v1.1.42+ ([install](https://bun.sh))
- **Node.js** 18+ (for compatibility)
- **Git** for version control
- **Solana CLI** (optional, for blockchain interaction)

### Deployment Requirements

- **Poof Cloud Account** with CLI access
- **Cloudflare Account** (for Workers deployment)
- **GitHub** access to repository (for CI/CD)
- **Environment secrets** configured in Poof Cloud dashboard

---

## Deployment Runbook

### Step 1: Prepare Changes

```bash
# Clone/pull latest code
git clone <repo> solplayroom
cd solplayroom

# Install dependencies
bun install

# Run type check and linting
bun run check

# Test locally (optional)
bun run dev --port 3000
```

### Step 2: Build for Target Environment

#### PREVIEW (Staging Deployment)

```bash
# Build frontend + backend for preview
bun run build:full

# Output:
# - Frontend: dist/
# - Backend: partyserver/dist/
```

#### LIVE (Production Deployment)

```bash
# Build with production optimizations
bun run build:full:prod

# This triggers:
# - VITE_ENV=LIVE
# - BUILD_PROFILE=production
# - Full minification and tree-shaking
```

### Step 3: Deploy Frontend

#### Via Poof Cloud Dashboard

1. **Navigate:** Cloud → Deployments
2. **Select Environment:** Preview or Live
3. **Upload:** Select `dist/` directory
4. **Trigger Deploy:** Click "Deploy"
5. **Verify:** Check preview URL loads without errors

#### Via CLI (if available)

```bash
poof deploy --env preview dist/
# or
poof deploy --env live dist/
```

### Step 4: Deploy Backend

#### Via Cloudflare Wrangler

```bash
cd partyserver

# Preview deployment
wrangler deploy --env preview

# Production deployment (with secrets)
wrangler deploy --env live
```

**Required Secrets** (set in `wrangler.toml` or Cloudflare dashboard):

- `PROJECT_VAULT_PRIVATE_KEY` — Private key for vault signer
- `TAROBASE_SOLANA_KEYPAIR` — Solana keypair for on-chain operations

#### Via Poof Cloud Dashboard

1. **Navigate:** Cloud → API Settings
2. **Select Environment:** Preview or Live
3. **Deploy:** Upload `partyserver/dist/` or trigger from git
4. **Verify:** Health check `/health` returns 200

### Step 5: Verify Deployment

#### Frontend Health Check

```bash
# Check frontend loads
curl -I https://69f0360a525daf9178c8a6a7-preview.poof.new/

# Expected: 200 OK, Content-Type: text/html
```

#### Backend Health Check

```bash
# Check API is responding
curl https://69f0360a525daf9178c8a6a7-api.poof.new/health

# Expected response:
# {"success":true,"data":{"status":"ok","timestamp":1234567890},...}
```

#### Database Connectivity

1. **In Frontend:** Open browser console, check for errors
2. **In Backend:** Check request logs for database failures
3. **Verify collections:** Check Tarobase dashboard for recent writes

#### Game Flow Test

1. **Connect wallet:** Click "Connect Wallet" → approve in wallet extension
2. **Create match:** Create a TapWars or CoinFlip match
3. **Submit transaction:** Pay buy-in (test SOL for preview)
4. **Check state:** Verify game appears in "My Matches"
5. **Finalize:** Submit game and verify winner resolution

### Step 6: Monitor Logs

#### Frontend Errors

- Poof Cloud dashboard → Logs tab
- Browser DevTools → Console tab for client-side errors
- Look for: CORS errors, API failures, wallet auth issues

#### Backend Errors

```bash
# View Cloudflare Worker logs
wrangler tail --env preview

# Or via Cloudflare dashboard:
# Workers → solplayroom → Logs
```

**Common issues:**
- `Auth failed: 401` — JWT verification issue
- `Tarobase timeout` — Database latency spike
- `CORS error` — Origin not in allowed list
- `Out of memory` — Heartbeat task too heavy

#### Heartbeat Task Execution

- Poof Cloud → Heartbeat → Task History
- Check last run timestamp and status
- Failed tasks show error logs and retry counts

---

## Environment Variables

### Frontend (.env)

| Variable | Preview | Live | Description |
|----------|---------|------|-------------|
| `VITE_ENV` | `PREVIEW` | `LIVE` | Environment flag injected at build time |
| `VITE_TAROBASE_APP_ID` | `69f0360a525daf9178c8a6a7` | `69f0360a525daf9178c8a6a7` | Poof Tarobase app ID |
| `VITE_CHAIN` | `offchain` | `mainnet` | Solana cluster for transactions |
| `VITE_RPC_URL` | Devnet | Mainnet Helius | Solana RPC endpoint |
| `VITE_PARTYSERVER_URL` | Auto (localhost:1999) | Auto (from TAROBASE_APP_ID) | Backend API base URL |

### Backend (wrangler.toml vars)

| Variable | Value | Description |
|----------|-------|-------------|
| `TAROBASE_APP_ID` | `69f0360a525daf9178c8a6a7` | Database app ID |
| `ENV` | `PREVIEW` or `LIVE` | Deployment environment |
| `JWT_ISSUER` | Cognito URL | Token issuer for auth verification |
| `NODE_ENV` | `development` or `production` | Node runtime mode |
| `TAROBASE_CHAIN` | `offchain` or `mainnet` | Blockchain network |

### Backend Secrets (Cloudflare)

| Secret | Description | Where to Get |
|--------|-------------|--------------|
| `PROJECT_VAULT_PRIVATE_KEY` | Base58 private key for vault signer | Poof Cloud → Vault Keys |
| `TAROBASE_SOLANA_KEYPAIR` | Solana keypair (same as vault) | Same |

---

## Rollback Procedures

### Rollback Frontend

**If a bad frontend deploy breaks the app:**

```bash
# 1. Identify last known good deploy
poof deployments list --limit 10

# 2. Find deployment ID from output
# 3. Activate previous version
poof deployments activate <previous-id>

# 4. Verify at URL
curl -I https://69f0360a525daf9178c8a6a7-preview.poof.new/
```

**Alternative: Manual Re-deploy**

```bash
# Re-build from last working git commit
git checkout <last-good-commit>
bun install
bun run build:full
# Re-deploy dist/
```

### Rollback Backend

**If a bad API deploy causes errors:**

```bash
# 1. Identify last known good deploy
wrangler deployments list --env preview

# 2. Rollback to previous version
wrangler rollback --env preview

# 3. Verify health
curl https://69f0360a525daf9178c8a6a7-api.poof.new/health
```

### Rollback Database

**Tarobase does NOT support automatic rollback.** If data is corrupted:

1. **For PREVIEW:** Contact Poof Cloud support for snapshot restore
2. **For LIVE:** Data loss is permanent — implement backups before deploy

**Prevention:** Always test on Preview before deploying to Live.

---

## Monitoring & Verification

### Pre-Deployment Checklist

- [ ] All tests pass locally (`bun run check`)
- [ ] Git branch up-to-date with main
- [ ] No unresolved TODOs or FIXMEs in code
- [ ] CHANGELOG.md updated with new features
- [ ] Secret values configured in target environment
- [ ] Preview deploy tested first if applicable

### Post-Deployment Checklist

- [ ] Frontend loads without 404 errors
- [ ] Backend `/health` endpoint responds 200
- [ ] Wallet connection works (test with small tx)
- [ ] Game creation/join flow works end-to-end
- [ ] Heartbeat tasks executed in last run
- [ ] No error spikes in logs
- [ ] Database writes appear in collections
- [ ] Mobile responsive (test on phone)

### Key Metrics to Monitor

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| API Response Time | <500ms | 500-2000ms | >2000ms |
| Error Rate | <0.1% | 0.1-1% | >1% |
| Heartbeat Success | 100% | 80-100% | <80% |
| Database Latency | <100ms | 100-500ms | >500ms |

### Escalation Path

1. **Check logs** — Frontend console + backend tail
2. **Check status page** — Poof Cloud system status
3. **Check Solana network** — Verify not network-wide issue
4. **Rollback if critical** — Use procedures above
5. **Contact support** — Poof Cloud + Cloudflare support

---

## Quick Command Reference

```bash
# Local development
bun install                    # Install deps
bun run dev --port 3000       # Start frontend
bun run check                 # Type check + lint

# Build
bun run build:full            # Build preview
bun run build:full:prod       # Build live

# Deploy
wrangler deploy --env preview # Deploy backend preview
wrangler deploy --env live    # Deploy backend live

# Logs
wrangler tail --env preview   # Stream backend logs
bun run lint                  # Check code style

# Debugging
curl /health                  # Quick health check
echo $VITE_ENV               # Check env var
```

---

## Additional Resources

- **Poof Cloud Docs:** https://docs.poof.new
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
- **Solana RPC:** https://docs.solana.com/api
- **Project Vault:** See CLAUDE.md for Poof vault integration
