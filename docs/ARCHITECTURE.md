# Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Data Flow](#data-flow)
6. [Real-Time Synchronization](#real-time-synchronization)
7. [Security Architecture](#security-architecture)
8. [Deployment Architecture](#deployment-architecture)

---

## System Overview

**SolPlayroom** is a **decentralized multiplayer gaming platform** on Solana that combines real-time browser games with on-chain rewards and cryptographic fairness guarantees.

### Core Pillars

1. **Real-time Gaming** — Sub-second game resolution and player sync
2. **On-chain Fairness** — VRF-based randomness, cryptographic commit-reveal
3. **Web3 Integration** — Wallet auth, SOL/MNY transactions, governance ready
4. **Distributed State** — Tarobase (on-chain database) as single source of truth

---

## High-Level Architecture

### System Components Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                       USER INTERFACE LAYER                         │
│                         (React 19 SPA)                             │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Pages: Home, TapWars, FlashTap, CoinFlip, RPS, Spin   │     │
│  │  Components: Lobbies, Matches, Marketplace, Staking    │     │
│  │  Effects: Aurora, Particles, Meteors, Glows (WebGL)    │     │
│  └─────────────────────────────────────────────────────────┘     │
└─────────────────────────────┬──────────────────────────────────────┘
                              │
                    HTTP (REST + WebSocket)
                              │
        ┌─────────────────────┴──────────────────────┐
        │                                            │
        ▼                                            ▼
   ┌─────────────────────┐            ┌─────────────────────┐
   │  FRONTEND STATE     │            │   API CLIENT        │
   │  MANAGEMENT         │            │   (@/lib/api-client)│
   │                     │            │                     │
   │ • useAuth()         │            │ • GET /health       │
   │ • useRealtimeData() │────HTTP────│ • POST /api/games/* │
   │ • Collections/      │            │ • POST /api/spin    │
   │   Subscriptions     │            │ • POST /api/coinflip│
   └─────────────────────┘            └─────────────────────┘
                                              │
                                    HTTP (5 status codes)
                                              │
        ┌─────────────────────────────────────┴──────────────────────┐
        │                                                              │
        ▼                                                              ▼
   ┌──────────────────────────────┐    ┌──────────────────────────────┐
   │  BACKEND API LAYER           │    │  SCHEDULED TASKS              │
   │  (Hono on Cloudflare Workers)│    │  (Cloudflare Heartbeat)       │
   │                              │    │                              │
   │  Routes:                     │    │  • auto-cancel-stale-matches  │
   │  • POST /api/games/:id/*     │    │  • distribute-fee-pool        │
   │  • POST /api/flashtap/*      │    │  • resolve-coinflip-matches   │
   │  • POST /api/daily-spin      │    │                              │
   │  • POST /api/coinflip/*      │    │  Runs: Every 1-60 minutes     │
   │  • POST /api/rps/*           │    │                              │
   │                              │    │                              │
   │  Middleware:                 │    │                              │
   │  • Auth (validatePoofAuth)   │    └──────────────────────────────┘
   │  • CORS                      │
   │  • Rate limiting             │
   │  • Error handling            │
   │  • Request logging           │
   └──────────────────────────────┘
                   │
                   │ Tarobase SDK + Solana RPC
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   ┌─────────────┐      ┌──────────────────────┐
   │   TAROBASE  │      │   SOLANA BLOCKCHAIN  │
   │   (Poof)    │      │   (Mainnet/Devnet)   │
   │             │      │                      │
   │ Collections:│      │  • VRF Oracle        │
   │ • games     │      │  • Fee Pool PDA      │
   │ • matches   │      │  • Vault PDA         │
   │ • spins     │      │  • Token Accounts    │
   │ • stakes    │      │  • User Wallets      │
   │ • tokens    │      │                      │
   │ • unlocks   │      │  On-chain State      │
   │ • scores    │      │  Settlement          │
   │             │      │  Verification        │
   └─────────────┘      └──────────────────────┘
```

---

## Frontend Architecture

### Directory Structure

```
src/
├── components/
│   ├── Game Pages (10+ files)
│   │   ├── HomePage.tsx            - TapWars list & create
│   │   ├── Lobby.tsx               - Game waiting room
│   │   ├── TapGame.tsx             - Tap game UI + logic
│   │   ├── CoinFlipLobby.tsx       - CoinFlip match creation
│   │   ├── CoinFlipMatch.tsx       - Active match state
│   │   ├── RpsLobby.tsx            - RPS match list
│   │   ├── RpsMatch.tsx            - RPS commit/reveal UI
│   │   ├── DailySpinPage.tsx       - Spin wheel visualization
│   │   ├── MarketplacePage.tsx     - Token unlock pie chart
│   │   └── PlayroomPage.tsx        - Landing page & staking
│   │
│   ├── effects/                    - Visual effects (WebGL)
│   │   ├── AuroraBackground.tsx    - Gradient animation
│   │   ├── Particles.tsx           - Canvas particle system
│   │   ├── Meteors.tsx             - Falling meteorites
│   │   └── 15+ other effects
│   │
│   ├── poof-ui/                    - Layout components
│   │   ├── PageLayout.tsx          - Nav + footer wrapper
│   │   ├── HeroSection.tsx         - Landing hero
│   │   ├── FeatureCard.tsx         - Game tile
│   │   ├── StatCard.tsx            - Metric display
│   │   └── MetricGrid.tsx          - Dashboard layout
│   │
│   └── ui/                         - shadcn/ui primitives
│       ├── Button, Card, Dialog, Input, Select, etc.
│       └── 50+ atomic components
│
├── hooks/
│   ├── use-realtime-data.tsx       - Tarobase subscription wrapper
│   ├── use-auth.tsx                - Wallet connection (via @pooflabs/web)
│   ├── use-theme.tsx               - Theme provider
│   └── use-mobile.tsx              - Responsive breakpoint
│
├── lib/
│   ├── collections/                - Tarobase queries (20+ files)
│   │   ├── games.ts                - Games CRUD + subscription
│   │   ├── coinFlipMatches.ts      - CoinFlip state
│   │   ├── rpsMatches.ts           - RPS state
│   │   ├── dailySpins.ts           - Spin records
│   │   ├── mnyStakes.ts            - Staking records
│   │   ├── tokenUnlocks.ts         - Token unlock state
│   │   └── commonQueries.ts        - Token balance queries
│   │
│   ├── api-client.ts               - HTTP client wrapper
│   ├── db-client.ts                - Tarobase SDK initialization
│   ├── config.ts                   - Environment config
│   ├── constants.ts                - App constants (prices, addresses)
│   └── utils.ts                    - Helpers (format, truncate, etc)
│
├── contexts/
│   └── OAuthContext.tsx            - Social login (disabled)
│
├── App.tsx                         - React Router + routes
├── main.tsx                        - Vite entry point
└── theme.ts                        - Design tokens (colors, radius, fonts)
```

### Component Hierarchy

```
<App>
  └─ <ThemeProvider>
     ├─ <Routes>
     │  ├─ <PlayroomPage/>           (/)
     │  ├─ <HomePage/>               (/tapwars)
     │  ├─ <Lobby/>                  (/games/:gameId)
     │  ├─ <CoinFlipLobby/>          (/coinflip)
     │  ├─ <CoinFlipMatch/>          (/coinflip/:matchId)
     │  ├─ <RpsLobby/>               (/rps)
     │  ├─ <RpsMatch/>               (/rps/:matchId)
     │  ├─ <DailySpinPage/>          (/daily-spin)
     │  ├─ <MarketplacePage/>        (/marketplace)
     │  ├─ <WhitepaperPage/>         (/whitepaper)
     │  └─ <TermsPage/>              (/terms)
     │
     ├─ <NicknameGate/>              (Overlay - nickname gating)
     └─ <Toaster/>                   (Sonner notifications)
```

### State Management Pattern

**Frontend uses a "Tarobase-first" architecture** — no Redux or Zustand for game state.

```
┌─────────────────────────────────────────────┐
│     Component Wants Data (e.g., games)      │
└───────────────┬─────────────────────────────┘
                │
                ▼
    ┌───────────────────────────┐
    │  useRealtimeData Hook     │
    │  (Custom hook)            │
    └───────────┬───────────────┘
                │
                ▼
    ┌───────────────────────────┐
    │  subscribeManyGames()     │
    │  (Tarobase subscription)  │
    └───────────┬───────────────┘
                │
                ▼
    ┌───────────────────────────┐
    │  @pooflabs/web SDK        │
    │  (Real-time listener)     │
    └───────────┬───────────────┘
                │
                ▼
    ┌───────────────────────────┐
    │  On-chain Tarobase        │
    │  (Single source of truth) │
    └───────────────────────────┘

Example usage:
const { data: games } = useRealtimeData<GamesResponse[]>(
  subscribeManyGames,
  true  // auto-subscribe
);
```

### Styling Architecture

- **Tailwind CSS** — Utility-first framework
- **shadcn/ui** — Accessible components with Radix UI
- **Custom theme.ts** — Design tokens (colors, font, radius)
- **Inline styles** — Dynamic colors, animations
- **Framer Motion** — Complex animations

---

## Backend Architecture

### File Structure

```
partyserver/
├── src/
│   ├── index.ts                    - Hono app + middleware stack
│   │
│   ├── routes/
│   │   └── index.ts                - API route registration + routeSpec[]
│   │
│   ├── collections/                - Database operations (20+ files)
│   │   ├── games.ts                - TapWars CRUD
│   │   ├── gameSubmissions.ts      - Tap count submissions
│   │   ├── coinFlipMatches.ts      - 1v1 match management
│   │   ├── flashMatches.ts         - FlashTap match state
│   │   ├── dailySpins.ts           - Spin records
│   │   ├── mnyStakes.ts            - Stake management
│   │   └── [15+ more]
│   │
│   ├── heartbeat/                  - Scheduled tasks
│   │   ├── auto-cancel-stale-matches.ts
│   │   ├── distribute-fee-pool.ts
│   │   └── resolve-coinflip-matches.ts
│   │
│   ├── lib/
│   │   ├── poof-auth.ts            - JWT validation + admin check
│   │   ├── api-response.ts         - Response format (sendSuccess, ApiErrors)
│   │   ├── x402-middleware.ts      - Payment enforcement
│   │   ├── cors-helpers.ts         - CORS configuration
│   │   ├── config.ts               - Tarobase config
│   │   ├── request-logger.ts       - HTTP logging
│   │   └── db-client.ts            - Tarobase SDK
│   │
│   └── db-client.ts                - Tarobase + Solana setup
│
├── heartbeat.json                  - Task scheduling config
├── queues.json                     - Queue configuration (empty)
└── wrangler.toml                   - Cloudflare Workers config
```

### Request Flow

```
HTTP Request
    ↓
┌──────────────────────────┐
│  CORS Middleware         │  ← Check origin in allowed list
│  (/lib/cors-helpers.ts)  │
└────────┬─────────────────┘
         ↓
┌──────────────────────────┐
│  Request Logger          │  ← Log method, path, timestamp
│  (/lib/request-logger.ts)│
└────────┬─────────────────┘
         ↓
┌──────────────────────────┐
│  Request ID Middleware   │  ← Attach unique request ID
│  (/lib/api-response.ts)  │
└────────┬─────────────────┘
         ↓
┌──────────────────────────┐
│  Route Handler           │  ← POST /api/games/:gameId/finalize
│  (/routes/index.ts)      │
└────────┬─────────────────┘
         ↓
┌──────────────────────────┐
│  validatePoofAuth(c)     │  ← Verify JWT + extract wallet
│  (/lib/poof-auth.ts)     │
└────────┬─────────────────┘
         ↓
┌──────────────────────────┐
│  Business Logic          │  ← Read submissions, rank players
│  (route handler body)    │  ← Calculate winner
└────────┬─────────────────┘
         ↓
┌──────────────────────────┐
│  Database Write          │  ← setGames(id, { winner, ... })
│  (collections/*.ts)      │  ← Triggers on-chain payout hook
└────────┬─────────────────┘
         ↓
┌──────────────────────────┐
│  sendSuccess(c, data)    │  ← Return 200 + response
│  (/lib/api-response.ts)  │
└────────┬─────────────────┘
         ↓
  HTTP 200 Response
```

### API Response Format

All responses follow a standard format (per `ApiErrors`):

```typescript
// Success (200)
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "timestamp": 1234567890000,
  "requestId": "req_xyz123"
}

// Error (400, 401, 404, 500)
{
  "success": false,
  "error": "Error message",
  "timestamp": 1234567890000,
  "requestId": "req_xyz123"
}
```

### Middleware Stack (index.ts)

```typescript
1. Tarobase Initialization         // Load db config
2. CORS Middleware                 // Cross-origin requests
3. x402 Middleware                 // Payment enforcement (if configured)
4. Request ID Middleware           // Unique request ID
5. Request Logger                  // Log all requests
6. Global Error Handler            // Catch unhandled errors
7. Route Handlers                  // API endpoints
8. 404 Handler                     // Unknown routes
```

---

## Data Flow

### Game Creation & Resolution Flow

```
FRONTEND                           BACKEND                        BLOCKCHAIN
   │                                 │                               │
   ├─ User clicks "Create Game"      │                               │
   │                                 │                               │
   ├─ Frontend calls setGames()      │                               │
   │  (Tarobase collection)          │                               │
   │                                 │                               │
   ├─────────────────────────────────►Tarobase SDK                   │
   │                                 ├──────────────────────────────►SOL payment
   │                                 │                               │
   │  ◄──────────────────────────────┤ Game doc created            │
   │  (game object: id, creator,     │ in database                 │
   │   state: "waiting",...)         │                               │
   │                                 │                               │
   ├─ Game lobby shown               │                               │
   │  Live-subscribe to game         │                               │
   │  via useRealtimeData()          │                               │
   │                                 │                               │
   ├─ User joins (3 more players)    │                               │
   │                                 │                               │
   ├─ All 4 players present          │                               │
   │  Frontend calls API:            │                               │
   │  POST /api/games/:id/finalize   │                               │
   │                                 ├─ Taps counted               │
   ├─ Game running (10 seconds)      ├─ Winner ranked              │
   │  User taps rapidly              ├─ setGames(id, {...})       │
   │                                 │  state: "resolved"          │
   │ Each tap submitted to           ├──────────────────────────────►Vault signs
   │ gameSubmissions collection      │                               payout
   │                                 │                               │
   ├─ 10s elapsed                    │                               │
   │  Frontend submits tap count     │                               │
   │  via setGameSubmissionsPlayers()│                               │
   │                                 ◄──────────────────────────────┤ Payout
   │                                 │  settlement                   executed
   ├─ Waiting for resolution         │                               │
   │ (max 15 seconds grace period)   │                               │
   │                                 │                               │
   ├─────────────────────────────────►POST /api/games/:id/finalize  │
   │  (any player can trigger)       │                               │
   │                                 ├─ Reads all submissions      │
   │                                 ├─ Ranks: highest taps first   │
   │                                 ├─ Tiebreak: earliest submit   │
   │                                 ├─ setGames() → resolved       │
   │                                 ├──────────────────────────────►Hooks fire
   │                                 │                               payout
   │  ◄──────────────────────────────┤ Returns winner + score       transfers
   │  (winner, secondPlace,...)      │                               │
   │                                 │                               │
   ├─ UI shows winner/payout         │                               │
   │ Confetti animation              │                               │
   │                                 │                               │
   └─ Game added to "My Matches"     │                               │
      (via useRealtimeData)          │                               │
```

### Real-Time Sync Flow

```
Blockchain State Changed
       │
       ▼
Tarobase Index Updated
       │
       ▼
Subscription Listener Triggered
       │
       ▼
useRealtimeData Hook Notified
       │
       ▼
Component Re-renders with New Data
       │
       ▼
User Sees Live Updates
(No polling, purely event-driven)
```

---

## Real-Time Synchronization

### WebSocket Subscription Pattern

```typescript
// Frontend subscribes to a collection
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { subscribeManyGames } from '@/lib/collections/games';

const { data: games } = useRealtimeData<GamesResponse[]>(
  subscribeManyGames,  // Subscription function
  true,                // Auto-subscribe if true
  undefined,           // Filter (optional)
  true                 // Live mode (real-time updates)
);

// Under the hood:
// 1. useRealtimeData calls subscribeManyGames()
// 2. subscribeManyGames() calls Tarobase SDK subscription
// 3. @pooflabs/web opens WebSocket to Poof backend
// 4. Database emits changes → sent via WebSocket
// 5. Hook updates local state
// 6. Component re-renders
```

### Subscription Lifecycle

```
useEffect() triggers
         │
         ▼
subscribeManyGames() called
         │
         ▼
Tarobase SDK opens WebSocket
         │
         ▼
Initial data loaded (snapshot)
         │
         ▼
useRealtimeData state updated
         │
         ▼
Component renders
         │
         ▼
Listener active (listening for changes)
         │
         ▼
Database write occurs
         │
         ▼
Listener callback fired
         │
         ▼
Local state updated
         │
         ▼
Component re-renders
         │
         ▼
useEffect cleanup
         │
         ▼
WebSocket closed
```

---

## Security Architecture

### Authentication Layer

```
User connects wallet
         │
         ▼
Poof Auth (Cognito) verifies signature
         │
         ▼
JWT token issued (valid 1 hour)
         │
         ▼
Frontend stores token in memory
         │
         ▼
Each API request includes:
  Authorization: Bearer <JWT>
  X-Wallet-Address: <address>
         │
         ▼
Backend validatePoofAuth(c) verifies:
  1. JWT signature (cached JWKS)
  2. Token not expired
  3. Wallet address matches token
         │
         ▼
Admin routes call validatePoofAuth(c, true):
  4. Wallet address in ADMIN_ADDRESS
         │
         ▼
Authorized → proceed
Not authorized → 401 Unauthorized
```

### Data Access Control

```
User owns only their own data:
  • User's own game submissions
  • User's own match records
  • User's own stakes
  • User's wallet transactions

Policy-layer enforcement (Tarobase):
  • Players can only write to:
    - games/{gameId}/player1 (if creator)
    - gameSubmissions/{submissionId} (if player)
  • Vault account only entity that:
    - Resolves games (sets winner)
    - Distributes payouts
    - Transfers fees

No direct contract calls from frontend:
  • All transactions signed by vault
  • Frontend initiates, vault executes
  • Ensures atomicity and consistency
```

### Payment Security

```
x402 Payment Middleware (optional):
         │
  ┌──────┴──────┐
  │             │
  ▼             ▼
Route configured  Route NOT configured
in paidRoutes?    in paidRoutes?
  │                 │
  ▼                 ▼
Check x402    Proceed to
payment       handler
header
  │
  ▼
Payment verified
(Tarobase validates)
  │
  ▼
Proceed or reject
(401 Payment Required)
```

---

## Deployment Architecture

### Multi-Environment Setup

```
┌──────────────────────────────────────────────────────────┐
│                   PRODUCTION (LIVE)                       │
│                                                           │
│  Frontend:  solplayroom.poof.new  (CDN)                  │
│  Backend:   workers (CF-east1)                           │
│  Database:  Tarobase (mainnet)                           │
│  RPC:       Helius (mainnet Solana)                      │
│                                                           │
│  Build:     vite.config.prod.ts (minified)              │
│  Deploy:    wrangler deploy --env live                   │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                  PREVIEW (STAGING)                        │
│                                                           │
│  Frontend:  *-preview.poof.new  (CDN)                    │
│  Backend:   workers (CF-east1)                           │
│  Database:  Tarobase (devnet)                            │
│  RPC:       Helius (devnet Solana)                       │
│                                                           │
│  Build:     vite.config.ts (dev-optimized)              │
│  Deploy:    wrangler deploy --env preview                │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   LOCAL (DEVELOPMENT)                     │
│                                                           │
│  Frontend:  localhost:3000  (Vite dev server)            │
│  Backend:   localhost:1999  (Hono dev server)            │
│  Database:  Tarobase (devnet, local Cognito)            │
│  RPC:       localhost:8899  (Solana validator)           │
│                                                           │
│  Build:     bun run dev                                  │
│  Deploy:    N/A (dev only)                               │
└──────────────────────────────────────────────────────────┘
```

### Cloudflare Workers Deployment

```
wrangler.toml
    │
    ├─ name = "69f0360a525daf9178c8a6a7"  (Tarobase app ID)
    ├─ main = "src/index.ts"               (Entry point)
    ├─ account_id = "ccb9d9a85d..."       (CF account)
    ├─ compatibility_date = "2025-08-15"   (Runtime version)
    │
    ├─ [vars]
    │  ├─ TAROBASE_APP_ID
    │  ├─ JWT_ISSUER
    │  ├─ CORS_DEV_DOMAINS
    │  └─ CORS_PROD_DOMAINS
    │
    ├─ [[durable_objects.bindings]]
    │  └─ POOF_QUEUE_JOB_TRACKER  (Queue state)
    │
    └─ [limits]
       └─ cpu_ms = 300_000  (5 min timeout per request)
```

### CI/CD Pipeline (Poof)

```
Git Push
    │
    ▼
GitHub Actions
    │
    ├─ bun run check          (lint + type check)
    ├─ bun run build:full     (compile frontend + backend)
    │
    ├─ Tests (if configured)
    │
    ├─ Deploy Preview
    │  ├─ Upload dist/ to CDN
    │  └─ Deploy partyserver to CF Workers
    │
    └─ (On manual approval)
       └─ Deploy Live
          ├─ Upload dist/ to CDN
          └─ Deploy partyserver to CF Workers
```

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 | UI library |
| | Vite 6 | Build tool |
| | TypeScript | Type safety |
| | Tailwind CSS | Styling |
| | shadcn/ui | Components |
| | Framer Motion | Animations |
| | Three.js | 3D effects |
| **Backend** | Hono | Framework |
| | Cloudflare Workers | Serverless runtime |
| | TypeScript | Type safety |
| **Database** | Tarobase | On-chain state (Poof) |
| | Solana RPC | Blockchain queries |
| **Blockchain** | Solana | L1 blockchain |
| | VRF Oracle | Randomness |
| **Authentication** | Cognito | JWT issuer |
| | @pooflabs/web | Wallet UI |
| **DevOps** | Poof Cloud | Hosting + deployment |
| | Cloudflare | Workers + CDN |
| | Wrangler | CF Workers CLI |
| | Bun | Package manager + runtime |

---

## Performance Optimization

### Frontend

- **Code splitting** — Vendor, poof-specific chunks
- **Lazy loading** — Route-based code splitting
- **Tailwind purging** — Only used styles included
- **Image optimization** — SVG icons instead of images
- **WebGL effects** — Off-screen rendering, only visible elements
- **State batching** — Tarobase subscriptions debounced

### Backend

- **Cloudflare Cache** — JWKS cached 1 hour
- **Lazy Tarobase init** — Initialized on first request
- **Connection pooling** — Reused RPC connections
- **Error page caching** — 404s cached 1 minute
- **CPU limits** — 300 second timeout (5 minutes)

### Database

- **Tarobase indexing** — Fast queries on frequently accessed fields
- **Collection batching** — `getMany()` for multiple reads
- **Write coalescing** — Atomic multi-field updates
- **Pagination** — Limit result sets for large collections

---

## Failure Handling

| Component | Failure Mode | Recovery |
|-----------|--------------|----------|
| Frontend | Network down | Retry on reconnect |
| Frontend | Wallet rejected | Show error, retry |
| Backend | DB write fails | Return 500, log error |
| Backend | Auth fails | Return 401 |
| Blockchain | RPC timeout | Retry with exponential backoff |
| Blockchain | VRF oracle down | Game stalls, manual resolution |
| Heartbeat | Task fails | Retry next execution |
| Heartbeat | Out of memory | Killed by runtime, retry next hour |

---

## Scalability Considerations

- **Horizontal scaling** — Cloudflare Workers auto-scales
- **Database bottleneck** — Tarobase read/write latency
- **Concurrent players** — Limited by Solana network capacity
- **Real-time subscriptions** — Scales with Poof backend
- **Game resolution** — Serialized per game, parallel across games

For 100+ concurrent games, consider:
1. Database read replicas (if Tarobase supports)
2. Queue-based game resolution (batching)
3. Regional CF Workers (geo-routing)
4. Solana network upgrades (higher TPS)
