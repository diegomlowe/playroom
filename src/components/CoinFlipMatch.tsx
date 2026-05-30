import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";;
import { toast } from 'sonner';
import { PageLayout } from '@/components/poof-ui';
import { Particles } from '@/components/effects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Coins, Trophy, Clock, Users, XCircle } from 'lucide-react';
import WalletButton from '@/components/WalletButton';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import {
  subscribeCoinFlipMatches,
  updateCoinFlipMatches,
  CoinFlipMatchesResponse,
} from '@/lib/collections/coinFlipMatches';
import { Address } from '@/lib/db-client';
import { api, createAuthenticatedApiClient } from '@/lib/api-client';

const ACCENT = 'hsl(45 100% 60%)';

// MNY uses 6 decimals (base units → display: divide by 1e6)
const MNY_DECIMALS = 1e6;

function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

/**
 * Currency-aware amount formatter.
 * SOL: divide by 1e9, show 3 decimal places, label "SOL"
 * MNY: divide by 1e6, show 3 decimal places, label "MNY"
 */
function formatBuyIn(amount: number, currency: string): { display: string; label: string } {
  if (currency === 'MNY') {
    return {
      display: (amount / MNY_DECIMALS).toFixed(3),
      label: 'MNY',
    };
  }
  // Default to SOL
  return {
    display: (amount / 1_000_000_000).toFixed(3),
    label: 'SOL',
  };
}

// ─── Flip Animation ──────────────────────────────────────────────────────────

interface FlipAnimationProps {
  match: CoinFlipMatchesResponse;
  userAddress?: string;
  buyInDisplay: string;
  buyInLabel: string;
  payoutDisplay: string;
  onAnimDone?: () => void;
}

const COUNTDOWN_SECS = 3;
const FLICKER_SECS = 3;
const TOTAL_ANIM_SECS = COUNTDOWN_SECS + FLICKER_SECS;

// Animation phases as a stable enum — avoids boolean-expression deps
type AnimPhase = 'countdown' | 'flicker' | 'done';

// Derive a deterministic seed from the match ID so both players see the
// same flicker sequence.  We hash the matchId characters into a small integer
// and use a simple LCG so the visible "side" sequence is reproducible.
function deterministicFlicker(matchId: string, tick: number): 1 | 2 {
  let seed = 0;
  for (let i = 0; i < matchId.length; i++) {
    seed = (seed * 31 + matchId.charCodeAt(i)) >>> 0;
  }
  // LCG step seeded by both the match and the tick counter
  const val = (seed * 1664525 + 1013904223 + tick * 22695477) >>> 0;
  return (val & 1) === 0 ? 1 : 2;
}

