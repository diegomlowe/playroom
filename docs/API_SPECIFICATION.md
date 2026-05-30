# API Specification

## Overview

The SolPlayroom API is a REST API running on **Cloudflare Workers** via **Hono**. All endpoints return standardized JSON responses with exactly 5 HTTP status codes.

- **Base URL:** `https://{TAROBASE_APP_ID}-api.poof.new`
- **Authentication:** JWT Bearer token + X-Wallet-Address header
- **Response Format:** `{ success, data|error, timestamp, requestId }`

---

## General Response Format

### Success Response (200)

```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "timestamp": 1234567890000,
  "requestId": "req_abc123xyz"
}
```

### Error Response (400, 401, 404, 500)

```json
{
  "success": false,
  "error": "Human-readable error message",
  "timestamp": 1234567890000,
  "requestId": "req_abc123xyz"
}
```

### Status Codes (5 total)

| Code | Meaning | When Returned |
|------|---------|---------------|
| **200** | OK | Successful operation |
| **400** | Bad Request | Invalid input, missing required fields, business logic violation |
| **401** | Unauthorized | Invalid JWT, expired token, not authenticated |
| **404** | Not Found | Resource doesn't exist, route not found |
| **500** | Internal Server Error | Server-side failure, unhandled exception |

---

## Authentication

### Required Headers

Every authenticated endpoint requires:

```http
Authorization: Bearer <JWT_TOKEN>
X-Wallet-Address: <WALLET_ADDRESS>
Content-Type: application/json
```

### Getting a Token

Use `@pooflabs/web` on frontend:

```typescript
import { getIdToken } from '@pooflabs/web';

const token = await getIdToken();
const walletAddress = user.address; // from useAuth()
```

### Admin Authentication

Admin endpoints verify wallet address against `ADMIN_ADDRESS` constant.

```typescript
// Returns error if user is not admin
const { walletAddress } = await validatePoofAuth(c, true);
```

---

## Endpoints

### 1. Health Check

**GET** `/health`

Health check endpoint for monitoring and deployment verification.

#### Response

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": 1234567890000
  },
  "timestamp": 1234567890000,
  "requestId": "req_abc123xyz"
}
```

**Status:** 200 OK

---

### 2. Finalize TapWars Game

**POST** `/api/games/:gameId/finalize`

Finalize a TapWars game by computing winner from all player submissions, then triggering on-chain payout.

#### Authentication

✅ Required (any player)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `gameId` | string | Unique game identifier |

#### Request Body

```typescript
// No body required — endpoint reads from database
```

#### Response

```json
{
  "success": true,
  "data": {
    "winner": "wallet_address_of_winner",
    "secondPlace": "wallet_address_of_second",
    "winnerScore": 487,        // tap count
    "secondPlaceScore": 412
  },
  "timestamp": 1234567890000,
  "requestId": "req_abc123xyz"
}
```

#### Behavior

1. **Idempotent:** If game already resolved, returns cached winner
2. **Grace period:** Waits up to 15 seconds after game end for late submissions
3. **Missing submissions:** Players who didn't submit counted as 0 taps
4. **Ranking:** Highest taps wins; earliest submission as tiebreaker
5. **State update:** Sets `game.state = "resolved"` (triggers payout hook)

#### Errors

```json
// 404 - Game not found
{
  "success": false,
  "error": "Game not found"
}

// 400 - Game not in playing state
{
  "success": false,
  "error": "Game not ready — state must be \"playing\""
}

// 400 - Too few submissions (within grace period)
{
  "success": false,
  "error": "Waiting for submissions — 2/4 received, 8s remaining"
}

// 500 - Could not determine winner
{
  "success": false,
  "error": "Could not determine winner — not enough players"
}
```

#### Example

```bash
curl -X POST \
  https://api.poof.new/api/games/game_12345/finalize \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Wallet-Address: $WALLET" \
  -H "Content-Type: application/json"
