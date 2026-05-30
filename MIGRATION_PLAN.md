# Poof Independence Migration Plan

## Overview

Goal: Remove ALL Poof dependencies while keeping game logic intact. Defer crypto features (VRF, escrow, signatures) to final phase.

**Architecture:**
- Database: Tarobase → **Supabase (PostgreSQL)**
- Auth: @pooflabs/web → **Phantom wallet adapter**
- Backend: Cloudflare Workers → **Railway/Node.js OR keep CF Workers**
- Crypto features: **Defer to Phase 4**

---

## Dependency Graph

```
PHASE 1: DATABASE MIGRATION (BLOCKER)
  └─ Migrate Tarobase → Supabase
     └─ Define PostgreSQL schema
     └─ Data migration scripts
     └─ Unblocks everything else

PHASE 2: API REWRITE (Parallel 1)
  └─ Rewrite routes: Tarobase SDK → Supabase queries
     └─ games.ts
     └─ coinFlipMatches.ts
     └─ rpsMatches.ts
     └─ dailySpins.ts
     └─ mnyStakes.ts
     └─ All 13+ collections
     └─ Unblocks backend deployment

PHASE 2B: FRONTEND AUTH (Parallel 2 — INDEPENDENT)
  └─ Replace @pooflabs/web → Phantom
     └─ Update useAuth() hook
     └─ Update login/logout flow
     └─ Update header construction (JWT strategy)
     └─ No database dependency

PHASE 3: BACKEND HOSTING (Parallel 3 — Depends on Phase 2)
  └─ Deploy rewritten API
     └─ Option A: Keep Cloudflare Workers (minimal changes)
     └─ Option B: Migrate to Railway/Node.js
     └─ Unblocks end-to-end testing

PHASE 4: CRYPTO FEATURES (LAST — Deferred)
  └─ Vault keypair management
     └─ Solana RPC integration
     └─ VRF oracle setup (Switchboard)
     └─ Escrow account creation
     └─ Token/SOL transfers
     └─ Smart contract integration (if needed)

```

---

## Full Dependency Matrix

**Q: Which tasks MUST happen in order?**

```
STRICT ORDER (Sequential):
1. Database schema design + migration script
2. API routes rewritten (uses database)

CAN RUN IN PARALLEL (Independent):
- Frontend auth rewrite (doesn't touch database/API yet)
- Backend hosting setup (ready once API is rewritten)
- Documentation updates

MUST WAIT UNTIL ABOVE COMPLETE:
- Backend deployment
- End-to-end testing
- Crypto features
```

**Q: What can be deferred to "crypto phase"?**

```
Can be deferred (games work without):
✅ VRF randomness for CoinFlip (just pick winner client-side)
✅ Vault signatures (games resolve without on-chain payout)
✅ Escrow accounts (store buy-ins in database for now)
✅ Token transfers (track balances in DB, claim later)
✅ Heartbeat tasks (manual resolution for testing)
✅ Fee distributions (track but don't distribute)

Cannot be deferred (core game logic):
❌ Database (Phase 1 blocker)
❌ API routes (needed for game creation/joining)
❌ Frontend auth (needed to identify users)
❌ Game state transitions (waiting → playing → resolved)
```

---

## Phase 1: Database Migration (BLOCKER)

### Step 1a: Set up Supabase

```bash
# 1. Create Supabase project
# Go to supabase.com → create new project
# Database: PostgreSQL 15
# Region: us-east-1 (or nearest)

# 2. Get connection string
# Project settings → Database → Connection string → URI
DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# 3. Install Prisma (ORM)
cd solplayroom
npm install @prisma/client prisma
npx prisma init
```

### Step 1b: Design PostgreSQL Schema

