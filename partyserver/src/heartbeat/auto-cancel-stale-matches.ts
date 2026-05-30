/**
 * Heartbeat task: auto-cancel-stale-matches
 *
 * Runs every 2 minutes. Finds stale 'waiting' matches across all three game types
 * (coinFlipMatches, flashMatches, games) that are older than 10 minutes with no
 * opponent/other players joined, then cancels them by writing state='cancelled'.
 *
 * - coinFlipMatches: uses 'ts' timestamp field, checks opponent == null
 * - flashMatches:    uses 'ts' timestamp field, checks playerCount == 1
 * - games:           uses 'createdAt' timestamp field, checks playerCount == 1
 *
 * The policy's cancellation hook refunds the buy-in from the escrow PDA back to
 * the creator. This task runs as PROJECT_VAULT_ADDRESS, which the policy allows
 * to perform cancellation transitions on all three collections.
 */

import { getManyCoinFlipMatches, updateCoinFlipMatches } from '../collections/coinFlipMatches.js';
import { getManyFlashMatches, updateFlashMatches } from '../collections/flashMatches.js';
import { getManyGames, updateGames } from '../collections/games.js';

const STALE_TIMEOUT_SECONDS = 600; // 10 minutes

export async function autoCancelStaleMatches(): Promise<void> {
  console.log('[auto-cancel-stale-matches] Starting stale match check (coinFlip + flashTap + tapWars)...');

  const nowSeconds = Math.floor(Date.now() / 1000);
  const cutoff = nowSeconds - STALE_TIMEOUT_SECONDS;

  await Promise.allSettled([
    cancelStaleCoinFlipMatches(cutoff),
    cancelStaleFlashMatches(cutoff),
    cancelStaleGames(cutoff),
  ]);

  console.log('[auto-cancel-stale-matches] All checks complete.');
}

// ─── CoinFlip ─────────────────────────────────────────────────────────────────

async function cancelStaleCoinFlipMatches(cutoff: number): Promise<void> {
  const allMatches = await getManyCoinFlipMatches();
  const staleMatches = allMatches.filter(
    (m) => m.state === 'waiting' && !m.opponent && m.createdAt < cutoff * 1000
  );

  if (!staleMatches || staleMatches.length === 0) {
    console.log('[auto-cancel-stale-matches][coinFlip] No stale matches found.');
    return;
  }

  console.log(`[auto-cancel-stale-matches][coinFlip] Found ${staleMatches.length} stale match(es) to cancel.`);

  const results = await Promise.allSettled(
    staleMatches.map(async (match) => {
      console.log(
        `[auto-cancel-stale-matches][coinFlip] Cancelling matchId=${match.id}, creator=${match.creator}, buyIn=${match.buyIn} lamports`
      );

      const success = await updateCoinFlipMatches(match.id, {
        state: 'cancelled',
        tier: match.tier,
        buyIn: match.buyIn,
        createdAt: match.createdAt,
      });

      if (success) {
        console.log(
          `[auto-cancel-stale-matches][coinFlip] Cancelled matchId=${match.id} — refund of ${match.buyIn} lamports triggered for creator ${match.creator}`
        );
      } else {
        console.warn(
          `[auto-cancel-stale-matches][coinFlip] Failed to cancel matchId=${match.id} — policy denied or write error`
        );
      }

      return { matchId: match.id, success };
    })
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ success: boolean }>).value.success).length;
  console.log(`[auto-cancel-stale-matches][coinFlip] Done. Cancelled: ${succeeded}, Failed: ${results.length - succeeded}`);
}

// ─── FlashTap ─────────────────────────────────────────────────────────────────

async function cancelStaleFlashMatches(cutoff: number): Promise<void> {
  const allMatches = await getManyFlashMatches();
  const staleMatches = allMatches.filter(
    (m) => m.state === 'waiting' && m.createdAt < cutoff * 1000
  );

  if (!staleMatches || staleMatches.length === 0) {
    console.log('[auto-cancel-stale-matches][flashTap] No stale matches found.');
    return;
  }

  console.log(`[auto-cancel-stale-matches][flashTap] Found ${staleMatches.length} stale match(es) to cancel.`);

  const results = await Promise.allSettled(
    staleMatches.map(async (match) => {
      console.log(
        `[auto-cancel-stale-matches][flashTap] Cancelling matchId=${match.id}, creator=${match.creator}, ts=${match.ts}`
      );

      const success = await updateFlashMatches(match.id, {
        state: 'cancelled',
        flashMomentMs: match.flashMomentMs,
        createdAt: match.createdAt,
      });

      if (success) {
        console.log(
          `[auto-cancel-stale-matches][flashTap] Cancelled matchId=${match.id} — refund triggered for creator ${match.creator}`
        );
      } else {
        console.warn(
          `[auto-cancel-stale-matches][flashTap] Failed to cancel matchId=${match.id} — policy denied or write error`
        );
      }

      return { matchId: match.id, success };
    })
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ success: boolean }>).value.success).length;
  console.log(`[auto-cancel-stale-matches][flashTap] Done. Cancelled: ${succeeded}, Failed: ${results.length - succeeded}`);
}

// ─── TapWars ──────────────────────────────────────────────────────────────────

async function cancelStaleGames(cutoff: number): Promise<void> {
  const allGames = await getManyGames();
  const staleGames = allGames.filter(
    (g) => g.state === 'waiting' && g.playerCount === 1 && g.createdAt < cutoff * 1000
  );

  if (!staleGames || staleGames.length === 0) {
    console.log('[auto-cancel-stale-matches][tapWars] No stale games found.');
    return;
  }

  console.log(`[auto-cancel-stale-matches][tapWars] Found ${staleGames.length} stale game(s) to cancel.`);

  const results = await Promise.allSettled(
    staleGames.map(async (game) => {
      console.log(
        `[auto-cancel-stale-matches][tapWars] Cancelling gameId=${game.id}, creator=${game.creator}, createdAt=${game.createdAt}`
      );

      const success = await updateGames(game.id, {
        state: 'cancelled',
        createdAt: game.createdAt,
        startedAt: game.startedAt,
      });

      if (success) {
        console.log(
          `[auto-cancel-stale-matches][tapWars] Cancelled gameId=${game.id} — refund triggered for creator ${game.creator}`
        );
      } else {
        console.warn(
          `[auto-cancel-stale-matches][tapWars] Failed to cancel gameId=${game.id} — policy denied or write error`
        );
      }

      return { gameId: game.id, success };
    })
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ success: boolean }>).value.success).length;
  console.log(`[auto-cancel-stale-matches][tapWars] Done. Cancelled: ${succeeded}, Failed: ${results.length - succeeded}`);
}