```

---

### 3. Start FlashTap Match

**POST** `/api/flashtap/:matchId/start`

Initialize a FlashTap match by setting the random flash timing and transitioning to "playing" state.

#### Authentication

✅ Required (any player)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `matchId` | string | Unique match identifier |

#### Request Body

```json
{}
```

#### Response

```json
{
  "success": true,
  "data": {
    "matchId": "match_12345",
    "flashMomentMs": 3456,  // milliseconds when flash will trigger
    "status": "playing"
  },
  "timestamp": 1234567890000,
  "requestId": "req_abc123xyz"
}
```

#### Behavior

1. Generates random flash timing (500-3000ms)
2. Sets `match.state = "playing"`
3. Sets `match.flashMomentMs` (server time offset)
4. Initializes reaction time tracking

#### Errors

```json
// 404 - Match not found
{
  "success": false,
  "error": "Match not found"
}

// 400 - Match already started
{
  "success": false,
  "error": "Match already in progress"
}
```

---

### 4. Resolve FlashTap Match

**POST** `/api/flashtap/:matchId/resolve`

Determine winner of FlashTap match based on closest reaction time.

#### Authentication

✅ Required (any player)

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `matchId` | string | Unique match identifier |

#### Response

```json
{
  "success": true,
  "data": {
    "winner": "wallet_address_of_winner",
    "winnerReactionTime": 145,     // milliseconds
    "secondPlace": "wallet_address_of_second",
    "secondReactionTime": 218
  },
  "timestamp": 1234567890000,
  "requestId": "req_abc123xyz"
}
```

#### Behavior

1. Reads all tap submissions from flashMatchTaps
2. Calculates reaction time = tap time - flash moment
3. Winner = closest to 0ms (absolute value)
4. Sets `match.state = "resolved"` (triggers payout)
5. Idempotent: returns cached winner if already resolved

---

### 5. Perform Daily Spin

**POST** `/api/daily-spin`

Execute a daily spin, checking cooldown, picking weighted prize, and updating pool balance.

#### Authentication

✅ Required (any user)

#### Request Body

```json
{}
```

#### Response

```json
{
  "success": true,
  "data": {
    "prizeAmount": 0.5,            // MNY
    "poolBalanceAfter": 98765.43,  // MNY
    "spinId": "spin_abc123xyz",
    "nextSpinAvailable": 1234567890  // Unix timestamp
  },
  "timestamp": 1234567890000,
  "requestId": "req_abc123xyz"
}
```

#### Prize Distribution

Weighted random selection:

| Prize (MNY) | Probability | Weight |
|-------------|-------------|--------|
| 0 (loss) | 40% | 0.40 |
| 0.1 | 30% | 0.30 |
| 0.5 | 20% | 0.20 |
| 1 | 9% | 0.09 |
| 5 | 0.9% | 0.009 |
| 10 | 0.1% | 0.001 |

#### Behavior

1. Checks user's last spin timestamp (24-hour cooldown)
2. If cooldown not met, returns error
3. Selects weighted prize
4. Deducts prize from `spinPool` balance
5. Records spin in `dailySpins` collection
6. Records payout in `spinPayouts` (if prize > 0)
7. Returns next available spin time

#### Errors

```json
// 401 - Not authenticated
{
  "success": false,
  "error": "Not logged in"
}

// 400 - Cooldown not met
{
  "success": false,
  "error": "Spin available again in 8h 23m"
}

// 400 - Pool insufficient
{
  "success": false,
  "error": "Spin pool insufficient balance"
}
```

#### Example

```bash
curl -X POST \
  https://api.poof.new/api/daily-spin \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Wallet-Address: $WALLET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### 6. Resolve CoinFlip Match

**POST** `/api/coinflip/resolve`

Resolve a CoinFlip match using VRF-based randomness, determining winner and triggering payout.

#### Authentication

✅ Required (any player)

#### Request Body

