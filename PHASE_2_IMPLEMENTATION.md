# Phase 2: API Rewrite & Frontend Auth Migration

**Status:** Ready to implement (Database schema complete ✅)  
**Duration:** 1-2 weeks  
**Dependencies:** Phase 1 complete (Supabase tables created)  
**Effort:** 60-80 hours (mostly mechanical find/replace + testing)

---

## Overview

Phase 2 removes the last Poof dependencies and replaces them with standard tech:

| Component | Old (Poof) | New (Supabase) |
|-----------|-----------|----------------|
| **Database** | Tarobase SDK | Prisma + PostgreSQL |
| **Auth** | @pooflabs/web JWT | Phantom wallet signature |
| **Backend** | Tarobase client | Prisma client |

**Two independent tracks (can run in parallel):**
- **Phase 2A:** API routes rewrite (backend)
- **Phase 2B:** Frontend auth migration (frontend)

---

## Phase 2A: API Routes Rewrite

### 2A.1 Prepare Database Client

**File:** `partyserver/src/db.ts` (NEW)

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Optional: Disconnect on worker shutdown
export async function disconnectDb() {
  await prisma.$disconnect();
}
```

**Why:** Single source of truth for database access across all routes.

---

### 2A.2 Update Route Structure

**Current structure:**
```
partyserver/src/routes/
├── index.ts           # Route registration + routeSpec[]
├── games.ts           # Uses getMany('games'), set('games/id', data)
├── coinFlipMatches.ts # Uses Tarobase SDK
├── rpsMatches.ts
├── etc.
└── lib/
    └── db-client.ts   # OLD: Tarobase SDK
```

**New structure:**
```
partyserver/src/routes/
├── index.ts           # Route registration + routeSpec[] (unchanged)
├── games.ts           # Uses prisma.game.findMany(), .create(), etc.
├── coinFlipMatches.ts # Uses prisma.coinFlipMatch.*
├── rpsMatches.ts
├── etc.
└── lib/
    └── (NO MORE db-client.ts)
```

**Action:** Delete `partyserver/src/lib/db-client.ts` after rewriting all routes.

---

### 2A.3 Rewrite Each Route Handler

This is the main work. Each route must:

1. **Replace** Tarobase `get()`/`set()`/`getMany()` calls with Prisma queries
2. **Keep** the same API contract (request/response format unchanged)
3. **Validate** input with Zod (already in place)
4. **Return** same response shape via `sendSuccess()` / `ApiErrors`

#### Example Pattern: Games Route

**OLD (Tarobase):**
```typescript
// partyserver/src/routes/games.ts
import { getMany, set } from '../lib/db-client';

export async function createGame(c: Context, data: CreateGameRequest) {
  const gameId = generateId();
  const game = {
    id: gameId,
    creator: data.creator,
    playerCount: 1,
    state: 'waiting',
    buyIn: data.buyIn,
    buyInCurrency: data.buyInCurrency,
    createdAt: Date.now(),
  };
  
  await set(`games/${gameId}`, game);  // ← Tarobase
  return sendSuccess(c, game);
}

export async function listGames(c: Context) {
  const games = await getMany('games');  // ← Tarobase
  return sendSuccess(c, games);
}
```

**NEW (Prisma):**
```typescript
// partyserver/src/routes/games.ts
import { prisma } from '../db';
import { sendSuccess, ApiErrors } from '../lib/api-response';

export async function createGame(c: Context, data: CreateGameRequest) {
  const game = await prisma.game.create({
    data: {
      creator: data.creator,
      playerCount: 1,
      state: 'waiting',
      buyIn: BigInt(data.buyIn),
      buyInCurrency: data.buyInCurrency,
    },
  });
  
  return sendSuccess(c, {
    ...game,
    buyIn: game.buyIn.toString(), // BigInt → string for JSON
  });
}

