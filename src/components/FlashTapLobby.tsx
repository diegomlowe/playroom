import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";;
import { toast } from 'sonner';
import { PageLayout } from '@/components/poof-ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Particles } from '@/components/effects';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import {
  subscribeFlashMatches,
  updateFlashMatches,
  FlashMatchesResponse,
} from '@/lib/collections/flashMatches';
import {
  setFlashMatchJoinsPlayers,
  subscribeManyFlashMatchJoinsPlayers,
  FlashMatchJoinsPlayersResponse,
} from '@/lib/collections/flashMatchJoins';
import {
  setFlashMatchTapsPlayers,
  subscribeManyFlashMatchTapsPlayers,
  FlashMatchTapsPlayersResponse,
} from '@/lib/collections/flashMatchTaps';
import { Address, Time } from '@/lib/db-client';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { ArrowLeft, Clock, Trophy, Users, XCircle, Zap, Medal } from 'lucide-react';
import WalletButton from '@/components/WalletButton';

function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Main Lobby page ──────────────────────────────────────────────────────────

export const FlashTapLobby: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: match, loading } = useRealtimeData<FlashMatchesResponse | null>(
    subscribeFlashMatches,
    !!matchId,
    matchId!
  );

  const { data: players } = useRealtimeData<FlashMatchJoinsPlayersResponse[]>(
    subscribeManyFlashMatchJoinsPlayers,
    !!matchId,
    matchId!
  );

  const { data: taps } = useRealtimeData<FlashMatchTapsPlayersResponse[]>(
    subscribeManyFlashMatchTapsPlayers,
    !!matchId,
    matchId!
  );

  useEffect(() => {
    if (!loading && match === null) {
      navigate('/flashtap/new');
    }
  }, [loading, match, navigate]);

  if (!match) {
    return (
      <PageLayout fullBleed footer={false}>
        <div className="relative min-h-screen flex items-center justify-center">
          <Particles quantity={30} color="hsl(160 100% 45%)" />
          <div className="relative z-10 text-center">
            <div
              className="text-2xl font-black animate-pulse"
              style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(160 100% 45%)' }}
            >
              LOADING...
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  // All participant addresses: creator + joined players
  const joinedAddresses = (players ?? []).map((p) => p.player);
  const allParticipants = [match.creator, ...joinedAddresses];
  const isParticipant = !!user && allParticipants.includes(user.address);
  const isCreator = user?.address === match.creator;
  const playerCount = match.playerCount as number;

  return (
    <PageLayout fullBleed footer={false}>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Particles quantity={40} color="hsl(160 100% 45%)" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 pt-5 pb-3">
          <button
            onClick={() => navigate('/flashtap/new')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-semibold">FlashTap</span>
          </button>
          <div
            className="text-lg font-black tracking-widest"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: 'hsl(160 100% 45%)',
              textShadow: '0 0 20px hsl(160 100% 45% / 0.5)',
            }}
          >
            FLASHTAP
          </div>
          <div className="w-16" />
        </header>

        <main className="relative z-10 flex-1 px-4 pb-8">
          {match.state === 'waiting' && (
            <WaitingLobby
              match={match}
              playerCount={playerCount}
              allParticipants={allParticipants}
              isParticipant={isParticipant}
              isCreator={isCreator}
              user={user}
              matchId={matchId!}
            />
          )}

          {match.state === 'playing' && isParticipant && (
            <FlashGame
              matchId={matchId!}
              match={match}
              user={user!}
              allParticipants={allParticipants}
              taps={taps ?? []}
            />
          )}

          {match.state === 'playing' && !isParticipant && (
            <SpectatorView />
          )}

          {match.state === 'resolved' && (
            <ResultsView
              match={match}
              allParticipants={allParticipants}
              taps={taps ?? []}
            />
          )}

          {(match.state === 'cancelled') && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
              <div className="text-muted-foreground">This match was cancelled.</div>
              <Button onClick={() => navigate('/flashtap/new')} className="font-black tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                NEW MATCH
              </Button>
            </div>
          )}
        </main>
      </div>
    </PageLayout>
  );
};