Create `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ─────────────────────────────────────────────────────────────
// GAMES (TapWars)
// ─────────────────────────────────────────────────────────────

model Game {
  id                String    @id @default(cuid())
  creator           String    @db.VarChar(255)
  player2           String?   @db.VarChar(255)
  player3           String?   @db.VarChar(255)
  player4           String?   @db.VarChar(255)
  playerCount       Int       @default(1)
  state             String    @default("waiting") // waiting, playing, resolved
  createdAt         DateTime  @default(now())
  startedAt         DateTime?
  winner            String?   @db.VarChar(255)
  secondPlace       String?   @db.VarChar(255)
  winnerScore       Int       @default(0)
  secondPlaceScore  Int       @default(0)
  buyIn             BigInt
  buyInCurrency     String    @default("SOL") // SOL or MNY
  gameType          String?
  txSignature       String?   @db.VarChar(255) // Solana tx hash (Phase 4)

  // Relations
  submissions GameSubmission[]

  @@index([creator])
  @@index([state])
  @@index([createdAt])
}

model GameSubmission {
  id         String   @id @default(cuid())
  gameId     String
  player     String   @db.VarChar(255)
  tapCount   Int
  submittedAt DateTime @default(now())

  game Game @relation(fields: [gameId], references: [id], onDelete: Cascade)

  @@unique([gameId, player])
  @@index([gameId])
}

// ─────────────────────────────────────────────────────────────
// COINFLIP
// ─────────────────────────────────────────────────────────────

model CoinFlipMatch {
  id              String    @id @default(cuid())
  creator         String    @db.VarChar(255)
  opponent        String?   @db.VarChar(255)
  tier            Int       // 1, 2, or 3
  buyIn           BigInt
  state           String    @default("waiting") // waiting, resolved, cancelled
  winner          String?   @db.VarChar(255)
  createdAt       DateTime  @default(now())
  buyInCurrency   String    @default("SOL")
  vrfResult       String?   @db.VarChar(255) // Phase 4: VRF proof
  txSignature     String?   @db.VarChar(255) // Phase 4: Payout tx

  @@index([creator])
  @@index([state])
  @@index([createdAt])
}

// ─────────────────────────────────────────────────────────────
// RPS (Rock Paper Scissors)
// ─────────────────────────────────────────────────────────────

model RpsMatch {
  id              String    @id @default(cuid())
  creator         String    @db.VarChar(255)
  opponent        String    @db.VarChar(255)
  buyInLamports   BigInt
  status          String    @default("waiting") // waiting, active, complete, abandoned
  creatorWins     Int       @default(0)
  opponentWins    Int       @default(0)
  currentRound    Int       @default(1)
  winner          String?   @db.VarChar(255)
  createdAt       DateTime  @default(now())
  buyInCurrency   String    @default("SOL")
  lastActivityAt  DateTime  @default(now())
  txSignature     String?   @db.VarChar(255) // Phase 4

  rounds RpsRound[]

  @@index([creator])
  @@index([status])
  @@index([lastActivityAt])
}

model RpsRound {
  id              String    @id @default(cuid())
  matchId         String
  roundNumber     Int
  creatorCommit   String?   @db.VarChar(255) // SHA-256 hash
  creatorReveal   String?   @db.VarChar(255) // rock, paper, scissors
  opponentCommit  String?   @db.VarChar(255)
  opponentReveal  String?   @db.VarChar(255)
  winner          String?   @db.VarChar(255)
  createdAt       DateTime  @default(now())

  match RpsMatch @relation(fields: [matchId], references: [id], onDelete: Cascade)

  @@unique([matchId, roundNumber])
  @@index([matchId])
}

// ─────────────────────────────────────────────────────────────
// FLASHTAP
// ─────────────────────────────────────────────────────────────

model FlashMatch {
  id            String    @id @default(cuid())
  creator       String    @db.VarChar(255)
  player2       String?   @db.VarChar(255)
  player3       String?   @db.VarChar(255)
  player4       String?   @db.VarChar(255)
  state         String    @default("waiting") // waiting, playing, resolved
  flashMomentMs BigInt?
  createdAt     DateTime  @default(now())
  startedAt     DateTime?
  winner        String?   @db.VarChar(255)
  secondPlace   String?   @db.VarChar(255)

  taps FlashTap[]

  @@index([creator])
  @@index([state])
}

model FlashTap {
  id            String    @id @default(cuid())
  matchId       String
  player        String    @db.VarChar(255)
  tapTime       BigInt
  reactionTime  BigInt?   // calculated: tapTime - flashMomentMs

  match FlashMatch @relation(fields: [matchId], references: [id], onDelete: Cascade)

  @@unique([matchId, player])
}

// ─────────────────────────────────────────────────────────────
// DAILY SPIN
// ─────────────────────────────────────────────────────────────

model DailySpin {
  id               String    @id @default(cuid())
  spinnerAddress   String    @db.VarChar(255)
  prizeAmount      Float     // MNY
  createdAt        DateTime  @default(now())

  @@index([spinnerAddress, createdAt])
}

model DailySpinPool {
  id               String    @id @default("main")
  balance          BigInt    @default(100000000000) // 100k MNY in base units
  updatedAt        DateTime  @default(now()) @updatedAt
}

model SpinPayout {
  id               String    @id @default(cuid())
  spinId           String
  playerAddress    String    @db.VarChar(255)
  amount           BigInt
  createdAt        DateTime  @default(now())

  @@index([playerAddress])
}

// ─────────────────────────────────────────────────────────────
// STAKING & FEES
// ─────────────────────────────────────────────────────────────

model MnyStake {
  id               String    @id @default(cuid())
  stakerAddress    String    @db.VarChar(255) @unique
  amountStaked     BigInt    @default(0)
  stakedAt         DateTime  @default(now())
  unstakedAt       DateTime?

  @@index([stakerAddress])
}

model FeePoolDistribution {
  id               String    @id @default(cuid())
  stakerAddress    String    @db.VarChar(255)
  amountDistributed BigInt
  epochHour        Int
  distributedAt    DateTime  @default(now())

  @@unique([epochHour, stakerAddress]) // Idempotent
  @@index([stakerAddress])
}

// ─────────────────────────────────────────────────────────────
// TOKEN UNLOCKS
// ─────────────────────────────────────────────────────────────

model TokenUnlock {
  id               String    @id @default(cuid())
  label            String    @db.VarChar(255)
  totalAmount      BigInt
  unlockedAt       DateTime?
  index            Int       @unique

  @@index([index])
}

// ─────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────

model User {
  id               String    @id @default(cuid())
  address          String    @db.VarChar(255) @unique
  username         String?   @db.VarChar(255)
  createdAt        DateTime  @default(now())
  lastSeenAt       DateTime  @default(now()) @updatedAt

  @@index([address])
}

// ─────────────────────────────────────────────────────────────
// TOKEN INFO
// ─────────────────────────────────────────────────────────────

model TokenInfo {
  id               String    @id @default("mny")
  mint             String    @db.VarChar(255)
  supply           BigInt
  decimals         Int
  name             String    @db.VarChar(255)
}
```