export async function listGames(c: Context) {
  const games = await prisma.game.findMany({
    orderBy: { createdAt: 'desc' },
  });
  
  return sendSuccess(c, 
    games.map(g => ({
      ...g,
      buyIn: g.buyIn.toString(),
    }))
  );
}
```

**Key changes:**
- `getMany('games')` → `prisma.game.findMany()`
- `set('games/{id}', data)` → `prisma.game.create/update()`
- `BigInt` fields need `.toString()` for JSON serialization
- Error handling: catch and return `ApiErrors.internal(c, msg)`

---

### 2A.4 Route-by-Route Checklist

**Games (TapWars)**
- [ ] `POST /api/games` — createGame (use prisma.game.create)
- [ ] `GET /api/games` — listGames (use prisma.game.findMany)
- [ ] `GET /api/games/:id` — getGame (use prisma.game.findUnique)
- [ ] `POST /api/games/:id/join` — joinGame (prisma.game.update, add player2/3/4)
- [ ] `POST /api/games/:id/submit` — submitTaps (prisma.gameSubmission.create)
- [ ] `POST /api/games/:id/finalize` — finalizeGame (rank players, update winner)

**CoinFlip Matches**
- [ ] `POST /api/coinflip` — createMatch (prisma.coinFlipMatch.create)
- [ ] `GET /api/coinflip/:id` — getMatch
- [ ] `POST /api/coinflip/:id/join` — joinMatch (update opponent)
- [ ] `POST /api/coinflip/:id/resolve` — resolveMatch (pick winner)

**RPS Matches**
- [ ] `POST /api/rps` — createMatch (prisma.rpsMatch.create)
- [ ] `GET /api/rps/:id` — getMatch (include rounds)
- [ ] `POST /api/rps/:id/commit` — commitMove (prisma.rpsRound.create/update)
- [ ] `POST /api/rps/:id/reveal` — revealMove
- [ ] `POST /api/rps/:id/finalize-round` — finalizeRound

**FlashMatch**
- [ ] `POST /api/flash` — createMatch
- [ ] `POST /api/flash/:id/tap` — recordTap (prisma.flashTap.create)
- [ ] `POST /api/flash/:id/finalize` — finalizeMatch

**Daily Spins**
- [ ] `POST /api/spin` — spin (prisma.dailySpin.create, update pool)
- [ ] `GET /api/spin/history` — getSpinHistory
- [ ] `GET /api/spin/pool` — getPoolBalance

**Stakes & Fees**
- [ ] `POST /api/stake` — stakeTokens (prisma.mnyStake.upsert)
- [ ] `GET /api/stake/:address` — getStake
- [ ] `POST /api/distributions` — distributeFees (prisma.feePoolDistribution.create)

**Users**
- [ ] `GET /api/users/:address` — getUser (prisma.user.findUnique)
- [ ] `POST /api/users` — createUser (prisma.user.create)
- [ ] `PUT /api/users/:address` — updateUser (prisma.user.update)

---

### 2A.5 Common Patterns

**Creating records:**
```typescript
const record = await prisma.game.create({
  data: {
    id: generateId(), // or let Prisma use @default(cuid())
    creator: wallet,
    buyIn: BigInt(amount),
    // ... other fields
  },
});
```

**Finding records:**
```typescript
const game = await prisma.game.findUnique({
  where: { id: gameId },
  include: { submissions: true }, // Join related data
});

if (!game) return ApiErrors.notFound(c, 'Game not found');
```

**Updating records:**
```typescript
const updated = await prisma.game.update({
  where: { id: gameId },
  data: {
    player2: opponent,
    playerCount: 2,
  },
});
```

**Batch operations:**
```typescript
// Get multiple records in one query (faster than Promise.all with individual get)
const games = await prisma.game.findMany({
  where: { creator: address },
  orderBy: { createdAt: 'desc' },
  take: 10,
});
```

**BigInt handling:**
```typescript
// Prisma uses BigInt for BIGINT columns
const game = await prisma.game.findUnique({ where: { id } });
const buyInString = game.buyIn.toString(); // BigInt → string for JSON

