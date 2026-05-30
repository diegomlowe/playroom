# Frontend Deployment Guide

Deploy the Solplayroom frontend to Vercel.

---

## Prerequisites

- GitHub account with the repo pushed (✅ already done)
- Vercel account (free tier available at https://vercel.com)
- Backend API URL (from Cloudflare Workers or other hosting)

---

## Step 1: Create Vercel Project

1. Go to https://vercel.com/new
2. Click **"Add GitHub Org or Personal Account"** and authorize
3. Select **`diegomlowe/playroom`** from the repo list
4. Click **"Import"**

---

## Step 2: Configure Build Settings

On the import page, configure:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Root Directory** | `.` (leave as default) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### Node.js Version

- Vercel uses Node 20 by default ✅
- This project requires Node 18+ (compatible)

---

## Step 3: Environment Variables

Add these environment variables in the Vercel dashboard:

### Production Environment

```env
VITE_PARTYSERVER_URL=https://your-backend-api.workers.dev
VITE_TAROBASE_APP_ID=69f0360a525daf9178c8a6a7
VITE_CHAIN=solana_mainnet
VITE_RPC_URL=https://api.mainnet-beta.solana.com
VITE_ENV=LIVE
```

### Preview/Staging Environment

```env
VITE_PARTYSERVER_URL=https://your-backend-preview.workers.dev
VITE_TAROBASE_APP_ID=69f0360a525daf9178c8a6a7
VITE_CHAIN=solana_mainnet_preview
VITE_RPC_URL=https://api.mainnet-beta.solana.com
VITE_ENV=PREVIEW
```

**Where to find these:**
- `VITE_PARTYSERVER_URL` — Your backend API endpoint (see `PARTYSERVER_URL` in `src/lib/config.ts`)
- `VITE_TAROBASE_APP_ID` — From `src/main.tsx` or `.env.local`
- `VITE_CHAIN` — Network: `offchain` (test), `solana_mainnet_preview`, `solana_mainnet`
- `VITE_RPC_URL` — Solana RPC: https://api.mainnet-beta.solana.com

---

## Step 4: Add vercel.json (Optional)

Create `vercel.json` in project root for finer control:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "nodeVersion": "20.x"
}
```

---

## Step 5: Deploy

1. Click **"Deploy"** button on Vercel
2. Wait for build to complete (3-5 minutes typically)
3. Once deployed, get the preview URL (e.g., `https://playroom.vercel.app`)

---

## Step 6: Verify Deployment

After deployment completes:

1. **Open the preview URL** in your browser
2. **Test wallet connection:**
   - Click "Connect Wallet" button
   - Approve in Phantom wallet
   - Should see wallet address + balance
3. **Test API connectivity:**
   - Create a game
   - Should see successful response (no 401/500 errors)

---

## Common Issues

### Build Fails: "Cannot find module '@solana/wallet-adapter-react'"

**Fix:** Ensure all Solana wallet packages are installed:
```bash
npm install @solana/wallet-adapter-react @solana/wallet-adapter-phantom @solana/wallet-standard
```

Then redeploy.

### Frontend Loads But API Calls Fail (401/404)

**Fix:** Check environment variables:
- Verify `VITE_PARTYSERVER_URL` is correct
- Backend must be deployed and accessible
- Backend must accept requests from your Vercel domain (CORS)

**CORS Setup (Backend):**
Add your Vercel URL to `partyserver/src/lib/cors-helpers.ts`:
```typescript
domains.push('https://playroom.vercel.app');
domains.push('*.vercel.app'); // Allow all Vercel preview deploys
```

Then redeploy backend.

### "Buffer is not defined" Error

**Fix:** Already included in `src/main.tsx`:
```typescript
window.Buffer = Buffer;
```

If still failing, verify the import is present:
```typescript
import { Buffer } from 'buffer';
```

### Phantom Wallet Not Connecting

**Fix:** Ensure:
1. You're on the correct network (Mainnet vs Devnet)
2. Phantom is installed in your browser
3. Check browser console for specific error

---

## Deployment Checklist

- [ ] GitHub repo is public and up-to-date
- [ ] All environment variables set in Vercel dashboard
- [ ] Backend API URL is correct and deployed
- [ ] Backend accepts requests from Vercel domain (CORS configured)
- [ ] Build completes without errors
- [ ] Wallet connection works in browser
- [ ] Can create a game without API errors
- [ ] All game flows work (create → join → play → resolve)

---

## Custom Domain (Optional)

To use a custom domain instead of `vercel.app`:

1. In Vercel dashboard, go to **Settings → Domains**
2. Enter your domain (e.g., `playroom.io`)
3. Add DNS records provided by Vercel to your domain registrar
4. Wait for DNS propagation (5-30 minutes)

---

## Monitoring & Logs

After deployment:

1. **View Logs:** Vercel dashboard → **Deployments** → Select deployment → **Logs**
2. **Monitor Errors:** Vercel dashboard → **Monitoring** → See error rates
3. **Frontend Logs:** Open browser DevTools → Console tab (when you visit the site)

---

## Rollback

If deployment breaks:

1. Go to Vercel dashboard → **Deployments**
2. Find the last working deployment
3. Click the three dots → **Promote to Production**

This instantly reverts to the previous version.

---

## CI/CD: Auto-Deploy on Push

Vercel automatically deploys when you push to `main` branch.

To disable auto-deploy or set up branch rules:
1. Dashboard → **Settings → Git**
2. Configure which branches trigger deploys
3. (Default: all branches deploy as previews, main deploys to production)

---

## Next Steps

After frontend is deployed:
1. Deploy backend to Cloudflare Workers (see `partyserver/docs/DEPLOYMENT.md`)
2. Update `VITE_PARTYSERVER_URL` to production backend
3. Run end-to-end tests across all game flows
4. Monitor logs for errors

---

## Support

If deployment issues arise, check:
- `docs/DEPLOYMENT.md` (general deployment guide)
- `README.md` (project overview)
- Vercel docs: https://vercel.com/docs
- Browser console for frontend errors
- Vercel logs for build errors