function FlipAnimation({ match, userAddress, buyInDisplay, buyInLabel, payoutDisplay, onAnimDone }: FlipAnimationProps) {
  // Stable phase state — the single source of truth for animation progress
  const [phase, setPhase] = useState<AnimPhase>('countdown');
  // Countdown display — updated every tick so React re-renders the number
  const [countdownNum, setCountdownNum] = useState<number>(COUNTDOWN_SECS);
  // Deterministic flicker tick counter — incremented each interval step
  const [flickerTick, setFlickerTick] = useState<number>(0);

  const startTimeRef = useRef<number>(Date.now());
  const onAnimDoneCalledRef = useRef(false);

  // Ref so the interval can read the latest match.state without being a dep
  // that would cause the timer to restart when state changes mid-animation.
  const matchStateRef = useRef(match.state);
  useEffect(() => { matchStateRef.current = match.state; }, [match.state]);

  // ONE unified interval: drives the whole animation lifecycle.
  // Runs once on mount (empty deps). Reads matchStateRef for resolved check so the
  // timer never resets when state flips — it just picks up the resolved signal next tick.
  // Works for both creator (component already mounted when opponent joined) and
  // challenger (component mounts fresh when they navigate to the page).
  //   countdown (0-3s) → flicker (3-6s) → done (once 6s elapsed AND state === 'resolved')
  useEffect(() => {
    startTimeRef.current = Date.now();
    setPhase('countdown');
    setCountdownNum(COUNTDOWN_SECS);

    const id = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;

      if (elapsed < COUNTDOWN_SECS) {
        // Still counting down — update countdown number so React re-renders
        const remaining = Math.max(1, COUNTDOWN_SECS - Math.floor(elapsed));
        setCountdownNum(remaining);
        return;
      }

      // Past countdown threshold — advance phase from countdown to flicker (once)
      setPhase((prev) => {
        if (prev === 'countdown') return 'flicker';
        return prev;
      });

      // Flicker tick (runs every 100ms during flicker phase)
      // Incrementing a counter triggers re-render; the visible side is computed
      // deterministically from matchId + tick so both players see the same sequence.
      if (elapsed < TOTAL_ANIM_SECS) {
        setFlickerTick((t) => t + 1);
        return;
      }

      // Minimum animation time elapsed — check if match has resolved
      if (matchStateRef.current === 'resolved') {
        clearInterval(id);
        setPhase('done');
        if (onAnimDone && !onAnimDoneCalledRef.current) {
          onAnimDoneCalledRef.current = true;
          onAnimDone();
        }
      } else {
        // Resolution not yet returned — keep flickering each tick until it does
        setFlickerTick((t) => t + 1);
      }
    }, 100);

    return () => clearInterval(id);
    // Intentionally empty: timer starts once on mount, reads state via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showResult = phase === 'done' && match.state === 'resolved' && !!match.winner;

  const isWinner = userAddress && match.winner === userAddress;
  const isParticipant = userAddress && (userAddress === match.creator || userAddress === match.opponent);

  // Countdown phase: 0–3s
  if (phase === 'countdown') {
    return (
      <div className="flex flex-col items-center gap-4">
        {/* Coin circle with countdown number */}
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300"
          style={{
            background: `${ACCENT}15`,
            border: `3px solid ${ACCENT}`,
            boxShadow: `0 0 60px ${ACCENT}50`,
          }}
        >
          <span
            className="font-black"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '3rem',
              color: ACCENT,
              textShadow: `0 0 20px ${ACCENT}`,
            }}
          >
            {countdownNum}
          </span>
        </div>
        <p
          className="text-sm font-bold tracking-widest uppercase"
          style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
        >
          Get Ready...
        </p>
      </div>
    );
  }

  // Flicker phase: 3–6s (or until resolved + done)
  if (!showResult) {
    return (
      <div className="flex flex-col items-center gap-4">
        {/* Coin circle showing slot-machine flicker */}
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center"
          style={{
            background: `${ACCENT}20`,
            border: `3px solid ${ACCENT}`,
            boxShadow: `0 0 80px ${ACCENT}60`,
          }}
        >
          <span
            className="font-black select-none"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '3.5rem',
              color: ACCENT,
              textShadow: `0 0 30px ${ACCENT}`,
              transition: 'opacity 50ms',
            }}
          >
            {deterministicFlicker(match.id, flickerTick)}
          </span>
        </div>
        <p
          className="text-sm font-bold tracking-widest uppercase animate-pulse"
          style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
        >
          Flipping...
        </p>
        <p className="text-xs text-muted-foreground">Determining outcome on-chain...</p>
      </div>
    );
  }

  // Result phase: animation done + resolved
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500"
        style={{
          background: isWinner ? 'hsl(160 100% 45% / 0.15)' : 'hsl(var(--muted) / 0.2)',
          border: `3px solid ${isWinner ? 'hsl(160 100% 45%)' : 'hsl(var(--border))'}`,
          boxShadow: isWinner ? '0 0 40px hsl(160 100% 45% / 0.4)' : 'none',
        }}
      >
        {isWinner ? (
          <Trophy className="h-12 w-12" style={{ color: 'hsl(160 100% 45%)' }} />
        ) : (
          <Coins className="h-12 w-12 text-muted-foreground" />
        )}
      </div>

      {isParticipant && (
        <div className="text-center">
          <h2
            className="text-4xl font-black mb-2"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: isWinner ? 'hsl(160 100% 45%)' : 'hsl(var(--muted-foreground))',
              textShadow: isWinner ? '0 0 30px hsl(160 100% 45% / 0.5)' : 'none',
            }}
          >
            {isWinner ? 'YOU WON!' : 'YOU LOST'}
          </h2>
          {isWinner && (
            <p className="text-sm text-muted-foreground">
              Payout:{' '}
              <span className="font-black text-foreground">
                {payoutDisplay} {buyInLabel}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const CoinFlipMatch: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cancelling, setCancelling] = useState(false);
  const resolveCalledRef = useRef(false);

  // Client-side animation state — triggered once when opponent first appears
  const [isAnimating, setIsAnimating] = useState(false);
  // Whether the inner FlipAnimation has completed its full sequence
  const [innerAnimDone, setInnerAnimDone] = useState(false);
  const animationFiredRef = useRef(false);

  const { data: match, loading } = useRealtimeData<CoinFlipMatchesResponse | null>(
    subscribeCoinFlipMatches,
    !!matchId,
    matchId!
  );

  // Kick off animation when opponent first joins (only once per match)
  useEffect(() => {
    if (!match?.opponent) return;
    if (animationFiredRef.current) return;
    animationFiredRef.current = true;
    setIsAnimating(true);
    // No auto-timeout here — we keep isAnimating true until BOTH the inner
    // animation sequence is done AND the match has resolved (see effect below).
  }, [match?.opponent]);

  // End the animation overlay once BOTH conditions are met:
  // 1. The inner FlipAnimation component has finished its full 6-second sequence
  // 2. The match is resolved (VRF has returned)
  useEffect(() => {
    if (!isAnimating) return;
    if (!innerAnimDone) return;
    if (match?.state !== 'resolved') return;
    setIsAnimating(false);
  }, [isAnimating, innerAnimDone, match?.state]);

  // NOTE: Intentionally no safety-valve that clears isAnimating on state===resolved.
  // The FlipAnimation component keeps running until its own internal sequence
  // completes (phase reaches 'done'), then calls onAnimDone(). Only after that
  // does innerAnimDone become true, and the effect above (lines ~283-288) clears
  // isAnimating. Killing isAnimating early would unmount the animation before it
  // shows the final winner result — causing the coin to snap to the wrong side.

  // match-not-found is handled via inline render below (item 8)

  async function handleCancel() {
    if (!match || !user || cancelling) return;
    setCancelling(true);
    try {
      const success = await updateCoinFlipMatches(match.id, {
        state: 'cancelled',
        creator: Address.publicKey(match.creator),
        tier: match.tier,
        buyIn: match.buyIn,
        ts: match.ts,
        opponent: undefined,
        winner: undefined,
      });
      if (success) {
        toast.success('Match cancelled, refund sent');
        navigate('/coinflip');
      } else {
        toast.error('Failed to cancel — please try again');
      }
    } catch {
      toast.error('Error cancelling match');
    } finally {
      setCancelling(false);
    }
  }

  // Trigger backend resolution when both players are present and match is waiting.
  // Any participant can call it; the backend signs as vault and resolves deterministically.
  useEffect(() => {
    if (!matchId) return;
    if (!match?.opponent) return;
    if (match.state !== 'waiting') return;
    const addr = user?.address;
    if (!addr) return;
    if (addr !== match.creator && addr !== match.opponent) return;
    if (resolveCalledRef.current) return;
    resolveCalledRef.current = true;

    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const authApi = createAuthenticatedApiClient(token, addr as string);
        await authApi.post('/api/coinflip/resolve', { matchId });
      } catch (err) {
        console.error('Coinflip resolve call failed:', err);
        // Allow retry on failure by resetting the ref
        resolveCalledRef.current = false;
      }
    })();
  }, [matchId, match?.opponent, match?.state, user?.address, match?.creator]);

  if (!match) {
    // Still loading — show spinner. Once loading is done and match is still
    // null, show "not found" so the user isn't stuck in a perpetual loading state.
    return (
      <PageLayout fullBleed footer={false}>
        <div className="relative min-h-screen flex items-center justify-center">
          <Particles quantity={30} color={ACCENT} />
          <div className="relative z-10 text-center">
            {loading ? (
              <div
                className="text-2xl font-black animate-pulse"
                style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
              >
                LOADING...
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: `${ACCENT}15`, border: `2px solid ${ACCENT}40` }}
                >
                  <Coins className="h-10 w-10" style={{ color: ACCENT }} />
                </div>
                <h2
                  className="text-2xl font-black"
                  style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
                >
                  Match Not Found
                </h2>
                <p className="text-sm text-muted-foreground text-center max-w-[240px]">
                  This match doesn't exist or has already been removed.
                </p>
                <Button
                  onClick={() => navigate('/coinflip')}
                  className="h-11 px-6 font-black tracking-widest"
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    background: ACCENT,
                    color: '#000',
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  BACK TO LOBBY
                </Button>
              </div>
            )}
          </div>
        </div>
      </PageLayout>
    );
  }

  const currency = match.buyInCurrency || 'SOL';
  const buyInRaw = match.buyIn as number;
  const potRaw = buyInRaw * 2;
  const payoutRaw = potRaw * 0.99;

  const { display: buyInDisplay, label: buyInLabel } = formatBuyIn(buyInRaw, currency);
  const { display: payoutDisplay } = formatBuyIn(payoutRaw, currency);
  // Prize pot display
  const { display: potDisplay } = formatBuyIn(potRaw, currency);

  const userAddress = user?.address;
  const isCreator = userAddress === match.creator;
  const isOpponent = userAddress === match.opponent;
  const isParticipant = isCreator || isOpponent;

  const isWinner = userAddress && match.winner === userAddress;

  // Flipping state: client-side animation running (see useEffect above)
  const isFlipping = isAnimating;

  return (
    <PageLayout fullBleed footer={false}>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <Particles quantity={40} color={ACCENT} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 pt-5 pb-2">
          <button
            onClick={() => navigate('/coinflip')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-bold tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              LOBBY
            </span>
          </button>
          <div
            className="text-lg font-black tracking-widest"
            style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT, textShadow: `0 0 20px ${ACCENT}50` }}
          >
            COINFLIP
          </div>
          <div className="w-16 flex justify-end">
            {!user && <WalletButton />}
          </div>
        </header>

        {/* Main content */}
        <main className="relative z-10 flex-1 px-4 pb-10 flex flex-col items-center">
          {/* Status badge */}
          <div className="mt-6 mb-8">
            {match.state === 'waiting' && !match.opponent && (
              <Badge
                className="text-xs tracking-widest px-4 py-1.5"
                style={{
                  background: 'hsl(160 100% 45% / 0.15)',
                  color: 'hsl(160 100% 45%)',
                  border: '1px solid hsl(160 100% 45% / 0.4)',
                  fontFamily: "'Orbitron', sans-serif",
                }}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse mr-2" />
                WAITING FOR OPPONENT
              </Badge>
            )}
            {isFlipping && (
              <Badge
                className="text-xs tracking-widest px-4 py-1.5"
                style={{
                  background: `${ACCENT}20`,
                  color: ACCENT,
                  border: `1px solid ${ACCENT}40`,
                  fontFamily: "'Orbitron', sans-serif",
                }}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse mr-2" style={{ background: ACCENT }} />
                FLIPPING...
              </Badge>
            )}
            {match.state === 'resolved' && (
              <Badge
                className="text-xs tracking-widest px-4 py-1.5"
                style={{
                  background: isWinner ? 'hsl(160 100% 45% / 0.15)' : 'hsl(var(--muted) / 0.3)',
                  color: isWinner ? 'hsl(160 100% 45%)' : 'hsl(var(--muted-foreground))',
                  border: `1px solid ${isWinner ? 'hsl(160 100% 45% / 0.4)' : 'hsl(var(--border))'}`,
                  fontFamily: "'Orbitron', sans-serif",
                }}
              >
                RESOLVED
              </Badge>
            )}
          </div>

          {/* Coin visual / animation area */}
          <div className="mb-8 flex items-center justify-center">
            {isFlipping ? (
              <FlipAnimation
                match={match}
                userAddress={userAddress}
                buyInDisplay={buyInDisplay}
                buyInLabel={buyInLabel}
                payoutDisplay={payoutDisplay}
                onAnimDone={() => setInnerAnimDone(true)}
              />
            ) : match.state === 'resolved' ? (
              // Non-animated resolved state (e.g. page opened after result)
              <div className="flex flex-col items-center gap-4">
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500"
                  style={{
                    background: isWinner ? 'hsl(160 100% 45% / 0.15)' : 'hsl(var(--muted) / 0.2)',
                    border: `3px solid ${isWinner ? 'hsl(160 100% 45%)' : 'hsl(var(--border))'}`,
                    boxShadow: isWinner ? '0 0 40px hsl(160 100% 45% / 0.4)' : 'none',
                  }}
                >
                  {isWinner ? (
                    <Trophy className="h-12 w-12" style={{ color: 'hsl(160 100% 45%)' }} />
                  ) : isParticipant ? (
                    <Coins className="h-12 w-12 text-muted-foreground" />
                  ) : (
                    <Trophy className="h-12 w-12" style={{ color: ACCENT }} />
                  )}
                </div>
                {isParticipant && (
                  <div
                    className="w-full max-w-sm rounded-2xl border p-5 text-center"
                    style={{
                      background: isWinner
                        ? 'hsl(160 100% 45% / 0.12)'
                        : 'hsl(0 70% 50% / 0.08)',
                      borderColor: isWinner
                        ? 'hsl(160 100% 45% / 0.5)'
                        : 'hsl(0 70% 50% / 0.3)',
                      boxShadow: isWinner
                        ? '0 0 30px hsl(160 100% 45% / 0.2)'
                        : 'none',
                    }}
                  >
                    <h2
                      className="text-3xl font-black mb-2"
                      style={{
                        fontFamily: "'Orbitron', sans-serif",
                        color: isWinner
                          ? 'hsl(160 100% 45%)'
                          : 'hsl(0 70% 50%)',
                        textShadow: isWinner
                          ? '0 0 20px hsl(160 100% 45% / 0.5)'
                          : 'none',
                      }}
                    >
                      {isWinner ? 'You Won! 🎉' : 'You Lost'}
                    </h2>
                    {isWinner && (
                      <p className="text-sm text-muted-foreground">
                        Payout:{' '}
                        <span className="font-black text-foreground">
                          {payoutDisplay} {buyInLabel}
                        </span>
                      </p>
                    )}
                    {!isWinner && (
                      <p className="text-sm text-muted-foreground">
                        Better luck next time
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Waiting for opponent
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center animate-pulse"
                style={{
                  background: `${ACCENT}15`,
                  border: `3px solid ${ACCENT}40`,
                  boxShadow: `0 0 40px ${ACCENT}30`,
                }}
              >
                <Clock className="h-12 w-12" style={{ color: ACCENT }} />
              </div>
            )}
          </div>

          {/* Headline for waiting state (no opponent) */}
          {match.state === 'waiting' && !match.opponent && (
            <div className="text-center mb-6">
              <h2
                className="text-2xl font-black mb-2"
                style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
              >
                Waiting for Opponent
              </h2>
              <p className="text-sm text-muted-foreground">Share this match or wait for someone to join from the lobby.</p>
              <p className="text-xs text-muted-foreground/70 mt-2">
                Auto-refund in ~10 minutes if no opponent joins
              </p>
            </div>
          )}

          {/* Players */}
          <div className="w-full max-w-sm mb-6">
            <div className="grid grid-cols-2 gap-3">
              {/* Creator */}
              <div
                className="rounded-2xl p-4 border text-center"
                style={{
                  background: match.state === 'resolved' && match.winner === match.creator
                    ? 'hsl(160 100% 45% / 0.08)'
                    : 'hsl(var(--card) / 0.6)',
                  borderColor: match.state === 'resolved' && match.winner === match.creator
                    ? 'hsl(160 100% 45% / 0.5)'
                    : 'hsl(var(--border))',
                }}
              >
                <div className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1">Creator</div>
                <div className="font-bold text-sm text-foreground">{truncateAddress(match.creator)}</div>
                {match.state === 'resolved' && match.winner === match.creator && (
                  <div className="mt-1 text-[10px] font-black text-green-400 tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>WINNER</div>
                )}
              </div>

              {/* Opponent */}
              <div
                className="rounded-2xl p-4 border text-center"
                style={{
                  background: match.state === 'resolved' && match.winner === match.opponent
                    ? 'hsl(160 100% 45% / 0.08)'
                    : 'hsl(var(--card) / 0.6)',
                  borderColor: match.state === 'resolved' && match.winner === match.opponent
                    ? 'hsl(160 100% 45% / 0.5)'
                    : 'hsl(var(--border))',
                }}
              >
                <div className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1">Opponent</div>
                {match.opponent ? (
                  <div className="font-bold text-sm text-foreground">{truncateAddress(match.opponent)}</div>
                ) : (
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span className="text-xs">Waiting...</span>
                  </div>
                )}
                {match.state === 'resolved' && match.winner === match.opponent && (
                  <div className="mt-1 text-[10px] font-black text-green-400 tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>WINNER</div>
                )}
              </div>
            </div>
          </div>

          {/* Match details */}
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card/40 p-4 mb-8">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Buy-in</span>
              <span className="font-bold" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                {buyInDisplay} {buyInLabel}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Prize Pot</span>
              <span className="font-bold" style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}>
                {potDisplay} {buyInLabel}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tier</span>
              <Badge className="text-[10px] font-black" style={{ fontFamily: "'Orbitron', sans-serif", background: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40` }}>
                TIER {match.tier}
              </Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="w-full max-w-sm space-y-3">
            <Button
              onClick={() => navigate('/coinflip')}
              variant={match.state === 'resolved' ? 'default' : 'secondary'}
              className="w-full h-12 font-black tracking-widest rounded-2xl"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                ...(match.state === 'resolved' ? { background: ACCENT, color: '#000', boxShadow: `0 0 20px ${ACCENT}40` } : {}),
              }}
            >
              {match.state === 'resolved' ? (
                <>
                  <Coins className="mr-2 h-4 w-4" />
                  PLAY AGAIN
                </>
              ) : (
                <>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  BACK TO LOBBY
                </>
              )}
            </Button>

            {/* Cancel button — only for creator while waiting with no opponent */}
            {match.state === 'waiting' && !match.opponent && isCreator && (
              <Button
                onClick={handleCancel}
                disabled={cancelling}
                variant="ghost"
                className="w-full h-10 font-bold tracking-widest rounded-2xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-colors"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                {cancelling ? (
                  'CANCELLING...'
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    CANCEL MATCH
                  </>
                )}
              </Button>
            )}

            {match.state === 'resolved' && (
              <Button
                onClick={() => navigate('/')}
                variant="ghost"
                className="w-full h-10 font-bold tracking-widest text-muted-foreground hover:text-foreground"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                HOME
              </Button>
            )}
          </div>
        </main>
      </div>
    </PageLayout>
  );
};

export default CoinFlipMatch;