// When creating:
await prisma.game.create({
  data: {
    buyIn: BigInt(request.buyIn), // string/number → BigInt
  },
});
```

**Error handling:**
```typescript
try {
  const game = await prisma.game.create({ data });
  return sendSuccess(c, game);
} catch (err) {
  console.error('Failed to create game:', err);
  return ApiErrors.internal(c, 'Failed to create game');
}
```

---

### 2A.6 Special Cases

**Transactions (multiple operations as one):**
```typescript
const result = await prisma.$transaction(async (tx) => {
  const game = await tx.game.create({ data: { /* ... */ } });
  await tx.gameSubmission.create({ data: { gameId: game.id, /* ... */ } });
  return game;
});
```

**Cascading deletes:**
- Already configured in schema (GameSubmission.gameId references Game.id with onDelete: Cascade)
- When deleting a Game, submissions auto-delete

**Unique constraints:**
- `GameSubmission` has `@@unique([gameId, player])` — upsert if exists
- `MnyStake` has `@@unique([stakerAddress])` — use `.upsert()`

```typescript
const stake = await prisma.mnyStake.upsert({
  where: { stakerAddress: address },
  update: { amountStaked: BigInt(amount) },
  create: { stakerAddress: address, amountStaked: BigInt(amount) },
});
```

---

### 2A.7 Testing Phase 2A

**Unit tests:**
```typescript
// Test each route with mock Prisma client
import { prismaMock } from '@jest/mock-prisma';

describe('games.ts', () => {
  it('should create a game', async () => {
    prismaMock.game.create.mockResolvedValue({ id: '1', /* ... */ });
    const result = await createGame(ctx, data);
    expect(result.success).toBe(true);
  });
});
```

**Integration tests:**
- Use real Supabase database (test database)
- Test full flow: create → join → submit → resolve
- Verify BigInt serialization works
- Check cascade deletes work

**Checklist:**
- [ ] All routes compile (no TS errors)
- [ ] All Tarobase imports removed from routes/
- [ ] BigInt fields converted to strings in responses
- [ ] Error cases handled (404, 400, 500)
- [ ] Timestamps match expected format
- [ ] Foreign keys work (join operations create related records)

---

## Phase 2B: Frontend Auth Migration

### 2B.1 Current Auth Flow (Poof)

```typescript
// src/hooks/useAuth.ts (CURRENT - Poof)
import { useWallet } from '@pooflabs/web';

export function useAuth() {
  const { user, login, logout } = useWallet();
  
  return {
    user: user ? { address: user.address } : null,
    login,
    logout,
    loading: false,
  };
}

// src/lib/api-client.ts (CURRENT)
import { getIdToken } from '@pooflabs/web';

export async function createAuthenticatedApiClient(token: string) {
  return {
    post: async (endpoint: string, data: any) => {
      const idToken = await getIdToken();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'X-Wallet-Address': user.address,
        },
        body: JSON.stringify(data),
      });
      return response.json();
    },
  };
}
```

### 2B.2 New Auth Flow (Phantom)

```typescript
// src/hooks/useAuth.ts (NEW - Phantom)
import { useWallet } from '@solana/wallet-adapter-react';

export function useAuth() {
  const { publicKey, connected, connect, disconnect, signMessage } = useWallet();
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    try {
      // Phantom auto-connects if already approved
      if (!connected) await connect();
      
      // Sign a message to get auth token
      const message = new TextEncoder().encode(
        `Sign to authenticate: ${Date.now()}`
      );
      const signature = await signMessage?.(message);
      
      if (!signature || !publicKey) throw new Error('Signature failed');
      
      // Store token in localStorage
      const token = Buffer.from(signature).toString('base64');
      localStorage.setItem('auth_token', token);
      
      return { address: publicKey.toBase58() };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('auth_token');
    await disconnect();
  };

  return {
    user: connected && publicKey ? { address: publicKey.toBase58() } : null,
    login,
    logout,
    loading,
  };
}
```

### 2B.3 Install Phantom Wallet Adapter

```bash
npm install @solana/wallet-adapter-react @solana/wallet-adapter-phantom @solana/wallet-standard
```

### 2B.4 Update App Root with Provider

**File:** `src/App.tsx`

```typescript
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';