// ─── Waiting Lobby ────────────────────────────────────────────────────────────

function WaitingLobby({
  match,
  playerCount,
  allParticipants,
  isParticipant,
  isCreator,
  user,
  matchId,
}: {
  match: FlashMatchesResponse;
  playerCount: number;
  allParticipants: string[];
  isParticipant: boolean;
  isCreator: boolean;
  user: { address: string } | null;
  matchId: string;
}) {
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const slotsNeeded = 4 - playerCount;

  async function handleCancel() {
    if (cancelling) return;
    setCancelling(true);
    try {
      const success = await updateFlashMatches(matchId, {
        state: 'cancelled',
        creator: Address.publicKey(match.creator),
        playerCount: match.playerCount,
        flashMomentMs: match.flashMomentMs,
        winnerDeltaMs: match.winnerDeltaMs,
        ts: match.ts,
        winner: undefined,
      });
      if (success) {
        toast.success('Match cancelled — buy-in refunded');
        navigate('/flashtap/new');
      } else {
        toast.error('Failed to cancel — please try again');
      }
    } catch {
      toast.error('Error cancelling match');
    } finally {
      setCancelling(false);
    }
  }

  // Auto-trigger start when 4 players are in and user is a participant
  useEffect(() => {
    if (playerCount < 4 || !user || !isParticipant || starting) return;

    async function triggerStart() {
      setStarting(true);
      try {
        const token = await getIdToken();
        if (token) {
          const authApi = createAuthenticatedApiClient(token, user!.address);
          await authApi.post(`/api/flashtap/${matchId}/start`);
        }
      } catch {
        // Another player may have already started it
      }
    }
    triggerStart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCount, isParticipant]);

  async function handleJoin() {
    if (!user) {
      toast.error('Connect your wallet first');
      return;
    }
    if (joining) return;
    setJoining(true);
    try {
      const success = await setFlashMatchJoinsPlayers(matchId, user.address, {
        player: Address.publicKey(user.address),
        ts: Time.Now as any,
      });
      if (success) {
        toast.success('Joined! Waiting for other players...');
      } else {
        toast.error('Failed to join — wallet may have denied the buy-in');
      }
    } catch {
      toast.error('Error joining match');
    } finally {
      setJoining(false);
    }
  }

  // Slots: display up to 4 with addresses or empty
  const slots = Array.from({ length: 4 }, (_, i) => allParticipants[i] ?? null);

  return (
    <div className="mt-4">
      <div className="text-center mb-6">
        <Badge
          className="text-xs tracking-widest mb-3"
          style={{
            background: 'hsl(160 100% 45% / 0.15)',
            color: 'hsl(160 100% 45%)',
            border: '1px solid hsl(160 100% 45% / 0.4)',
            fontFamily: "'Orbitron', sans-serif",
          }}
        >
          WAITING FOR PLAYERS
        </Badge>
        <h2
          className="text-3xl font-black"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            color: 'hsl(160 100% 45%)',
            textShadow: '0 0 30px hsl(160 100% 45% / 0.4)',
          }}
        >
          {playerCount}/4
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {slotsNeeded === 0
            ? 'Starting soon...'
            : `Waiting for ${slotsNeeded} more player${slotsNeeded > 1 ? 's' : ''}...`}
        </p>
      </div>

      {/* Player slots */}
      <div className="space-y-3 mb-8">
        {slots.map((addr, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 rounded-2xl p-4 border transition-all ${
              addr
                ? 'bg-card/60 backdrop-blur-sm'
                : 'border-dashed border-border bg-muted/10'
            }`}
            style={addr ? { borderColor: 'hsl(160 100% 45% / 0.4)' } : undefined}
          >
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-black ${
                addr ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted/30 text-muted-foreground'
              }`}
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              {i + 1}
            </div>
            <div className="flex-1">
              {addr ? (
                <div>
                  <div className="font-semibold text-foreground text-sm">{truncateAddress(addr)}</div>
                  {i === 0 && <div className="text-xs text-muted-foreground">Creator</div>}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">Waiting...</div>
              )}
            </div>
            {addr && <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
          </div>
        ))}
      </div>

      {/* Join button or already joined */}
      {user && !isParticipant && playerCount < 4 && (
        <Button
          onClick={handleJoin}
          disabled={joining}
          size="lg"
          className="w-full h-14 font-black tracking-widest rounded-2xl"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            background: 'hsl(160 100% 45%)',
            color: '#000',
            boxShadow: '0 0 30px hsl(160 100% 45% / 0.4)',
          }}
        >
          {joining ? 'JOINING...' : 'JOIN MATCH'}
        </Button>
      )}

      {!user && (
        <div className="text-center">
          <p className="text-muted-foreground text-sm mb-3">Connect wallet to join</p>
          <WalletButton />
        </div>
      )}

      {user && isParticipant && (
        <div
          className="text-center text-sm font-bold tracking-widest"
          style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(160 100% 45%)' }}
        >
          YOU'RE IN — WAITING FOR OTHERS
        </div>
      )}

      {/* Cancel button — only for creator while solo (no players joined) */}
      {isCreator && playerCount === 1 && (
        <div className="mt-6 space-y-2">
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
          <p className="text-center text-xs text-muted-foreground/60">
            Auto-refund in ~10 minutes if no players join
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Flash Game (reaction phase) ─────────────────────────────────────────────

type GamePhase = 'waiting-flash' | 'flash-active' | 'tapped' | 'waiting-result';

function FlashGame({
  matchId,
  match,
  user,
  allParticipants,
  taps,
}: {
  matchId: string;
  match: FlashMatchesResponse;
  user: { address: string };
  allParticipants: string[];
  taps: FlashMatchTapsPlayersResponse[];
}) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<GamePhase>('waiting-flash');
  const [myDeltaMs, setMyDeltaMs] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const flashMomentMs = match.flashMomentMs as number;
  const startTimeRef = useRef(Date.now());
  const submittedRef = useRef(false);
  const rafRef = useRef<number | undefined>(undefined);
  const alreadyTapped = taps?.some((t) => t.player === user.address);

  // Animate elapsed counter before flash
  useEffect(() => {
    if (phase !== 'waiting-flash') return;
    const tick = () => {
      setElapsed(Date.now() - startTimeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase]);

  // Watch for flashMomentMs to be set (backend transitions to playing and sets it)
  useEffect(() => {
    if (!flashMomentMs || flashMomentMs === 0) return;

    const now = Date.now();
    const timeUntilFlash = flashMomentMs - now;

    if (timeUntilFlash <= 0) {
      // Flash already happened (late load)
      setPhase('flash-active');
      return;
    }

    const t = setTimeout(() => {
      setPhase('flash-active');
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    }, timeUntilFlash);

    return () => clearTimeout(t);
  }, [flashMomentMs]);

  const handleTap = useCallback(async () => {
    if (submittedRef.current || alreadyTapped) return;

    const tapTime = Date.now();
    const delta = flashMomentMs ? Math.abs(tapTime - flashMomentMs) : tapTime - startTimeRef.current;

    submittedRef.current = true;
    setMyDeltaMs(delta);
    setPhase('tapped');
    if (navigator.vibrate) navigator.vibrate(15);

    const submitted = await setFlashMatchTapsPlayers(matchId, user.address, {
      player: Address.publicKey(user.address),
      tapTimeMs: tapTime,
      submittedAt: Time.Now as any,
    });

    if (!submitted) {
      toast.error('Failed to submit tap');
    }

    // Trigger backend resolve attempt
    try {
      const token = await getIdToken();
      if (token) {
        const authApi = createAuthenticatedApiClient(token, user.address);
        await authApi.post(`/api/flashtap/${matchId}/resolve`);
      }
    } catch {
      // Another player will trigger resolve
    }

    setPhase('waiting-result');
  }, [flashMomentMs, matchId, user.address, alreadyTapped]);

  if (alreadyTapped && phase !== 'tapped' && phase !== 'waiting-result') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Clock className="h-12 w-12" style={{ color: 'hsl(160 100% 45%)' }} />
        <p
          className="font-black tracking-widest text-lg animate-pulse"
          style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(160 100% 45%)' }}
        >
          TAP SUBMITTED — WAITING...
        </p>
      </div>
    );
  }

  if (phase === 'tapped' || phase === 'waiting-result') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div
          className="text-5xl font-black"
          style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(160 100% 45%)' }}
        >
          {myDeltaMs !== null ? `${myDeltaMs}ms` : '—'}
        </div>
        <p
          className="text-muted-foreground tracking-widest text-sm uppercase"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          YOUR REACTION
        </p>
        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="h-1 w-32 bg-primary/20 rounded-full overflow-hidden">
            <div className="h-full w-1/2 rounded-full animate-pulse" style={{ background: 'hsl(160 100% 45%)' }} />
          </div>
          <p className="text-muted-foreground text-sm tracking-widest">CALCULATING RESULTS...</p>
        </div>
      </div>
    );
  }

  if (phase === 'flash-active') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <button
          onPointerDown={handleTap}
          className="relative w-72 h-72 rounded-full flex items-center justify-center select-none touch-none transition-transform active:scale-95"
          style={{
            background: 'hsl(160 100% 45% / 0.3)',
            border: '4px solid hsl(160 100% 45%)',
            boxShadow: '0 0 80px hsl(160 100% 45% / 0.8), 0 0 120px hsl(160 100% 45% / 0.4)',
            WebkitTapHighlightColor: 'transparent',
            animation: 'flashPulse 0.3s ease-out',
          }}
        >
          <div className="text-center">
            <div
              className="text-5xl font-black"
              style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(160 100% 45%)' }}
            >
              TAP!
            </div>
            <Zap className="h-10 w-10 mx-auto mt-2" style={{ color: 'hsl(160 100% 45%)' }} />
          </div>
        </button>
        <p
          className="mt-6 text-sm font-bold tracking-widest animate-pulse"
          style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(160 100% 45%)' }}
        >
          FLASH! TAP NOW!
        </p>
      </div>
    );
  }

  // waiting-flash phase — show pulsing "waiting" target
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
      <p
        className="text-muted-foreground text-sm tracking-widest uppercase"
        style={{ fontFamily: "'Orbitron', sans-serif" }}
      >
        WAIT FOR THE FLASH...
      </p>

      <button
        onPointerDown={handleTap}
        className="relative w-72 h-72 rounded-full flex items-center justify-center select-none touch-none"
        style={{
          background: 'hsl(160 100% 45% / 0.05)',
          border: '2px dashed hsl(160 100% 45% / 0.3)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div className="text-center">
          <Clock
            className="h-16 w-16 mx-auto mb-2 animate-pulse"
            style={{ color: 'hsl(160 100% 45% / 0.4)' }}
          />
          <div
            className="text-lg font-black text-muted-foreground"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            {(elapsed / 1000).toFixed(2)}s
          </div>
          <div className="text-xs text-muted-foreground mt-1">Elapsed</div>
        </div>
      </button>

      <div className="text-xs text-muted-foreground text-center max-w-xs">
        A target will flash at any moment.<br />
        Tap the instant you see it light up.
      </div>
    </div>
  );
}

