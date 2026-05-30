/**
 * API Routes - Register all routes here.
 *
 * Two things to do when adding a route:
 * 1. Register the handler with app.get/post/put/delete/patch
 * 2. Add an entry to routeSpec[] so the API spec is generated for the platform
 *
 * For protected routes, use validateWalletAuth:
 *   import { validateWalletAuth, validateAdminAuth } from '../lib/wallet-auth.js';
 *   const { walletAddress } = await validateWalletAuth(c);
 *   const { walletAddress } = await validateAdminAuth(c); // For admin routes
 */

import type { Hono } from 'hono';
import { sendSuccess, ApiErrors } from '../lib/api-response.js';
import { validateWalletAuth } from '../lib/wallet-auth.js';
import { getGames, setGames } from '../collections/games.js';
import { getManyGameSubmissionsPlayers } from '../collections/gameSubmissions.js';
import { getFlashMatches, updateFlashMatches } from '../collections/flashMatches.js';
import { getManyFlashMatchJoinsPlayers } from '../collections/flashMatchJoins.js';
import { getManyFlashMatchTapsPlayers } from '../collections/flashMatchTaps.js';
import { getDailySpins, setDailySpins } from '../collections/dailySpins.js';
import { getDailySpinPool, setDailySpinPool } from '../collections/dailySpinPool.js';
import { setSpinPayouts } from '../collections/spinPayouts.js';
import { getCoinFlipMatches, updateCoinFlipMatches } from '../collections/coinFlipMatches.js';

// OAuth Routes (uncomment to enable social login)
// See: .claude/skills/oauth/SKILL.md for setup instructions
// import { oauthCallbackHandler } from './oauth-callback.js';
// import { getSocialLinkHandler, deleteSocialLinkHandler } from './social-links.js';

/**
 * Route spec for API documentation/display.
 * Keep this in sync with the actual route registrations below.
 */
export interface RouteSpec {
  method: string;
  path: string;
  description: string;
  auth: boolean;
}

export const routeSpec: RouteSpec[] = [
  { method: 'GET', path: '/health', description: 'Health check', auth: false },
  // OAuth routes (uncomment when enabled):
  // { method: 'GET', path: '/api/oauth/callback', description: 'OAuth callback', auth: false },
  // { method: 'GET', path: '/api/social-links/:provider', description: 'Get social link', auth: true },
  // { method: 'DELETE', path: '/api/social-links/:provider', description: 'Unlink social account', auth: true },

  { method: 'POST', path: '/api/games/:gameId/finalize', description: 'Finalize a game: compute winner from submissions, resolve on-chain payout', auth: true },
  { method: 'POST', path: '/api/flashtap/:matchId/start', description: 'Start a FlashTap match: set flashMomentMs and transition to playing', auth: true },
  { method: 'POST', path: '/api/flashtap/:matchId/resolve', description: 'Resolve a FlashTap match: determine winner by closest reaction time', auth: true },
  { method: 'POST', path: '/api/daily-spin', description: 'Perform a daily spin: check cooldown, pick weighted prize, update records and pool', auth: true },
  { method: 'POST', path: '/api/coinflip/resolve', description: 'Resolve a coinflip match: deterministic winner, vault-signed payout', auth: true },
];