```json
{
  "matchId": "match_12345",
  "call": "heads"  // or "tails" — the player's choice
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "matchId": "match_12345",
    "result": "heads",             // actual VRF result
    "winner": "wallet_address",    // creator or opponent
    "payout": 0.199,               // SOL or MNY
    "userWon": true                // from caller's perspective
  },
  "timestamp": 1234567890000,
  "requestId": "req_abc123xyz"
}
```

#### Behavior

1. Verifies match exists and is in "waiting" state
2. Requests VRF randomness from oracle
3. VRF result (0 = heads, 1 = tails)
4. Determines winner:
   - If player call matches result: player wins
   - Else: opponent wins
5. Calculates payout (pot × 0.99, minus 1% fee)
6. Sets `match.state = "resolved"` (triggers on-chain transfer)
7. Records in `coinFlipMatches` collection

#### Errors

```json
// 404 - Match not found
{
  "success": false,
  "error": "CoinFlip match not found"
}

// 400 - Match not in waiting state
{
  "success": false,
  "error": "Match not ready for resolution"
}

// 400 - Invalid call parameter
{
  "success": false,
  "error": "Call must be 'heads' or 'tails'"
}

// 500 - VRF oracle unavailable
{
  "success": false,
  "error": "Failed to request VRF randomness"
}
```

---

### 7. Auto-Cancel Stale CoinFlip Matches (Heartbeat)

**Internal Heartbeat Task**

Runs every 2 minutes automatically. Cancels CoinFlip matches that have been waiting >10 minutes without an opponent, refunding buy-ins.

**Trigger:** Cloudflare Heartbeat (scheduled)

**Logic:**
```typescript
// For each match in state "waiting":
//   if (now - created_at > 10 minutes) {
//     refund buy-in to creator
//     set state = "cancelled"
//   }
```

---

### 8. Distribute Fee Pool (Heartbeat)

**Internal Heartbeat Task**

Runs every 1 hour automatically. Snapshots all active MNY stakes and distributes SOL from fee pool pro-rata.

**Trigger:** Cloudflare Heartbeat (scheduled)

**Logic:**
```typescript
// Get all stakers with amountStaked > 0
// Get fee pool balance
// For each staker:
//   pro_rata_share = staker_amount / total_staked
//   transfer = fee_pool_balance * pro_rata_share
//   transfer SOL from fee pool to staker wallet
// Record distribution in feePoolDistributions
```

---

### 9. Resolve Waiting CoinFlip Matches (Heartbeat)

**Internal Heartbeat Task**

Runs every 1 minute automatically. Resolves CoinFlip matches that have an opponent waiting.

**Trigger:** Cloudflare Heartbeat (scheduled)

**Logic:**
```typescript
// For each match in state "waiting" with both players present:
//   request VRF randomness
//   determine winner
//   transfer pot to winner (minus fee)
//   set state = "resolved"
```

---

## Data Types

### Game Response

```typescript
interface GamesResponse {
  id: string;
  creator: string;              // wallet address
  player2?: string;
  player3?: string;
  player4?: string;
  state: 'waiting' | 'playing' | 'resolved';
  startedAt: number;            // Unix seconds
  createdAt: number;
  winner?: string;
  secondPlace?: string;
  winnerScore?: number;
  secondPlaceScore?: number;
  playerCount: number;          // 1-4
  buyInLamports?: number;
}
```

### CoinFlip Match Response

```typescript
interface CoinFlipMatchesResponse {
  id: string;
  creator: string;              // wallet address
  opponent?: string;
  state: 'waiting' | 'resolved' | 'cancelled';
  createdAt: number;
  buyInLamports: number;
  tier: 1 | 2 | 3;              // Tier 1, 2, 3
  currency: 'SOL' | 'MNY';
  winner?: string;
  vrfProof?: string;
  result?: 'heads' | 'tails';
}
```

### RPS Match Response