### Step 1c: Deploy Schema to Supabase

```bash
# 1. Create migration
npx prisma migrate dev --name init

# 2. Verify tables in Supabase dashboard
# supabase.com → Project → Table Editor

# 3. Generate Prisma client
npx prisma generate
```

### Step 1d: Data Migration (if migrating from existing Tarobase)

```typescript
// scripts/migrate-tarobase-to-supabase.ts
import { PrismaClient } from '@prisma/client';
import { getMany } from '@/lib/db-client'; // Old Tarobase SDK

const prisma = new PrismaClient();

async function migrateGames() {
  console.log('Migrating games...');
  const games = await getMany('games');
  
  for (const game of games) {
    await prisma.game.create({
      data: {
        id: game.id,
        creator: game.creator,
        player2: game.player2,
        player3: game.player3,
        player4: game.player4,
        playerCount: game.playerCount,
        state: game.state,
        createdAt: new Date(game.createdAt * 1000),
        startedAt: game.startedAt ? new Date(game.startedAt * 1000) : null,
        winner: game.winner,
        secondPlace: game.secondPlace,
        winnerScore: game.winnerScore || 0,
        secondPlaceScore: game.secondPlaceScore || 0,
        buyIn: BigInt(game.buyIn),
        buyInCurrency: game.buyInCurrency || 'SOL',
      }
    });
  }
}

async function migrateSubmissions() {
  console.log('Migrating game submissions...');
  const subs = await getMany('gameSubmissions');
  
  for (const sub of subs) {
    await prisma.gameSubmission.create({
      data: {
        id: sub.id,
        gameId: sub.gameId,
        player: sub.player,
        tapCount: sub.tapCount,
        submittedAt: new Date(sub.submittedAt * 1000),
      }
    });
  }
}

async function main() {
  try {
    await migrateGames();
    await migrateSubmissions();
    // ... repeat for all 13+ collections
    console.log('✅ Migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

// Run:
// bun run scripts/migrate-tarobase-to-supabase.ts
```

**⏱️ Phase 1 Effort: 3-4 days**

---

