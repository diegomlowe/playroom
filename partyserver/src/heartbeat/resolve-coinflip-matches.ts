/**
 * Heartbeat task: resolve-coinflip-matches
 *
 * Runs every minute. Finds all coinFlipMatches with state='waiting' and an opponent
 * already joined, then deterministically resolves each match by picking a winner
 * based on a hash of the matchId. The update triggers the policy hook which pays
 * 99% of the pot to the winner and 1% fee to the pool.
 */

import { getManyCoinFlipMatches, updateCoinFlipMatches } from '../collections/coinFlipMatches.js';

export async function resolveCoinflipMatches(): Promise<void> {
  const now = new Date().toISOString();
  console.log(`[resolve-coinflip-matches] [${now}] Starting resolution check...`);

  const allMatches = await getManyCoinFlipMatches();
  const waitingMatches = allMatches.filter((m) => m.state === 'waiting' && m.opponent);

  console.log(`[resolve-coinflip-matches] [${now}] Query returned ${waitingMatches?.length ?? 0} match(es).`);

  if (!waitingMatches || waitingMatches.length === 0) {
    console.log(`[resolve-coinflip-matches] [${now}] No waiting matches with opponent found. Exiting.`);
    return;
  }

  console.log(`[resolve-coinflip-matches] [${now}] Found ${waitingMatches.length} match(es) to resolve.`);

  const results = await Promise.allSettled(
    waitingMatches.map(async (match) => {
      // Idempotency / defensive check
      if (match.state !== 'waiting' || !match.opponent) {
        console.log(`[resolve-coinflip-matches] Skipping matchId=${match.id} — already resolved or no opponent`);
        return { matchId: match.id, success: true, skipped: true };
      }

      // Deterministic winner: FNV-1a hash of full matchId → creator or opponent
      // Using all characters prevents outcome prediction from first-char crafting.
      let hashVal = 2166136261; // FNV-1a 32-bit offset basis
      for (let i = 0; i < match.id.length; i++) {
        hashVal ^= match.id.charCodeAt(i);
        hashVal = (hashVal * 16777619) >>> 0; // FNV prime, keep 32-bit unsigned
      }
      const winner = hashVal % 2 === 0 ? match.creator : match.opponent;
      console.log(`[resolve-coinflip-matches] Resolving matchId=${match.id}, creator=${match.creator}, opponent=${match.opponent}, winner=${winner}`);

      const success = await updateCoinFlipMatches(match.id, {
        state: 'resolved',
        winner,
        tier: match.tier,
        buyIn: match.buyIn,
        createdAt: match.createdAt,
        buyInCurrency: match.buyInCurrency,
      });

      if (success) {
        console.log(`[resolve-coinflip-matches] SUCCESS matchId=${match.id}, winner=${winner}`);
      } else {
        console.warn(`[resolve-coinflip-matches] FAILED matchId=${match.id} — policy denied or write error`);
      }

      return { matchId: match.id, success, skipped: false };
    })
  );

  const succeeded = results.filter(
    (r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ success: boolean; skipped: boolean }>).value.success
  ).length;
  const skipped = results.filter(
    (r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ success: boolean; skipped: boolean }>).value.skipped
  ).length;
  const failed = results.length - succeeded - skipped;

  console.log(`[resolve-coinflip-matches] [${now}] Done. Total: ${results.length}, Resolved: ${succeeded}, Skipped: ${skipped}, Failed: ${failed}`);
}