```typescript
interface RpsMatchesResponse {
  id: string;
  player1: string;              // wallet address
  player2: string;
  state: 'commit' | 'reveal' | 'resolved' | 'abandoned';
  createdAt: number;
  round: number;                // 1-3 (best of 3)
  player1Score: number;         // 0-3 wins
  player2Score: number;
  buyInLamports: number;
  winner?: string;
}
```

### Daily Spin Response

```typescript
interface DailySpinsResponse {
  id: string;
  spinnerAddress: string;       // wallet address
  prizeAmount: number;          // MNY
  createdAt: number;
  spinId: string;
}
```

### Stake Response

```typescript
interface MnyStakesResponse {
  id: string;                   // wallet address
  stakerAddress: string;
  amountStaked: number;         // base units (1e6)
  stakedAt: number;
  unstakedAt?: number;
}
```

---

## Error Codes & Messages

### Authentication Errors (401)

```json
{
  "success": false,
  "error": "Authorization header missing"
}
```

```json
{
  "success": false,
  "error": "Invalid token"
}
```

```json
{
  "success": false,
  "error": "Token expired"
}
```

```json
{
  "success": false,
  "error": "Wallet address mismatch"
}
```

### Validation Errors (400)

```json
{
  "success": false,
  "error": "Missing gameId"
}
```

```json
{
  "success": false,
  "error": "Invalid input: amount must be positive"
}
```

### Resource Errors (404)

```json
{
  "success": false,
  "error": "Game not found"
}
```

```json
{
  "success": false,
  "error": "Route not found"
}
```

### Server Errors (500)

```json
{
  "success": false,
  "error": "Database write failed"
}
```

```json
{
  "success": false,
  "error": "VRF oracle timeout"
}
```

---

## Rate Limiting

**Current:** No rate limiting implemented.

**Recommended for production:**
- 100 requests per minute per IP
- 1000 requests per day per wallet
- 10 concurrent requests per session

---

## Pagination

**Current:** No pagination implemented.

**Recommended for collections endpoint:**

```http
GET /api/games?limit=20&offset=0
```

Response includes:

```json
{
  "success": true,
  "data": {
    "games": [...],
    "total": 450,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Testing

### cURL Examples

#### Health Check

```bash
curl https://api.poof.new/health
```

#### Finalize Game

```bash
TOKEN=$(get-token)  # Implement token retrieval
WALLET=$(get-address)

curl -X POST \
  https://api.poof.new/api/games/game_123/finalize \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Wallet-Address: $WALLET" \
  -H "Content-Type: application/json"
```

#### Daily Spin

```bash
curl -X POST \
  https://api.poof.new/api/daily-spin \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Wallet-Address: $WALLET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Postman Collection

Import this collection for testing:

```json
{
  "info": {
    "name": "SolPlayroom API",
    "description": "API endpoints for gaming platform"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/health"
      }
    },
    {
      "name": "Finalize Game",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/api/games/{{gameId}}/finalize",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "X-Wallet-Address",
            "value": "{{wallet}}"
          }
        ]
      }
    }
  ]
}
```

---

## Versioning

**Current:** v1 (no versioning suffix)

**Future:** When breaking changes occur, use `/v2/` prefix:

```http
POST /v2/api/games/:gameId/finalize
```

---

## CORS

**Allowed Origins:**
- Preview: `*-preview.poof.new`
- Live: `solplayroom.poof.new`, `*.poof.new`
- Local: `localhost:*`

**Methods:** GET, POST, PUT, DELETE, PATCH, OPTIONS

**Headers:** Authorization, X-Wallet-Address, Content-Type

---

## Webhooks (Future)

Not currently implemented. Future plans:

```
POST /webhooks/game.resolved
POST /webhooks/spin.awarded
POST /webhooks/match.created
```

---

## Changelog

### v1.0 (2026)

- Initial API release
- 6 game-specific endpoints
- 3 heartbeat tasks
- Standard response format
- JWT authentication

### Planned

- Pagination support
- Rate limiting
- Webhooks
- GraphQL option
- WebSocket subscriptions (currently via Tarobase)