## Phase 2A: API Routes Rewrite (Parallel to 2B)

### Step 2a: Update Database Client

```typescript
// partyserver/src/db.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Replaces old db-client.ts imports
```

### Step 2b: Rewrite Game Routes

Replace Tarobase SDK calls with Prisma:

```typescript
// partyserver/src/routes/games.ts (NEW)
import { prisma } from '../db';
import { sendSuccess, ApiErrors } from '../lib/api-response';

// Create Game
export async function createGame(c: Context, gameId: string, data: GameRequest) {
  const created = await prisma.game.create({
    data: {
      id: gameId,
      creator: data.creator,
      playerCount: 1,
      state: 'waiting',
      buyIn: BigInt(data.buyIn),
      buyInCurrency: data.buyInCurrency,
    }
  });
  
  return sendSuccess(c, created);
}

// Finalize Game
export async function finalizeGame(c: Context, gameId: string) {
  // 1. Get game
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { submissions: true }
  });
  
  if (!game) return ApiErrors.notFound(c, 'Game not found');
  if (game.state === 'resolved') {
    return sendSuccess(c, { winner: game.winner, secondPlace: game.secondPlace });
  }
  if (game.state !== 'playing') {
    return ApiErrors.badRequest(c, 'Game not in playing state');
  }
  
  // 2. Get all submissions
  const submissions = await prisma.gameSubmission.findMany({
    where: { gameId }
  });
  
  // 3. Rank by score + submission time
  const ranked = [game.creator, game.player2, game.player3, game.player4]
    .filter(Boolean)
    .map(addr => ({
      address: addr,
      tapCount: submissions.find(s => s.player === addr)?.tapCount ?? 0,
      submittedAt: submissions.find(s => s.player === addr)?.submittedAt ?? new Date(0),
    }))
    .sort((a, b) => {
      if (b.tapCount !== a.tapCount) return b.tapCount - a.tapCount;
      return a.submittedAt.getTime() - b.submittedAt.getTime();
    });
  
  // 4. Update game
  const updated = await prisma.game.update({
    where: { id: gameId },
    data: {
      state: 'resolved',
      winner: ranked[0]?.address,
      secondPlace: ranked[1]?.address,
      winnerScore: ranked[0]?.tapCount ?? 0,
      secondPlaceScore: ranked[1]?.tapCount ?? 0,
    }
  });
  
  // TODO (Phase 4): Transfer pot from escrow to winner
  // TODO (Phase 4): Transfer fee to fee pool
  
  return sendSuccess(c, {
    winner: updated.winner,
    secondPlace: updated.secondPlace,
    winnerScore: updated.winnerScore,
    secondPlaceScore: updated.secondPlaceScore,
  });
}

// List games
export async function listGames(c: Context) {
  const games = await prisma.game.findMany({
    where: { state: 'waiting', playerCount: { lt: 4 } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  
  return sendSuccess(c, games);
}
```

### Step 2c: Rewrite All Collection Routes

Repeat pattern for:
- `coinFlipMatches.ts`
- `rpsMatches.ts`
- `dailySpins.ts`
- `flashMatches.ts`
- `mnyStakes.ts`
- `tokenUnlocks.ts`
- `users.ts`

**Key changes:**
```typescript
// OLD (Tarobase)
const game = await getGames(gameId);
await setGames(gameId, { winner, state: 'resolved' });
const games = await getMany('games', 'state = @state', { state: 'waiting' });

// NEW (Prisma/Supabase)
const game = await prisma.game.findUnique({ where: { id: gameId } });
await prisma.game.update({ where: { id: gameId }, data: { winner, state: 'resolved' } });
const games = await prisma.game.findMany({ where: { state: 'waiting' } });
```

### Step 2d: Remove Tarobase Dependencies

```bash
# 1. Remove @pooflabs libraries
npm uninstall @pooflabs/web @pooflabs/server @pooflabs/core

# 2. Remove from imports
# partyserver/src/lib/db-client.ts → DELETE
# src/lib/collections/*.ts → DELETE (rewrite)

# 3. Update partyserver/src/index.ts
# Remove Tarobase initialization middleware
```

**Before:**
```typescript
// partyserver/src/index.ts
app.use('*', async (c, next) => {
  const config = getTarobaseServerConfig();
  await init(config);
  await next();
});
```