// ─── Spectator ────────────────────────────────────────────────────────────────

function SpectatorView() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Users className="h-12 w-12 text-muted-foreground" />
      <h2
        className="text-2xl font-black"
        style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(160 100% 45%)' }}
      >
        MATCH IN PROGRESS
      </h2>
      <p className="text-muted-foreground text-center text-sm">
        Players are reacting right now.
        <br />
        Results will appear here when the match ends.
      </p>
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function ResultsView({
  match,
  allParticipants,
  taps,
}: {
  match: FlashMatchesResponse;
  allParticipants: string[];
  taps: FlashMatchTapsPlayersResponse[];
}) {
  const navigate = useNavigate();
  const flashMomentMs = match.flashMomentMs as number;

  const playerResults = allParticipants.map((addr) => {
    const tap = taps?.find((t) => t.player === addr);
    const deltaMs = tap ? Math.abs(tap.tapTimeMs - flashMomentMs) : null;
    return {
      address: addr,
      deltaMs,
      isWinner: addr === match.winner,
      isSecond: addr === (match as any).secondPlace,
    };
  });

  playerResults.sort((a, b) => {
    if (a.deltaMs === null) return 1;
    if (b.deltaMs === null) return -1;
    return a.deltaMs - b.deltaMs;
  });

  // Estimate prize pool from player count
  const playerCount = match.playerCount as number;

  return (
    <div className="mt-4">
      <div className="text-center mb-6">
        <Badge
          className="text-xs tracking-widest mb-3"
          style={{
            background: 'hsl(160 100% 45% / 0.15)',
            color: 'hsl(160 100% 45%)',
            border: '1px solid hsl(160 100% 45% / 0.4)',
            fontFamily: "'Orbitron', sans-serif",
          }}
        >
          RESULTS
        </Badge>
        <h2
          className="text-3xl font-black"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            color: 'hsl(160 100% 45%)',
            textShadow: '0 0 30px hsl(160 100% 45% / 0.4)',
          }}
        >
          MATCH OVER
        </h2>
        {match.winner && (
          <p className="text-muted-foreground text-sm mt-2">
            Winner: <span className="font-bold text-foreground">{truncateAddress(match.winner)}</span>
          </p>
        )}
        {(match.winnerDeltaMs as number) > 0 && (
          <p
            className="font-black mt-1"
            style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(160 100% 45%)' }}
          >
            {match.winnerDeltaMs}ms reaction
          </p>
        )}
      </div>

      <div className="space-y-3 mb-8">
        {playerResults.map((p, i) => (
          <div
            key={p.address}
            className={`flex items-center gap-4 rounded-2xl p-4 border`}
            style={
              p.isWinner
                ? {
                    background: 'hsl(160 100% 45% / 0.08)',
                    border: '1px solid hsl(160 100% 45% / 0.5)',
                  }
                : p.isSecond
                  ? {
                      background: 'hsl(220 100% 65% / 0.06)',
                      border: '1px solid hsl(220 100% 65% / 0.4)',
                    }
                  : { borderColor: 'hsl(var(--border))' }
            }
          >
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center font-black text-lg`}
              style={{
                fontFamily: "'Orbitron', sans-serif",
                background: p.isWinner
                  ? 'hsl(160 100% 45% / 0.2)'
                  : p.isSecond
                    ? 'hsl(220 100% 65% / 0.15)'
                    : 'hsl(var(--muted) / 0.3)',
                color: p.isWinner
                  ? 'hsl(160 100% 45%)'
                  : p.isSecond
                    ? 'hsl(220 100% 65%)'
                    : 'hsl(var(--muted-foreground))',
              }}
            >
              {p.isWinner ? '🏆' : p.isSecond ? <Medal className="h-5 w-5" /> : i + 1}
            </div>

            <div className="flex-1">
              <div className="font-semibold text-sm">{truncateAddress(p.address)}</div>
              <div
                className="text-xs font-black"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  color: p.isWinner
                    ? 'hsl(160 100% 45%)'
                    : p.isSecond
                      ? 'hsl(220 100% 65%)'
                      : 'hsl(var(--muted-foreground))',
                }}
              >
                {p.deltaMs !== null ? `${p.deltaMs}ms` : 'NO TAP'}
              </div>
            </div>

            <div className="text-right">
              {p.isWinner && (
                <div
                  className="font-black text-sm"
                  style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(160 100% 45%)' }}
                >
                  WINNER
                </div>
              )}
              {p.isSecond && (
                <div
                  className="font-black text-sm"
                  style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(220 100% 65%)' }}
                >
                  2ND PLACE
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={() => navigate('/flashtap/new')}
        size="lg"
        className="w-full h-14 font-black tracking-widest rounded-2xl"
        style={{
          fontFamily: "'Orbitron', sans-serif",
          background: 'hsl(160 100% 45%)',
          color: '#000',
          boxShadow: '0 0 30px hsl(160 100% 45% / 0.4)',
        }}
      >
        <Trophy className="mr-2 h-5 w-5" />
        PLAY AGAIN
      </Button>
    </div>
  );
}

export default FlashTapLobby;
