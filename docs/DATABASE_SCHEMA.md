# Database Schema

## Overview

SolPlayroom uses **Tarobase** (Poof's on-chain state layer) as the primary database. Tarobase stores data as hierarchical JSON documents on Solana, with real-time subscriptions and policy-based access control.

- **Location:** On-chain (Solana blockchain)
- **Query Language:** Tarobase SDK (TypeScript)
- **Subscriptions:** Real-time event-driven updates
- **Access Control:** Wallet-based + vault signatures

---

## Collections Map

```
tarobase/
├── games/
│   ├── {gameId}                    - TapWars game state
│   └── {gameId}/
│       ├── player1, player2, etc. - Individual player data (lazy-loaded)
│
├── gameSubmissions/
│   └── {submissionId}              - Tap count submission
│
├── coinFlipMatches/
│   └── {matchId}                   - 1v1 coin flip state
│
├── rpsMatches/
│   └── {matchId}                   - 1v1 RPS game state
│       └── rounds/
│           └── {roundNumber}       - Per-round commit/reveal state
│
├── flashMatches/
│   └── {matchId}                   - FlashTap match state
│
├── flashMatchJoins/
│   └── {joinId}                    - Player join record
│
├── flashMatchTaps/
│   └── {tapId}                     - Reaction time tap
│
├── dailySpins/
│   └── {spinId}                    - User spin history
│
├── dailySpinPool/
│   └── main                        - Current MNY prize pool balance
│
├── spinPayouts/
│   └── {payoutId}                  - Prize payout record
│
├── mnyStakes/
│   └── {walletAddress}             - User's staked MNY amount
│
├── feePoolDistributions/
│   └── {distributionId}            - Hourly fee distribution record
│
├── tokenUnlocks/
│   └── {milestoneId}               - Token unlock milestone state
│
├── tokenUnlockStats/
│   └── main                        - Global unlock statistics
│
├── users/
│   └── {walletAddress}             - User profile (username, etc.)
│
├── tprToken/
│   └── pppToken                    - Token mint metadata
│
├── tprListings/
│   └── {listingId}                 - Secondary market listing
│
├── tprPrimarySales/
│   └── {saleId}                    - Primary sale record
│
├── tprPrimarySaleStats/
│   └── main                        - Primary sale aggregates
│
├── tprPurchases/
│   └── {purchaseId}                - Purchase record
│
└── adminFiles/
    └── {fileId}                    - Admin-only data
```

---

## Core Collections

### 1. Games (TapWars)

**Path:** `games/{gameId}`

**Purpose:** 4-player tap racing game state and results

**Document Structure:**

| Field | Type | Required | Mutable | Description |
|-------|------|----------|---------|-------------|
| `id` | string | ✅ | ❌ | Unique game identifier (set by doc ID) |
| `creator` | Address | ✅ | ❌ | Wallet address of game creator (player 1) |
| `player2` | Address | ❌ | ✅ | Player 2 wallet address |
| `player3` | Address | ❌ | ✅ | Player 3 wallet address |
| `player4` | Address | ❌ | ✅ | Player 4 wallet address |
| `playerCount` | number | ✅ | ✅ | Current players joined (1-4) |
| `state` | string | ✅ | ✅ | Game state: `waiting` \| `playing` \| `resolved` |
| `createdAt` | number | ✅ | ❌ | Creation timestamp (Unix seconds) |
| `startedAt` | number | ❌ | ✅ | Game start timestamp (Unix seconds) |
| `winner` | Address | ❌ | ✅ | Winner wallet address (set on resolve) |
| `secondPlace` | Address | ❌ | ✅ | 2nd place wallet address |
| `winnerScore` | number | ✅ | ✅ | Winner's tap count (0 initially) |
| `secondPlaceScore` | number | ✅ | ✅ | 2nd place tap count |
| `buyIn` | number | ✅ | ❌ | Buy-in amount (Lamports or MNY base units) |
| `buyInCurrency` | string | ✅ | ❌ | Currency: `SOL` \| `MNY` |
| `gameType` | string | ❌ | ❌ | Game variant (future use) |
| `tarobase_created_at` | number | ✅ (system) | ❌ | On-chain creation timestamp |
| `tarobase_transaction_hash` | string | ❌ (system) | ❌ | Solana transaction hash |

**State Transitions:**

```
waiting (all 4 players present)
    ↓ (startGame hook)
playing (10 second timer)
    ↓ (timer expires + submissions collected)
resolved (winner determined, payout sent)
```

**Creation Hook:**
- Creates per-game escrow PDA via `@AccountPlugin.createAccount($gameId)`
- Transfers buy-in from creator to escrow (SOL or MNY)
- Ensures SPIN_POOL_ID exists (for MNY games)

**Resolve Hook:**
- Reads all gameSubmissions for this game
- Ranks players by tap count (tiebreaker: submission time)
- Sets winner + secondPlace
- Triggers payout from escrow to winner + fee pool
- Sets state = `resolved`

**Example:**

```json
{
  "id": "game_1234567890_abc123",
  "creator": "DCR1Q...",
  "player2": "3z3z9...",
  "player3": "5k4k2...",
  "player4": "9m8m1...",
  "playerCount": 4,
  "state": "resolved",
  "createdAt": 1234567890,
  "startedAt": 1234567910,
  "winner": "DCR1Q...",
  "secondPlace": "3z3z9...",
  "winnerScore": 512,
  "secondPlaceScore": 487,
  "buyIn": 10000000,
  "buyInCurrency": "SOL",
  "tarobase_created_at": 1234567890123
}
```

---

### 2. Game Submissions

**Path:** `gameSubmissions/{submissionId}`

**Purpose:** Individual player's tap count submission for a game

**Document Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique submission ID |
| `gameId` | string | ✅ | Reference to games/{gameId} |
| `player` | Address | ✅ | Player's wallet address |
| `tapCount` | number | ✅ | Number of taps (1-10000+) |
| `submittedAt` | number | ✅ | Submission timestamp (Unix seconds) |

**Creation:**
- Player submits tap count after game timer expires
- Created by user-initiated transaction
- Multiple submissions per player overwrite previous

**Example:**

```json
{
  "id": "sub_game_1234567890_abc123_player_DCR1Q",
  "gameId": "game_1234567890_abc123",
  "player": "DCR1Q...",
  "tapCount": 512,
  "submittedAt": 1234567920
}
```

---

### 3. CoinFlip Matches

**Path:** `coinFlipMatches/{matchId}`

**Purpose:** 1v1 coin flip match with VRF-based randomness

**Document Structure:**

| Field | Type | Required | Mutable | Description |
|-------|------|----------|---------|-------------|
| `id` | string | ✅ | ❌ | Unique match ID |
| `creator` | Address | ✅ | ❌ | Match creator (player 1) |
| `opponent` | Address | ❌ | ✅ | Opponent wallet (set on join) |
| `tier` | number | ✅ | ❌ | Tier 1, 2, or 3 |
| `buyIn` | number | ✅ | ❌ | Buy-in amount (Lamports or MNY) |
| `state` | string | ✅ | ✅ | `waiting` \| `resolved` \| `cancelled` |
| `winner` | Address | ❌ | ✅ | Winner wallet (set on resolve) |
| `ts` | number | ✅ | ❌ | Creation timestamp (Unix seconds) |
| `buyInCurrency` | string | ✅ | ❌ | `SOL` \| `MNY` |
| `tarobase_created_at` | number | ✅ (system) | ❌ | On-chain timestamp |

**Tier Mapping (SOL):**

| Tier | Buy-in | Prize Pool |
|------|--------|-----------|
| 1 | 0.01 SOL (10M lamports) | 0.0199 SOL |
| 2 | 0.05 SOL (50M lamports) | 0.0995 SOL |
| 3 | 0.1 SOL (100M lamports) | 0.199 SOL |

**State Transitions:**

```
waiting (creator joined)
    ↓ (opponent joins + VRF requested)
resolved (winner determined, payout sent)

OR

waiting (no opponent within 10 minutes)
    ↓ (auto-cancel heartbeat)
cancelled (creator refunded)
```

**Creation Hook:**
- Creates per-match escrow PDA
- Transfers buy-in from creator to escrow

**Join Hook:**
- Transfers matching buy-in from opponent to escrow
- Requests VRF randomness from oracle
- Sets opponent wallet

**Resolve Hook:**
- Sets state = `resolved`
- Winner determined by VRF result
- 99% of pot to winner, 1% to fee pool
- Transfers funds from escrow

**Example:**

```json
{
  "id": "match_coinflip_1234567890_xyz",
  "creator": "DCR1Q...",
  "opponent": "9m8m1...",
  "tier": 2,
  "buyIn": 50000000,
  "state": "resolved",
  "winner": "DCR1Q...",
  "ts": 1234567890,
  "buyInCurrency": "SOL",
  "tarobase_created_at": 1234567890123
}
```

---

### 4. RPS Matches

**Path:** `rpsMatches/{matchId}`

**Purpose:** 1v1 Rock Paper Scissors best-of-3

**Document Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique match ID |
| `creator` | Address | ✅ | Match creator (player 1) |
| `opponent` | Address | ✅ | Opponent wallet |
| `buyInLamports` | number | ✅ | Buy-in amount (SOL or MNY base units) |
| `status` | string | ✅ | `waiting` \| `active` \| `complete` \| `abandoned` |
| `creatorWins` | number | ✅ | Creator's round wins (0-2) |
| `opponentWins` | number | ✅ | Opponent's round wins (0-2) |
| `currentRound` | number | ✅ | Current round number (1-3) |
| `winner` | Address | ❌ | Winner wallet (on complete) |
| `createdAt` | number | ✅ | Creation timestamp |
| `buyInCurrency` | string | ✅ | `SOL` \| `MNY` |
| `lastActivityAt` | number | ✅ | Last update timestamp (for timeout) |
| `tarobase_created_at` | number | ✅ (system) | On-chain timestamp |

**Rounds Subcollection:**

**Path:** `rpsMatches/{matchId}/rounds/{roundNumber}`

| Field | Type | Description |
|-------|------|-------------|
| `round` | number | Round number (1-3) |
| `creatorCommit` | string | SHA-256 hash of creator's move + salt |
| `creatorReveal` | string | Revealed move: `rock` \| `paper` \| `scissors` |
| `opponentCommit` | string | SHA-256 hash of opponent's move + salt |
| `opponentReveal` | string | Revealed move |
| `winner` | string | Round winner: `creator` \| `opponent` \| `draw` |
| `createdAt` | number | Timestamp |

**Commit-Reveal Flow:**

```
Round 1:
  1. Both players commit SHA-256(move + salt) [5 second window]
  2. Both players reveal move + salt [5 second window]
  3. Server validates hash, determines round winner
  
Repeat Rounds 2-3
  
Best of 3: First to 2 round wins
```

**Timeout:** 
- If no activity for `RPS_ABANDON_TIMEOUT_SECONDS` (600s)
- Any user can transition to `abandoned`
- Both players refunded

**Example:**

```json
{
  "id": "match_rps_1234567890_abc",
  "creator": "DCR1Q...",
  "opponent": "9m8m1...",
  "buyInLamports": 10000000,
  "status": "complete",
  "creatorWins": 2,
  "opponentWins": 1,
  "currentRound": 3,
  "winner": "DCR1Q...",
  "createdAt": 1234567890,
  "buyInCurrency": "SOL",
  "lastActivityAt": 1234567920
}
```

---

### 5. FlashTap Matches

**Path:** `flashMatches/{matchId}`

**Purpose:** 4-player reaction time game state

**Document Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique match ID |
| `creator` | Address | ✅ | Match creator |
| `player2` | Address | ❌ | Player 2 wallet |
| `player3` | Address | ❌ | Player 3 wallet |
| `player4` | Address | ❌ | Player 4 wallet |
| `state` | string | ✅ | `waiting` \| `playing` \| `resolved` |
| `flashMomentMs` | number | ❌ | Server time when flash triggers (ms) |
| `createdAt` | number | ✅ | Creation timestamp |
| `startedAt` | number | ❌ | Game start timestamp |
| `winner` | Address | ❌ | Fastest reactor |
| `secondPlace` | Address | ❌ | Second fastest |

**Join Flow:**
- Players join via flashMatchJoins collection
- When 4 players present, state → `playing`

**Tap Recording:**
- Each tap recorded in flashMatchTaps
- Reaction time = tap time - flashMomentMs

**Example:**

```json
{
  "id": "match_flashtap_1234567890_xyz",
  "creator": "DCR1Q...",
  "player2": "3z3z9...",
  "player3": "5k4k2...",
  "player4": "9m8m1...",
  "state": "resolved",
  "flashMomentMs": 1234567000,
  "createdAt": 1234567890,
  "startedAt": 1234567900,
  "winner": "DCR1Q...",
  "secondPlace": "3z3z9..."
}
```

---

### 6. Flash Match Taps

**Path:** `flashMatchTaps/{tapId}`

**Purpose:** Individual reaction time tap record

**Document Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique tap ID |
| `matchId` | string | ✅ | Reference to flashMatches/{matchId} |
| `player` | Address | ✅ | Player who tapped |
| `tapTime` | number | ✅ | Server time of tap (ms) |
| `reactionTime` | number | ✅ | Calculated time from flash moment |

**Example:**

```json
{
  "id": "tap_match_xyz_player_DCR1Q",
  "matchId": "match_flashtap_1234567890_xyz",
  "player": "DCR1Q...",
  "tapTime": 1234567145,
  "reactionTime": 145
}
```

---

### 7. Daily Spins

**Path:** `dailySpins/{spinId}`

**Purpose:** User's daily spin history record

**Document Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique spin ID |
| `spinnerAddress` | Address | ✅ | User's wallet address |
| `prizeAmount` | number | ✅ | Prize won (0-10 MNY) |
| `createdAt` | number | ✅ | Spin timestamp |

**Cooldown:** 24 hours per user (enforced by API)

**Example:**

```json
{
  "id": "spin_20260529_DCR1Q_abc123",
  "spinnerAddress": "DCR1Q...",
  "prizeAmount": 1,
  "createdAt": 1234567890
}
```

---

### 8. Daily Spin Pool

**Path:** `dailySpinPool/main`

**Purpose:** Global MNY prize pool balance (single document)

**Document Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Always `main` |
| `balance` | number | ✅ | Current MNY balance (base units, 1e6 = 1 MNY) |
| `updatedAt` | number | ✅ | Last update timestamp |

**Operations:**
- Decremented each spin (prize awarded)
- Incremented by admin seeding (setSeedSpinPool)

**Example:**

```json
{
  "id": "main",
  "balance": 98765432100,
  "updatedAt": 1234567890
}
```

---

### 9. MNY Stakes

**Path:** `mnyStakes/{walletAddress}`

**Purpose:** User's staked MNY and fee-pool eligibility

**Document Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Wallet address (doc ID) |
| `stakerAddress` | Address | ✅ | Wallet address (data) |
| `amountStaked` | number | ✅ | Total staked amount (base units, 1e6 = 1 MNY) |
| `stakedAt` | number | ✅ | Last stake timestamp |
| `unstakedAt` | number | ❌ | Last unstake timestamp |

**Fee Distribution:**
- Hourly heartbeat snapshots stakers with `amountStaked > 0`
- Pro-rata SOL distribution from fee pool

**Example:**

```json
{
  "id": "DCR1Q...",
  "stakerAddress": "DCR1Q...",
  "amountStaked": 500000000,
  "stakedAt": 1234567890,
  "unstakedAt": 0
}
```

---

### 10. Fee Pool Distributions

**Path:** `feePoolDistributions/{distributionId}`

**Purpose:** Hourly fee-pool distribution record

**Document Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Distribution ID (format: `{epochHour}_{stakerAddress}`) |
| `stakerAddress` | Address | ✅ | Staker receiving distribution |
| `amountDistributed` | number | ✅ | SOL transferred (Lamports) |
| `epochHour` | number | ✅ | Hour epoch when distributed |
| `distributedAt` | number | ✅ | Timestamp of distribution |

**Idempotency:** Document ID includes epoch hour, so same hour/staker never duplicates

**Example:**

```json
{
  "id": "342000_DCR1Q...",
  "stakerAddress": "DCR1Q...",
  "amountDistributed": 5000000,
  "epochHour": 342000,
  "distributedAt": 1234567890
}
```

---

### 11. Token Unlocks

**Path:** `tokenUnlocks/{milestoneId}`

**Purpose:** Tracks token unlock milestone states

**Document Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Milestone ID (e.g., `second-sale`) |
| `label` | string | ✅ | Human-readable name |
| `totalAmount` | number | ✅ | MNY amount unlocked (base units) |
| `unlockedAt` | number | ❌ | Unlock timestamp (null if pending) |
| `index` | number | ✅ | Milestone order (1, 2, 3) |

**Milestones:**

1. **Second Sale** → Unlocks 200k MNY to Ecosystem Reserve
2. **Special Prizes Part 2** → Unlocks 200k MNY to Ecosystem Reserve
3. **Final Sale** → Unlocks 200k MNY to Ecosystem Reserve

Each unlock also increases Dev Stake by 100k MNY.

**Example:**

```json
{
  "id": "second-sale",
  "label": "Second Sale",
  "totalAmount": 200000000000,
  "unlockedAt": 1234567890,
  "index": 1
}
```

---

### 12. Users

**Path:** `users/{walletAddress}`

**Purpose:** User profile and settings

**Document Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Wallet address (doc ID) |
| `address` | Address | ✅ | Wallet address (data) |
| `username` | string | ❌ | Display name (optional) |
| `createdAt` | number | ✅ | Account creation timestamp |
| `lastSeenAt` | number | ✅ | Last activity timestamp |

**Example:**

```json
{
  "id": "DCR1Q...",
  "address": "DCR1Q...",
  "username": "tapmaster_123",
  "createdAt": 1234567890,
  "lastSeenAt": 1234567999
}
```

---

### 13. TPR Token

**Path:** `tprToken/pppToken`

**Purpose:** Token mint metadata (single document)

**Document Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Always `pppToken` |
| `mint` | string | ✅ | Token mint address |
| `supply` | number | ✅ | Total supply (base units) |
| `decimals` | number | ✅ | Decimal places (6) |
| `name` | string | ✅ | Token name (MNY) |

**Example:**

```json
{
  "id": "pppToken",
  "mint": "pppTokenMintAddress...",
  "supply": 1000000000000,
  "decimals": 6,
  "name": "MNY"
}
```

---

## Query Patterns

### Get User's Games

```typescript
import { getMany } from '@/lib/db-client';

const games = await getMany('games', 'creator = @address', {
  address: userWalletAddress
});
```

### Get All Active Stakers

```typescript
const stakers = await getMany('mnyStakes', 'amountStaked > 0');
```

### Get User's Spin History

```typescript
const spins = await getMany('dailySpins', 'spinnerAddress = @address', {
  address: userWalletAddress
});
```

### Get Last Spin (for cooldown check)

```typescript
const lastSpin = await getMany('dailySpins', 
  'spinnerAddress = @address',
  { address: userWalletAddress, limit: 1, orderBy: 'createdAt DESC' }
);
```

### Get All Unresolved Matches

```typescript
const waiting = await getMany('coinFlipMatches', 'state = @state', {
  state: 'waiting'
});
```

---

## Subscriptions (Real-Time)

### Subscribe to Game State

```typescript
import { subscribe } from '@/lib/db-client';

const unsub = subscribe(`games/{gameId}`, (data) => {
  console.log('Game updated:', data);
});
```

### Subscribe to All User's Games

```typescript
const unsub = subscribe(
  'games',
  (games) => { console.log(games); },
  `creator = @address`,
  { address: userWalletAddress }
);
```

### Subscribe to Spin Pool

```typescript
const unsub = subscribe('dailySpinPool/main', (pool) => {
  console.log('Pool balance:', pool.balance);
});
```

---

## Access Control

### Public (Anyone)

- `read` games, coinFlipMatches, rpsMatches (list/get)
- `read` dailySpinPool, tokenUnlocks
- `read` users (public profiles)

### Owner (User's own data)

- `read`/`write` own gameSubmissions
- `read`/`write` own mnyStakes
- `read`/`write` own dailySpins
- `read` own rpsMatches, coinFlipMatches

### Vault (Backend signature)

- `write` state transitions (games → resolved)
- `write` winner fields
- `write` match resolutions
- `transfer` SOL/MNY (on-chain hooks)

### Admin

- `write` tokenUnlocks (milestone unlocks)
- `write` dailySpinPool (seeding)
- `read` all collections (audit)

---

## Indexing & Performance

### Recommended Indexes

```typescript
// High-traffic queries
{ collection: 'games', fields: ['state', 'creator'] }
{ collection: 'coinFlipMatches', fields: ['state', 'creator'] }
{ collection: 'rpsMatches', fields: ['status', 'creator'] }
{ collection: 'dailySpins', fields: ['spinnerAddress', 'createdAt'] }
{ collection: 'mnyStakes', fields: ['amountStaked'] }

// Sorting/filtering
{ collection: 'games', fields: ['createdAt'] }
{ collection: 'dailySpins', fields: ['createdAt DESC'] }
```

---

## Data Types

### Address

Solana wallet address (Base58 string):
- 44 characters
- Example: `DCR1Q...` (truncated)

### Number

- **Lamports** (SOL): 1 SOL = 1,000,000,000 Lamports
- **MNY Base Units** (Token): 1 MNY = 1,000,000 base units (decimals: 6)
- **Unix Timestamp** (seconds or milliseconds): Depends on field

### String

UTF-8 JSON strings (max length varies by field)

---

## Size Estimates

### Per-Game Storage

- Game document: ~500 bytes
- 4 submissions: 4 × 200 bytes = 800 bytes
- Total: ~1.3 KB

### Per-Match Storage (CoinFlip/RPS)

- Match document: ~400 bytes
- RPS with 3 rounds: 3 × 300 bytes = 900 bytes additional
- Total: ~1.3 KB

### For 1,000 Daily Active Users

- 100 active games: 130 KB
- 50 active matches: 65 KB
- User profiles: ~100 KB
- Spins (30-day history): ~100 KB
- Stakes: ~30 KB
- Distributions (30 days): ~300 KB
- **Total:** ~725 KB (negligible for on-chain storage)

---

## Data Retention

| Collection | Retention | Rationale |
|------------|-----------|-----------|
| games | Permanent | Match history, audit trail |
| gameSubmissions | Permanent | Scores, leaderboards |
| coinFlipMatches | Permanent | Settlement verification |
| rpsMatches | Permanent | Dispute resolution |
| dailySpins | Permanent | Payout history |
| mnyStakes | Permanent | Stake audit trail |
| feePoolDistributions | Permanent | Distribution history |
| tokenUnlocks | Permanent | Unlock audit trail |
| users | Permanent | Profile history |

**Backup Strategy:**
- Tarobase is immutable (on Solana)
- Snapshots exported weekly to off-chain storage
- No manual pruning needed

---

## Migration Notes

### From V1 to V2

If upgrading from a previous version:

1. **New collections** (create):
   - flashMatches, flashMatchJoins, flashMatchTaps
   - mnyStakes, feePoolDistributions
   - tokenUnlocks, tokenUnlockStats

2. **Modified collections** (schema changes):
   - games: Added `gameType`, changed prize structure
   - coinFlipMatches: Added `buyInCurrency`
   - rpsMatches: Added `lastActivityAt`

3. **Data migration** (contact Poof Cloud):
   - Export V1 data
   - Transform to V2 schema
   - Import to V2 database

---

## Troubleshooting

### Collection Not Found

**Symptom:** `Error: Collection 'games' not found`

**Cause:** Collection auto-generated SDK might be out of sync

**Fix:**
```bash
# Regenerate SDK
poof generate-sdk

# Reinitialize
bun install
bun run check
```

### Stale Data

**Symptom:** Frontend shows old data, changes don't reflect

**Cause:** Subscription not re-subscribed on mount

**Fix:**
```typescript
useEffect(() => {
  // Re-subscribe on dependency change
  const unsub = subscribe(...);
  return unsub; // cleanup
}, [dependencies]);
```

### Data Inconsistency

**Symptom:** Winner field empty but state = `resolved`

**Cause:** Hook execution failed during resolve

**Fix:**
1. Check backend logs for hook errors
2. Manually trigger resolve again (idempotent)
3. Contact Poof Cloud support if persistent

---

## Tools & Commands

```bash
# View collection schema
poof describe games

# Query data
poof query games --where "state = 'waiting'"

# Export all data (backup)
poof export games > games_backup.json

# Monitor writes
poof tail games

# Check indexes
poof indexes list
```