**After:**
```typescript
// partyserver/src/index.ts
import { prisma } from './db';

app.use('*', async (c, next) => {
  // Prisma client already initialized globally
  await next();
});
```

**⏱️ Phase 2A Effort: 1-2 weeks**

---

## Phase 2B: Frontend Auth Migration (Parallel, Independent)

### Step 2b-1: Remove Poof Auth

```bash
npm uninstall @pooflabs/web
npm install @solana/wallet-adapter-react @solana/wallet-adapter-wallets \
  @solana/wallet-adapter-base @solana/web3.js
```

### Step 2b-2: Replace useAuth() Hook

**Before (Poof):**
```typescript
// src/hooks/useAuth.tsx
import { useAuth as usePoofAuth } from '@pooflabs/web';

export const useAuth = () => {
  const { login, logout, user, loading } = usePoofAuth();
  return { login, logout, user, loading };
};
```

**After (Phantom):**
```typescript
// src/hooks/useAuth.tsx
import { useWallet } from '@solana/wallet-adapter-react';
import { useCallback, useState } from 'react';

export const useAuth = () => {
  const { publicKey, connected, signMessage, disconnect } = useWallet();
  const [loading, setLoading] = useState(false);

  const login = useCallback(async () => {
    // Wallet popup auto-appears via useWallet
    // No explicit login needed, just wait for connected
  }, []);

  const logout = useCallback(async () => {
    await disconnect();
  }, []);

  const user = connected && publicKey
    ? { address: publicKey.toBase58() }
    : null;

  return {
    login,
    logout,
    user,
    loading,
    signMessage, // New: for auth signature
  };
};
```

### Step 2b-3: Set up Wallet Provider

```typescript
// src/App.tsx
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

const network = WalletAdapterNetwork.Mainnet;
const endpoint = clusterApiUrl(network);

const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
];

export default function App() {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ThemeProvider>
            {/* App routes */}
          </ThemeProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

### Step 2b-4: Replace JWT with Sign-Message Auth

Old Poof flow: Get JWT token from Cognito  
New flow: Sign message with wallet, verify backend

```typescript
// src/lib/api-client.ts
import { getAuthHeaders } from './auth';

export async function createAuthenticatedApiClient(walletAddress: string) {
  const headers = await getAuthHeaders(walletAddress);
  
  return {
    get: (path: string) => fetch(`${API_URL}${path}`, { headers }),
    post: (path: string, body: any) =>
      fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }),
  };
}

// src/lib/auth.ts
import { useWallet } from '@solana/wallet-adapter-react';

export async function getAuthHeaders(walletAddress: string) {
  const { signMessage } = useWallet();
  
  const message = `Sign to authenticate: ${Date.now()}`;
  const encodedMessage = new TextEncoder().encode(message);
  const signedMessage = await signMessage(encodedMessage);
  
  return {
    'Authorization': `Bearer ${Buffer.from(signedMessage).toString('base64')}`,
    'X-Wallet-Address': walletAddress,
    'X-Signature-Message': message,
  };
}
```

**Backend verification:**
```typescript
// partyserver/src/lib/auth.ts
import { nacl } from '@solana/web3.js';

export async function validateAuth(c: Context) {
  const authHeader = c.req.header('Authorization');
  const walletAddress = c.req.header('X-Wallet-Address');
  const signatureMessage = c.req.header('X-Signature-Message');
  
  if (!authHeader || !walletAddress || !signatureMessage) {
    throw new AuthenticationError('Missing auth headers');
  }
  
  const signature = Buffer.from(
    authHeader.replace('Bearer ', ''),
    'base64'
  );
  
  const messageBytes = new TextEncoder().encode(signatureMessage);
  const publicKey = new PublicKey(walletAddress);
  
  const isValid = nacl.sign.detached.verify(
    messageBytes,
    signature,
    publicKey.toBytes()
  );
  
  if (!isValid) throw new AuthenticationError('Invalid signature');
  
  return { walletAddress };
}
```

### Step 2b-5: Update API Client Usage

```typescript
// Before (Poof)
const { user } = useAuth();
const token = await getIdToken();

// After (Phantom)
const { user } = useAuth();
const headers = await getAuthHeaders(user.address);
```

**⏱️ Phase 2B Effort: 3-5 days**

---

## Phase 3: Backend Hosting & Deployment

### Option A: Keep Cloudflare Workers (Minimal Changes)

```bash
# 1. Update wrangler.toml
name = "solplayroom-api"
main = "src/index.ts"
account_id = "YOUR_CF_ACCOUNT_ID"