const network = WalletAdapterNetwork.Mainnet; // or Devnet for testing
const endpoint = 'https://api.mainnet-beta.solana.com';

const wallets = [
  new PhantomWalletAdapter(),
  // Can add other adapters (Solflare, Ledger, etc.)
];

export function App() {
  return (
    <WalletProvider wallets={wallets} autoConnect>
      <Router>
        {/* routes */}
      </Router>
    </WalletProvider>
  );
}
```

### 2B.5 Update API Client

**File:** `src/lib/api-client.ts`

```typescript
import { useWallet } from '@solana/wallet-adapter-react';

export async function createAuthenticatedApiClient(
  token: string,
  address: string
) {
  return {
    get: async (endpoint: string) => {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Wallet-Address': address,
        },
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },

    post: async (endpoint: string, data: any) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Wallet-Address': address,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },

    // ... other methods
  };
}
```

### 2B.6 Update Backend Auth Validation

**File:** `partyserver/src/lib/poof-auth.ts` (RENAME to `wallet-auth.ts`)

```typescript
// partyserver/src/lib/wallet-auth.ts (NEW - replaces poof-auth.ts)
import { Context } from 'hono';
import { AuthenticationError } from './api-response';

export async function validateWalletAuth(c: Context) {
  const authHeader = c.req.header('Authorization');
  const walletAddress = c.req.header('X-Wallet-Address');

  if (!authHeader || !walletAddress) {
    throw new AuthenticationError(c, 'Missing auth headers');
  }

  // For now: just validate headers exist
  // TODO (Phase 4): Verify actual Phantom wallet signature
  
  return { walletAddress };
}

export async function validateAdminAuth(c: Context) {
  const { walletAddress } = await validateWalletAuth(c);

  // TODO: Check if walletAddress is in admin list (from env/db)
  const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',');
  
  if (!adminAddresses.includes(walletAddress)) {
    throw new AuthenticationError(c, 'Not authorized');
  }

  return { walletAddress };
}
```

**Update all route imports:**
```typescript
// OLD
import { validatePoofAuth } from '../lib/poof-auth';

// NEW
import { validateWalletAuth, validateAdminAuth } from '../lib/wallet-auth';
```

### 2B.7 Checklist

- [ ] Install @solana/wallet-adapter-react, @solana/wallet-adapter-phantom
- [ ] Update src/App.tsx with WalletProvider
- [ ] Rewrite useAuth() hook to use Phantom
- [ ] Update API client (use token + address headers)
- [ ] Delete src/lib/poof-oauth.ts (Poof-specific)
- [ ] Delete @pooflabs/web imports from package.json
- [ ] Rename poof-auth.ts → wallet-auth.ts, update implementation
- [ ] Test login/logout flow manually in browser
- [ ] Verify X-Wallet-Address header sent to backend

---

## Integration: Putting It Together

### Order of Operations

1. **Backend first (Phase 2A):**
   - Rewrite all routes → Prisma
   - Deploy new backend (still accepts old headers)
   - Test with curl/Postman

2. **Frontend second (Phase 2B):**
   - Install Phantom adapter
   - Update useAuth() hook
   - Test login/logout flow
   - Run full game flow end-to-end

3. **Cutover:**
   - When both complete, remove old Poof packages
   - Remove old @pooflabs imports
   - Redeploy both frontend + backend

### Testing Strategy

**Phase 2A Testing:**
```bash
# Start backend
cd partyserver && npm run dev

# Test routes with curl
curl -X POST http://localhost:8787/api/games \
  -H "Authorization: Bearer test-token" \
  -H "X-Wallet-Address: 11111111111111111111111111111111" \
  -d '{"buyIn": 1000, "buyInCurrency": "SOL"}'