export function registerRoutes(app: Hono): void {
  // Health check
  app.get('/health', (c) => sendSuccess(c, { status: 'ok', timestamp: Date.now() }));

  // OAuth routes (uncomment to enable):
  // app.get('/api/oauth/callback', oauthCallbackHandler);
  // app.get('/api/social-links/:provider', getSocialLinkHandler);
  // app.delete('/api/social-links/:provider', deleteSocialLinkHandler);

  // POST /api/games/:gameId/finalize
  // Called by any player after submitting tap count. Reads all submissions,
  // determines winner + 2nd place, then sets game state='resolved' as vault.
  // The vault signature triggers the on-chain payout in the policy hook.
  app.post('/api/games/:gameId/finalize', async (c) => {
    await validateWalletAuth(c);

    const gameId = c.req.param('gameId');
    if (!gameId) {
      return ApiErrors.badRequest(c, 'Missing gameId');
    }

    // 1. Read the game
    const game = await getGames(gameId);
    if (!game) {
      return ApiErrors.notFound(c, 'Game not found');
    }

    // 2. Already resolved — return existing result (idempotent)
    if (game.state === 'resolved') {
      return sendSuccess(c, {
        winner: game.winner,
        secondPlace: game.secondPlace,
        winnerScore: game.winnerScore,
        secondPlaceScore: game.secondPlaceScore,
      });
    }

    // 3. Game not in playing state
    if (game.state !== 'playing') {
      return ApiErrors.badRequest(c, 'Game not ready — state must be "playing"');
    }

    // 4. Read submissions for this game
    const submissions = await getManyGameSubmissionsPlayers(gameId);

    // 5. Determine actual players
    const playerAddresses = [game.creator, game.player2, game.player3, game.player4].filter(
      Boolean
    ) as string[];

    // Filter submissions to only game players
    const validSubmissions = submissions.filter((s) => playerAddresses.includes(s.player));

    const nowSec = Date.now() / 1000;
    const elapsed = nowSec - (game.startedAt as number);
    const GRACE_PERIOD = 15; // seconds after game ends to wait for late submissions

    // 6. Wait if < 15s elapsed and not all submitted
    if (validSubmissions.length < 4 && elapsed < GRACE_PERIOD) {
      return ApiErrors.badRequest(
        c,
        `Waiting for submissions — ${validSubmissions.length}/4 received, ${Math.ceil(GRACE_PERIOD - elapsed)}s remaining`
      );
    }

    // 7. Build score map — missing submissions get 0 taps
    const scoreMap = new Map<string, { tapCount: number; submittedAt: number }>();
    for (const sub of validSubmissions) {
      scoreMap.set(sub.player, { tapCount: sub.tapCount, submittedAt: sub.submittedAt });
    }

    const ranked = playerAddresses.map((addr) => ({
      address: addr,
      tapCount: scoreMap.get(addr)?.tapCount ?? 0,
      submittedAt: scoreMap.get(addr)?.submittedAt ?? Number.MAX_SAFE_INTEGER,
    }));

    // Sort: highest taps first, then earliest submission as tiebreaker
    ranked.sort((a, b) => {
      if (b.tapCount !== a.tapCount) return b.tapCount - a.tapCount;
      return a.submittedAt - b.submittedAt;
    });

    const winner = ranked[0]?.address;
    const secondPlace = ranked[1]?.address;
    const winnerScore = ranked[0]?.tapCount ?? 0;
    const secondPlaceScore = ranked[1]?.tapCount ?? 0;

    if (!winner || !secondPlace) {
      return ApiErrors.internal(c, 'Could not determine winner — not enough players');
    }

    // 8. Set resolved state as vault (triggers on-chain payout hook)
    const success = await setGames(gameId, {
      creator: game.creator,
      player2: game.player2 ? game.player2 : undefined,
      player3: game.player3 ? game.player3 : undefined,
      player4: game.player4 ? game.player4 : undefined,
      playerCount: game.playerCount,
      state: 'resolved',
      createdAt: game.createdAt,
      startedAt: game.startedAt,
      winner: winner,
      secondPlace: secondPlace,
      winnerScore,
      secondPlaceScore,
      buyIn: (game as any).buyIn,
    } as any);

    if (!success) {
      return ApiErrors.internal(c, 'Failed to resolve game — vault write denied');
    }

    return sendSuccess(c, { winner, secondPlace, winnerScore, secondPlaceScore });
  });

  // POST /api/flashtap/:matchId/start
  // Called by the first player to request match start once all 4 players are in.
  // Backend picks a random flashMomentMs in the next 3–8 seconds and transitions to 'playing'.
  app.post('/api/flashtap/:matchId/start', async (c) => {
    await validateWalletAuth(c);

    const matchId = c.req.param('matchId');
    if (!matchId) return ApiErrors.badRequest(c, 'Missing matchId');

    const match = await getFlashMatches(matchId);
    if (!match) return ApiErrors.notFound(c, 'Match not found');

    if (match.state === 'playing') {
      return sendSuccess(c, { flashMomentMs: match.flashMomentMs });
    }

    if (match.state !== 'waiting') {
      return ApiErrors.badRequest(c, `Match not in waiting state (current: ${match.state})`);
    }

    if ((match.playerCount as number) < 4) {
      return ApiErrors.badRequest(c, `Not enough players (${match.playerCount}/4)`);
    }

    // Pick a random flash moment 3–8 seconds from now
    const delayMs = 3000 + Math.floor(Math.random() * 5000);
    const flashMomentMs = Date.now() + delayMs;

    const success = await updateFlashMatches(matchId, {
      creator: match.creator),
      playerCount: match.playerCount,
      state: 'playing',
      flashMomentMs,
      winnerDeltaMs: 0,
      ts: match.ts,
      buyIn: (match as any).buyIn,
    } as any);

    if (!success) return ApiErrors.internal(c, 'Failed to start match — vault write denied');

    return sendSuccess(c, { flashMomentMs });
  });

  // POST /api/flashtap/:matchId/resolve
  // Called by any player after tapping. Reads all tap submissions, finds the
  // player closest to flashMomentMs, and transitions to 'resolved'.
  app.post('/api/flashtap/:matchId/resolve', async (c) => {
    await validateWalletAuth(c);

    const matchId = c.req.param('matchId');
    if (!matchId) return ApiErrors.badRequest(c, 'Missing matchId');

    const match = await getFlashMatches(matchId);
    if (!match) return ApiErrors.notFound(c, 'Match not found');

    if (match.state === 'resolved') {
      return sendSuccess(c, { winner: match.winner, winnerDeltaMs: match.winnerDeltaMs });
    }

    if (match.state !== 'playing') {
      return ApiErrors.badRequest(c, `Match not in playing state (current: ${match.state})`);
    }

    const flashMomentMs = match.flashMomentMs as number;
    const now = Date.now();

    // Allow 30 seconds from flash moment before resolving anyway
    const GRACE_PERIOD_MS = 30_000;
    if (now < flashMomentMs + GRACE_PERIOD_MS) {
      // Check if all players have submitted taps already
      const joinedPlayers = await getManyFlashMatchJoinsPlayers(matchId);
      const allAddresses = [match.creator, ...joinedPlayers.map((p) => p.player)];
      const taps = await getManyFlashMatchTapsPlayers(matchId);

      const submittedAddresses = taps.map((t) => t.player);
      const allSubmitted = allAddresses.every((addr) => submittedAddresses.includes(addr));

      if (!allSubmitted) {
        return ApiErrors.badRequest(c, `Waiting for all taps (${taps.length}/${allAddresses.length} received)`);
      }
    }

    // Read taps
    const joinedPlayers = await getManyFlashMatchJoinsPlayers(matchId);
    const allAddresses = [match.creator, ...joinedPlayers.map((p) => p.player)];
    const taps = await getManyFlashMatchTapsPlayers(matchId);

    // Find winner and 2nd place: minimum |tapTimeMs - flashMomentMs|
    let winner: string | null = null;
    let winnerDeltaMs = Number.MAX_SAFE_INTEGER;
    let secondPlace: string | null = null;
    let secondPlaceDelta = Number.MAX_SAFE_INTEGER;

    for (const addr of allAddresses) {
      const tap = taps.find((t) => t.player === addr);
      if (!tap) continue;
      const delta = Math.abs((tap.tapTimeMs as number) - flashMomentMs);
      if (delta < winnerDeltaMs) {
        secondPlaceDelta = winnerDeltaMs;
        secondPlace = winner;
        winnerDeltaMs = delta;
        winner = addr;
      } else if (delta < secondPlaceDelta) {
        secondPlaceDelta = delta;
        secondPlace = addr;
      }
    }

    if (!winner) {
      return ApiErrors.internal(c, 'Could not determine winner — no taps received');
    }

    const success = await updateFlashMatches(matchId, {
      creator: match.creator),
      playerCount: match.playerCount,
      state: 'resolved',
      flashMomentMs,
      winner: winner,
      winnerDeltaMs,
      secondPlace: secondPlace ? secondPlace) : undefined,
      secondPlaceDeltaMs: secondPlaceDelta === Number.MAX_SAFE_INTEGER ? 0 : secondPlaceDelta,
      ts: match.ts,
      buyIn: (match as any).buyIn,
    } as any);

    if (!success) return ApiErrors.internal(c, 'Failed to resolve match — vault write denied');

    return sendSuccess(c, { winner, winnerDeltaMs });
  });

  // POST /api/daily-spin
  // Performs a daily spin with cooldown check, weighted prize selection,
  // and updates both the user's spin record and the global spin pool.
  //
  // Race-condition guard: we write lastSpinAt = nowTs as the VERY FIRST write
  // before touching the pool or creating a payout record. Because Tarobase
  // writes are atomic per-document and the cooldown check reads the same
  // document, a second concurrent request will either:
  //   (a) see the first request's lastSpinAt on its read (hits cooldown check), or
  //   (b) collide on the write — setDailySpins returns false (policy denied),
  //       which we treat as "already spinning" and reject cleanly.
  app.post('/api/daily-spin', async (c) => {
    const { walletAddress } = await validateWalletAuth(c);
    const nowTs = Math.floor(Date.now() / 1000);

    // 1. Read user's spin record
    const spinRecord = await getDailySpins(walletAddress);

    // 2. Check cooldown
    if (spinRecord?.lastSpinAt && nowTs - spinRecord.lastSpinAt < 86400) {
      return ApiErrors.badRequest(c, 'Daily spin already used. Come back tomorrow!');
    }

    // 3. Weighted prize selection
    const r = Math.random();
    let prize = 0;
    if (r < 0.40) {
      prize = 0;
    } else if (r < 0.70) {
      prize = 0.1;
    } else if (r < 0.90) {
      prize = 0.5;
    } else if (r < 0.99) {
      prize = 1;
    } else if (r < 0.999) {
      prize = 5;
    } else {
      prize = 10;
    }

    const prizeBaseUnits = Math.round(prize * 1_000_000);

    // 4. Write user's spin record FIRST (race-condition lock).
    //    If two concurrent requests pass the cooldown check above, only one
    //    will succeed here — the second will be denied by the policy
    //    (lastSpinAt was just set within the 24 h window) and we return 400.
    const currentTotal = spinRecord?.totalWon ?? 0;
    const userSuccess = await setDailySpins(walletAddress, {
      lastSpinAt: nowTs,
      totalWon: currentTotal + prizeBaseUnits,
    });
    if (!userSuccess) {
      return ApiErrors.badRequest(c, 'Spin already in progress. Please try again.');
    }

    // 5. Update global spin pool
    const pool = await getDailySpinPool('main');
    if (pool) {
      const poolSuccess = await setDailySpinPool('main', {
        balance: Math.max(0, pool.balance - prizeBaseUnits),
        totalDistributed: pool.totalDistributed + prizeBaseUnits,
          ts: nowTs,
      });
      if (!poolSuccess) {
        return ApiErrors.internal(c, 'Failed to update spin pool');
      }
    }

    // 6. Create on-chain spin payout record (triggers MNY token transfer hook)
    if (prizeBaseUnits > 0) {
      const payoutId = `spin_${nowTs}_${walletAddress.slice(0, 8)}`;
      const payoutSuccess = await setSpinPayouts(payoutId, {
        recipient: walletAddress),
        amount: prizeBaseUnits,
        ts: nowTs,
      });
      if (!payoutSuccess) {
        console.error(`Spin payout failed for ${walletAddress}, prize ${prizeBaseUnits}`);
        // Don't fail the whole request — user already got their spin recorded
      }
    }

    // 7. Return prize in human units
    return sendSuccess(c, { prize });
  });

  // POST /api/coinflip/resolve
  // Called by any authenticated player when both players are present and the match
  // is still in 'waiting' state. The backend signs as PROJECT_VAULT_ADDRESS and
  // deterministically resolves the match (picking winner by hash of matchId).
  app.post('/api/coinflip/resolve', async (c) => {
    await validateWalletAuth(c);

    const body = await c.req.json();
    const matchId = body?.matchId;
    if (!matchId || typeof matchId !== 'string') {
      return ApiErrors.badRequest(c, 'Missing or invalid matchId');
    }

    const match = await getCoinFlipMatches(matchId);
    if (!match) {
      return ApiErrors.notFound(c, 'Match not found');
    }

    if (match.state === 'resolved') {
      return sendSuccess(c, { winner: match.winner, resolved: true });
    }

    if (match.state !== 'waiting') {
      return ApiErrors.badRequest(c, `Match not in waiting state (current: ${match.state})`);
    }

    if (!match.opponent) {
      return ApiErrors.badRequest(c, 'Match has no opponent yet');
    }

    // Deterministic winner: FNV-style hash of full matchId → creator or opponent
    // Using all characters prevents the outcome from being predicted by crafting
    // a match ID with a specific first character.
    let hashVal = 2166136261; // FNV-1a 32-bit offset basis
    for (let i = 0; i < match.id.length; i++) {
      hashVal ^= match.id.charCodeAt(i);
      hashVal = (hashVal * 16777619) >>> 0; // FNV prime, keep 32-bit unsigned
    }
    const winner = hashVal % 2 === 0 ? match.creator : match.opponent;

    const success = await updateCoinFlipMatches(matchId, {
      state: 'resolved',
      winner: winner,
      creator: match.creator),
      opponent: match.opponent),
      tier: match.tier,
      buyIn: match.buyIn,
      ts: match.ts,
      buyInCurrency: match.buyInCurrency,
    });

    if (!success) {
      return ApiErrors.internal(c, 'Failed to resolve match — vault write denied');
    }

    return sendSuccess(c, { winner, resolved: true });
  });
}