[env.production]
routes = [{ pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }]

[vars]
DATABASE_URL = "postgresql://..."
NODE_ENV = "production"

# 2. Update src/index.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

app.use('*', async (c, next) => {
  // Prisma already initialized
  await next();
});

# 3. Deploy
wrangler deploy --env production
```

### Option B: Migrate to Railway (Recommended)

```bash
# 1. Create Railway account
# railway.app

# 2. Create project
railway init

# 3. Add Postgres database (auto-provisioned)
railway add

# 4. Deploy
railway deploy

# 5. Railway auto-sets DATABASE_URL env var
```

**⏱️ Phase 3 Effort: 2-3 days**

---

## Phase 2B+3 Summary: Non-Crypto Testing

**What works after Phase 2A+2B+3:**

✅ Game creation/joining (no payment)  
✅ Game state transitions (waiting → playing → resolved)  
✅ Winner calculation (no payout)  
✅ User authentication (wallet signatures)  
✅ Daily spins (no prize transfers)  
✅ Staking tracking (no fee distribution)  
✅ Real-time game lobbies  
✅ RPS commit-reveal logic  
✅ FlashTap reaction time calculation  

**What's stubbed/deferred:**

❌ No SOL/MNY transfers (Phase 4)  
❌ No VRF (Phase 4)  
❌ No vault signatures (Phase 4)  
❌ No escrow accounts (Phase 4)  
❌ No heartbeat tasks (Phase 4)  
❌ No on-chain verification (Phase 4)  

**Total Phase 2+3 Effort: 2-3 weeks**

---

## Phase 4: Crypto Features (DEFERRED)

Only tackle after phases 1-3 are complete and tested.

### Step 4a: Vault Keypair Setup

```typescript
// partyserver/src/lib/vault.ts
import { Keypair } from '@solana/web3.js';
import fs from 'fs';

// Generate vault keypair (one-time)
const vault = Keypair.generate();
fs.writeFileSync('./vault.json', JSON.stringify(Array.from(vault.secretKey)));

// Load in production
export const vaultKeypair = Keypair.fromSecretKey(
  Buffer.from(JSON.parse(process.env.VAULT_PRIVATE_KEY!))
);
```

### Step 4b: Solana RPC Integration

```typescript
// partyserver/src/lib/solana.ts
import { Connection, PublicKey } from '@solana/web3.js';

export const connection = new Connection(
  process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
  'confirmed'
);

export const vaultAddress = vaultKeypair.publicKey;
```

### Step 4c: Add Transfers to Game Finalization

```typescript
// partyserver/src/routes/games.ts

export async function finalizeGame(c: Context, gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  
  // ... existing winner calculation ...
  
  // Phase 4: Transfer pot
  if (game.buyInCurrency === 'SOL') {
    const pot = game.buyIn * BigInt(4) * BigInt(99) / BigInt(100);
    
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: vaultAddress,
        toPubkey: new PublicKey(game.winner),
        lamports: Number(pot),
      })
    );
    
    const sig = await connection.sendTransaction(tx, [vaultKeypair]);
    
    await prisma.game.update({
      where: { id: gameId },
      data: { txSignature: sig }
    });
  }
  
  return sendSuccess(c, { winner: game.winner, txSignature: sig });
}
```

### Step 4d: VRF for CoinFlip

```typescript
// partyserver/src/lib/switchboard.ts
import * as sbv2 from "@switchboard-xyz/solana.js";