```

**Phase 2B Testing:**
```
1. Open app in browser
2. Click "Login" button
3. Phantom wallet pops up
4. Sign message
5. Token stored in localStorage
6. Make API call (should have headers)
7. Create game
8. Join game
9. Submit taps
10. Verify winner determined
```

---

## File Summary

### Phase 2A Files to Modify/Create

| File | Action | Notes |
|------|--------|-------|
| `partyserver/src/db.ts` | **CREATE** | Prisma client setup |
| `partyserver/src/routes/games.ts` | **REWRITE** | Tarobase → Prisma |
| `partyserver/src/routes/coinFlipMatches.ts` | **REWRITE** | Tarobase → Prisma |
| `partyserver/src/routes/rpsMatches.ts` | **REWRITE** | Tarobase → Prisma |
| `partyserver/src/routes/flashMatches.ts` | **REWRITE** | Tarobase → Prisma |
| `partyserver/src/routes/dailySpins.ts` | **REWRITE** | Tarobase → Prisma |
| `partyserver/src/routes/mnyStakes.ts` | **REWRITE** | Tarobase → Prisma |
| `partyserver/src/routes/users.ts` | **REWRITE** | Tarobase → Prisma |
| `partyserver/src/lib/db-client.ts` | **DELETE** | No longer needed |
| `partyserver/src/index.ts` | **UPDATE** | Import db instead of db-client |

### Phase 2B Files to Modify/Create

| File | Action | Notes |
|------|--------|-------|
| `src/hooks/useAuth.ts` | **REWRITE** | Phantom instead of Poof |
| `src/lib/api-client.ts` | **UPDATE** | Use token + address headers |
| `src/App.tsx` | **UPDATE** | Add WalletProvider |
| `partyserver/src/lib/wallet-auth.ts` | **CREATE** | Rename from poof-auth.ts |
| `partyserver/src/lib/poof-auth.ts` | **DELETE** | Replace with wallet-auth.ts |
| `partyserver/src/lib/poof-oauth.ts` | **DELETE** | Poof-specific, not needed |
| `package.json` | **UPDATE** | Remove @pooflabs/web, add @solana/wallet-adapter-* |

---

## Estimated Effort

| Task | Hours | Notes |
|------|-------|-------|
| **Phase 2A Total** | 40-50 | Mostly find/replace + testing |
| Route rewrites (6 routes) | 30 | ~5 hours per route |
| Testing & debugging | 10 | Integration testing |
| **Phase 2B Total** | 8-12 | Auth swap |
| Phantom setup | 3 | Install, configure provider |
| useAuth rewrite | 3 | Logic is simpler |
| API client update | 2 | Headers change |
| Testing | 4 | Login/logout/API flow |
| **Grand Total** | 48-62 hours | ~1-1.5 weeks full-time |

---

## Success Criteria

When Phase 2 is complete:

- [ ] All routes use Prisma (no Tarobase imports)
- [ ] All routes return proper 200/400/401/404/500 responses
- [ ] BigInt fields serialize to strings correctly
- [ ] Frontend uses Phantom wallet (can login/logout)
- [ ] API requests include Authorization + X-Wallet-Address headers
- [ ] Full game flow works: create → join → play → resolve
- [ ] No @pooflabs imports remain in frontend or backend
- [ ] All tests pass (unit + integration)

---

## Next Steps (Phase 3 & Beyond)

After Phase 2A + 2B:

- **Phase 3:** Deploy rewritten backend to production
- **Phase 4:** Add crypto features (VRF, vault, transfers) — deferred until now

See `MIGRATION_PLAN.md` for full context.

---

## Notes for Next Session

1. **Prisma already installed** — @prisma/client + prisma CLI ready
2. **Schema already created** — 15 tables in Supabase ✅
3. **.env.local has DATABASE_URL** — No setup needed
4. **Start with 2A** — Routes rewrite has most impact
5. **2B runs in parallel** — Can tackle simultaneously if needed
6. **Keep testing simple initially** — Just verify API returns data
7. **BigInt gotcha** — Always convert to string before JSON response

---

**Created:** 2026-05-29  
**Status:** Ready for implementation  
**Questions?** Refer to `docs/API_SPECIFICATION.md` for full endpoint details