export async function requestVRF() {
  const queue = new sbv2.OracleQueueAccount(
    program,
    new PublicKey(process.env.SWITCHBOARD_QUEUE_ID!)
  );
  
  const randomnessKeypair = Keypair.generate();
  
  const tx = await sbv2.Randomness.createRandomnessRequestInstruction(
    program,
    queue,
    randomnessKeypair,
    vaultKeypair
  );
  
  const sig = await connection.sendTransaction(tx, [vaultKeypair, randomnessKeypair]);
  
  // Poll for result
  let result;
  while (!result) {
    const randomness = await sbv2.Randomness.fetch(
      program,
      randomnessKeypair.publicKey
    );
    result = randomness.getValue();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  return result; // 0 = heads, 1 = tails
}
```

**⏱️ Phase 4 Effort: 2-3 weeks** (can be iterative)

---

## Dependency Matrix (Which tasks block what?)

```
Phase 1: Database Migration
  ↓ (BLOCKER for everything backend)
  
Phase 2A: API Rewrite
  ├─ Phase 2B: Auth Migration (PARALLEL, independent)
  │   ├─ Update API client usage
  │   └─ No blocker
  │
  └─ Phase 3: Backend Deployment
      ├─ Depends on: Phase 2A complete
      └─ Blocks: End-to-end testing

Phase 4: Crypto Features
  ├─ Depends on: Phases 1-3 complete and tested
  ├─ Can be done incrementally
  └─ Blocks: Live mainnet deployment
```

---

## Execution Timeline

| Phase | Effort | Time | Parallel? |
|-------|--------|------|-----------|
| **1: DB Migration** | High | 3-4 days | — |
| **2A: API Rewrite** | High | 1-2 weeks | After Phase 1 |
| **2B: Auth Migration** | Medium | 3-5 days | Parallel to 2A |
| **3: Deployment** | Low | 2-3 days | After Phase 2A |
| **Testing (2A+2B+3)** | Medium | 3-5 days | After Phase 3 |
| **4: Crypto Features** | High | 2-3 weeks | After testing passes |
| **TOTAL** | **Very High** | **6-8 weeks** | — |

---

## Recommended Parallel Work

```
Week 1-2:
  ├─ Engineer A: Database setup (Phase 1)
  └─ Engineer B: Auth migration (Phase 2B) + docs update

Week 2-4:
  ├─ Engineer A: API rewrite (Phase 2A)
  └─ Engineer B: Backend setup (Phase 3 prep)

Week 4-5:
  ├─ Both: End-to-end testing
  └─ Deploy to Railway

Week 6-8:
  ├─ Engineer A: Crypto features (Phase 4)
  └─ Engineer B: Heartbeat tasks + cron
```

---

## Go/No-Go Checklist Before Phase 4

✅ Database fully migrated and tested  
✅ All 13+ collections working in Supabase  
✅ API routes rewritten and responding  
✅ Wallet auth working (Phantom signatures)  
✅ Game creation/finalization working (no transfers)  
✅ End-to-end flow tested on testnet  
✅ No Poof dependencies in code  
✅ Backend deployed and stable  
✅ Zero broken tests  

**Only after ALL above: start Phase 4**

---

## What CAN'T Be Deferred (Must Happen First)

```
MUST DO (in order):
1. Database migration (Tarobase → Supabase)
2. API rewrite to use Supabase
3. Backend deployment with new database
4. Auth replacement (Poof → Phantom)
5. End-to-end testing (game logic without crypto)

THEN later:
6. Vault management
7. VRF integration
8. Token transfers
9. Heartbeat tasks
```

---

## Risk Mitigation

**Risk:** Supabase connection pooling limits  
**Mitigation:** Use Railway managed Postgres or Supabase enterprise plan

**Risk:** Wallet signature verification bugs  
**Mitigation:** Use verified libraries (@solana/web3.js nacl), heavy testing

**Risk:** Lost data during Tarobase → Supabase migration  
**Mitigation:** Full backup before migration, validation script after

**Risk:** API response format incompatibility  
**Mitigation:** Responses stay same JSON format, frontend doesn't break

**Risk:** Phase 4 dependencies unclear  
**Mitigation:** Design Phase 4 after Phases 1-3 complete

---

## Key Files to Delete (Poof Removal)

```
DELETE:
src/lib/collections/*.ts        (replaced by Prisma queries)
src/lib/db-client.ts             (replaced by Prisma)
src/lib/tarobase.ts              (Poof-specific)
src/hooks/useAuth.tsx            (replaced by wallet adapter)
src/contexts/OAuthContext.tsx     (Poof OAuth)
partyserver/src/lib/poof-*.ts    (Poof libraries)
partyserver/src/db-client.ts     (Poof database client)
partyserver/heartbeat/           (defer to Phase 4)

MODIFY:
partyserver/src/routes/*.ts      (Tarobase → Prisma queries)
partyserver/src/index.ts         (remove Tarobase init)
package.json / partyserver/package.json (remove @pooflabs/*)
```

