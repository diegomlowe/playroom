import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";;
import { toast } from 'sonner';
import { PageLayout } from '@/components/poof-ui';
import { Particles } from '@/components/effects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Scissors, Trophy, XCircle } from 'lucide-react';
import WalletButton from '@/components/WalletButton';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import {
  subscribeRpsMatches,
  subscribeRpsMatchesRounds,
  updateRpsMatches,
  setRpsMatchesRounds,
  updateRpsMatchesRounds,
  deleteRpsMatches,
  RpsMatchesResponse,
  RpsMatchesRoundsResponse,
} from '@/lib/collections/rpsMatches';
import { Address, Increment, Time } from '@/lib/db-client';

const ACCENT = 'hsl(280 100% 65%)';
const COMMIT_SECS = 5;
const REVEAL_SECS = 5;

type Move = 'rock' | 'paper' | 'scissors';

const MOVE_EMOJI: Record<Move, string> = {
  rock: '🪨',
  paper: '📄',
  scissors: '✂️',
};

const MOVE_LABELS: Move[] = ['rock', 'paper', 'scissors'];

function solFromLamports(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(3);
}

function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function rpsWinner(a: Move, b: Move): 'a' | 'b' | 'draw' {
  if (a === b) return 'draw';
  if (
    (a === 'rock' && b === 'scissors') ||
    (a === 'scissors' && b === 'paper') ||
    (a === 'paper' && b === 'rock')
  ) {
    return 'a';
  }
  return 'b';
}

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Countdown Timer ─────────────────────────────────────────────────────────

function CountdownTimer({ seconds, total, color }: { seconds: number; total: number; color: string }) {
  const pct = (seconds / total) * 100;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
          <circle
            cx="28" cy="28" r="24"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 24}`}
            strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-black text-lg"
          style={{ fontFamily: "'Orbitron', sans-serif", color }}
        >
          {seconds}
        </div>
      </div>
    </div>
  );
}

// ─── Move Button ──────────────────────────────────────────────────────────────

function MoveButton({ move, onPick, picked, disabled }: {
  move: Move;
  onPick: (m: Move) => void;
  picked: boolean;
  disabled: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onPick(move)}
      disabled={disabled}
      className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: picked ? `${ACCENT}25` : `${ACCENT}08`,
        border: `2px solid ${picked ? ACCENT : ACCENT + '30'}`,
        boxShadow: picked ? `0 0 20px ${ACCENT}40` : 'none',
        minWidth: '90px',
      }}
    >
      <span className="text-4xl leading-none">{MOVE_EMOJI[move]}</span>
      <span
        className="text-[10px] font-black tracking-widest uppercase"
        style={{ fontFamily: "'Orbitron', sans-serif", color: picked ? ACCENT : 'hsl(var(--muted-foreground))' }}
      >
        {move}
      </span>
    </button>
  );
}

// ─── Main Match Screen ────────────────────────────────────────────────────────

export const RpsMatch: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Local commit-reveal state
  const [myMove, setMyMove] = useState<Move | null>(null);
  const [myNonce, setMyNonce] = useState<string | null>(null);
  const [commitTimer, setCommitTimer] = useState(COMMIT_SECS);
  const [revealTimer, setRevealTimer] = useState(REVEAL_SECS);
  const [hasCommitted, setHasCommitted] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(false);
  const [roundResultShown, setRoundResultShown] = useState(false);

  // Live clock (Unix seconds) — used for abandon countdown
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [abandoning, setAbandoning] = useState(false);

  // Prevent overlapping match-score updates
  const scoringInProgressRef = useRef(false);
  const processedRoundRef = useRef<number>(0);
  const phaseFlippedRef = useRef(false);
  const roundCompletedRef = useRef(false);
  const revealInProgressRef = useRef(false);

  // Timer start refs — track wall-clock start of each phase to prevent
  // stale-closure restarts when realtime data updates re-run effects
  const commitStartRef = useRef<number | null>(null);
  const revealStartRef = useRef<number | null>(null);

  const { data: match, loading: matchLoading } = useRealtimeData<RpsMatchesResponse | null>(
    subscribeRpsMatches,
    !!matchId,
    matchId!
  );

  const currentRound = match?.currentRound ?? 1;

  const { data: round } = useRealtimeData<RpsMatchesRoundsResponse | null>(
    subscribeRpsMatchesRounds,
    !!matchId && !!match && match.status === 'active',
    matchId!,
    String(currentRound)
  );

  const userAddress = user?.address;
  const isCreator = !!userAddress && userAddress === match?.creator;
  const isOpponent = !!userAddress && !!match?.opponent && userAddress === match?.opponent;
  const isParticipant = isCreator || isOpponent;

  // match-not-found is handled in the render below

  // ── Tick clock every second (for abandon countdown) ──────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Reset per-round local state when round advances ──────────────────────

  useEffect(() => {
    setMyMove(null);
    setMyNonce(null);
    setHasCommitted(false);
    setHasRevealed(false);
    setRoundResultShown(false);
    setCommitTimer(COMMIT_SECS);
    setRevealTimer(REVEAL_SECS);
    processedRoundRef.current = 0;
    phaseFlippedRef.current = false;
    roundCompletedRef.current = false;
    revealInProgressRef.current = false;
    // Reset timer start refs so the new round's timers start fresh
    commitStartRef.current = null;
    revealStartRef.current = null;
  }, [currentRound]);

  // ── Create round doc (creator only, once, when match goes active) ────────

  useEffect(() => {
    if (!match || match.status !== 'active' || !isCreator) return;
    if (round != null) return; // already exists
    setRpsMatchesRounds(matchId!, String(currentRound), {
      phase: 'committing',
      creatorMove: null as any,
      opponentMove: null as any,
      creatorNonce: null as any,
      opponentNonce: null as any,
      winner: null as any,
    });
  }, [match?.status, isCreator, round, matchId, currentRound]);

  // ── Commit-phase countdown (auto-pick if time runs out) ──────────────────
  // commitStartRef is declared above with the other refs.
  // The ref records the wall-clock start of the commit phase so that even when
  // the effect re-runs (e.g. because round data updated), the elapsed time is
  // computed from the original start — preventing the timer from resetting.

  useEffect(() => {
    if (!isParticipant) return;
    if (!round) return;
    if (round.phase !== 'committing') return;
    if (hasCommitted) return;

    // Record the commit phase start time only once
    if (commitStartRef.current === null) {
      commitStartRef.current = Date.now();
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - (commitStartRef.current ?? Date.now())) / 1000;
      const remaining = Math.max(0, COMMIT_SECS - Math.floor(elapsed));
      setCommitTimer(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
    // round?.phase is a dep so the timer starts when the round first becomes
    // 'committing'. The ref keeps the start time stable across re-runs.
  }, [round?.phase, hasCommitted, isParticipant]);

  // Auto-pick when timer hits 0
  useEffect(() => {
    if (!isParticipant) return;
    if (round?.phase !== 'committing') return;
    if (hasCommitted) return;
    if (commitTimer > 0) return;
    const randomMove = MOVE_LABELS[Math.floor(Math.random() * 3)];
    handleCommit(randomMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitTimer]);

  // ── Phase flip: committing → revealing (once both hashes present) ────────

  useEffect(() => {
    if (!match || !round) return;
    if (round.phase !== 'committing') return;
    if (!round.creatorCommitHash || !round.opponentCommitHash) return;
    if (!isCreator) return; // creator only flips phase
    if (phaseFlippedRef.current) return;
    phaseFlippedRef.current = true;
    updateRpsMatchesRounds(matchId!, String(currentRound), { phase: 'revealing' });
  }, [round?.phase, round?.creatorCommitHash, round?.opponentCommitHash, isCreator, matchId, currentRound]);

  // ── Reveal-phase countdown ───────────────────────────────────────────────

  useEffect(() => {
    if (!isParticipant) return;
    if (!round) return;
    if (round.phase !== 'revealing') return;
    if (hasRevealed) return;

    if (revealStartRef.current === null) {
      revealStartRef.current = Date.now();
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - (revealStartRef.current ?? Date.now())) / 1000;
      const remaining = Math.max(0, REVEAL_SECS - Math.floor(elapsed));
      setRevealTimer(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [round?.phase, hasRevealed, isParticipant]);

  // ── Auto-reveal when reveal phase starts ────────────────────────────────

  useEffect(() => {
    if (!isParticipant) return;
    if (round?.phase !== 'revealing') return;
    if (hasRevealed) return;
    if (!myMove || !myNonce) return;
    if (revealInProgressRef.current) return;
    revealInProgressRef.current = true;
    handleReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.phase]);

  // ── Effect A: Both revealed -> mark round complete ───────────────────────

  useEffect(() => {
    if (!isCreator) return;
    if (!round) return;
    if (round.id !== String(currentRound)) return;
    if (round.phase !== 'revealing') return;
    if (!round.creatorMove || !round.opponentMove) return;
    if (roundCompletedRef.current) return;
    roundCompletedRef.current = true;

    const result = rpsWinner(round.creatorMove as Move, round.opponentMove as Move);
    const roundWinner = result === 'draw' ? 'draw' : result === 'a' ? 'creator' : 'opponent';

    updateRpsMatchesRounds(matchId!, String(currentRound), {
      winner: roundWinner,
      phase: 'complete',
    });
  }, [round?.phase, round?.creatorMove, round?.opponentMove, matchId, currentRound]);

  // ── Effect B: Round complete -> update match scores ──────────────────────

  useEffect(() => {
    if (!match || !round) return;
    if (match.status !== 'active') return;
    if (round.phase !== 'complete') return;
    if (!round.creatorMove || !round.opponentMove) return;
    if (!isCreator) return;
    if (scoringInProgressRef.current) return;
    if (match.currentRound > currentRound) return;
    if (processedRoundRef.current >= currentRound) return;
    processedRoundRef.current = currentRound;

    scoringInProgressRef.current = true;

    const result = rpsWinner(round.creatorMove as Move, round.opponentMove as Move);
    const roundWinner = result === 'draw' ? 'draw' : result === 'a' ? 'creator' : 'opponent';

    const newCreatorWins = match.creatorWins + (roundWinner === 'creator' ? 1 : 0);
    const newOpponentWins = match.opponentWins + (roundWinner === 'opponent' ? 1 : 0);
    const newRound = currentRound + 1;
    const matchComplete = newCreatorWins >= 2 || newOpponentWins >= 2;

    (async () => {
      try {
        let ok: boolean;
        if (matchComplete) {
          const winnerAddr = newCreatorWins >= 2 ? match.creator : match.opponent;
          ok = await updateRpsMatches(matchId!, {
            // Preserved fields required by policy equality checks
            creator: Address.publicKey(match.creator),
            opponent: Address.publicKey(match.opponent),
            buyInLamports: match.buyInLamports as any,
            createdAt: match.createdAt as any,
            buyInCurrency: match.buyInCurrency,
            currentRound: match.currentRound as any,
            // lastActivityAt must be present and unchanged on the complete branch
            lastActivityAt: match.lastActivityAt as any,
            // Use absolute win counts — policy checks @newData.creatorWins == 2
            // and Increment.by deltas would fail that equality check
            creatorWins: newCreatorWins as any,
            opponentWins: newOpponentWins as any,
            status: 'complete',
            winner: Address.publicKey(winnerAddr),
          } as any);
        } else {
          ok = await updateRpsMatches(matchId!, {
            // Preserved fields required by policy equality checks
            creator: Address.publicKey(match.creator),
            opponent: Address.publicKey(match.opponent),
            buyInLamports: match.buyInLamports as any,
            createdAt: match.createdAt as any,
            buyInCurrency: match.buyInCurrency,
            // Changed fields
            creatorWins: Increment.by(roundWinner === 'creator' ? 1 : 0) as any,
            opponentWins: Increment.by(roundWinner === 'opponent' ? 1 : 0) as any,
            currentRound: newRound,
            lastActivityAt: Time.Now as any,
          });
        }
        if (!ok) {
          toast.error('Failed to update match scores');
          processedRoundRef.current = 0;
        }
      } catch (err) {
        console.error('Score update error:', err);
        toast.error('Failed to update match scores');
        processedRoundRef.current = 0;
      } finally {
        scoringInProgressRef.current = false;
      }
    })();
  }, [
    match?.status,
    match?.currentRound,
    match?.creatorWins,
    match?.opponentWins,
    match?.creator,
    match?.opponent,
    match?.lastActivityAt,
    match?.buyInLamports,
    match?.buyInCurrency,
    match?.createdAt,
    round?.phase,
    round?.creatorMove,
    round?.opponentMove,
    round?.winner,
    matchId,
    currentRound,
    isCreator,
  ]);

  // ── Show round result for 3s ─────────────────────────────────────────────

  useEffect(() => {
    if (round?.phase !== 'complete') return;
    if (roundResultShown) return;
    setRoundResultShown(true);
  }, [round?.phase]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCommit = useCallback(async (move: Move) => {
    if (!matchId || !userAddress || hasCommitted) return;
    const nonce = crypto.randomUUID();
    const hash = await sha256Hex(`${move}:${nonce}`);

    setMyMove(move);
    setMyNonce(nonce);
    setHasCommitted(true);

    const update = isCreator
      ? { creatorCommitHash: hash }
      : { opponentCommitHash: hash };

    const ok = await updateRpsMatchesRounds(matchId, String(currentRound), update);
    if (!ok) {
      toast.error('Failed to commit move');
      setHasCommitted(false);
    }
  }, [matchId, userAddress, hasCommitted, isCreator, currentRound]);

  const handleReveal = useCallback(async () => {
    if (!matchId || !myMove || !myNonce || hasRevealed) return;
    setHasRevealed(true);

    const update = isCreator
      ? { creatorMove: myMove, creatorNonce: myNonce }
      : { opponentMove: myMove, opponentNonce: myNonce };

    const ok = await updateRpsMatchesRounds(matchId, String(currentRound), update);
    if (!ok) {
      toast.error('Failed to reveal move');
      setHasRevealed(false);
    }
  }, [matchId, myMove, myNonce, hasRevealed, isCreator, currentRound]);

  // ── Abandon handler ──────────────────────────────────────────────────────

  const handleAbandon = useCallback(async () => {
    if (!match || !matchId || abandoning) return;
    setAbandoning(true);
    try {
      const ok = await updateRpsMatches(matchId, {
        status: 'abandoned',
        winner: null as any,
        creator: Address.publicKey(match.creator),
        opponent: Address.publicKey(match.opponent),
        buyInLamports: match.buyInLamports as any,
        buyInCurrency: match.buyInCurrency,
        createdAt: match.createdAt as any,
        lastActivityAt: match.lastActivityAt as any,
        currentRound: match.currentRound as any,
        creatorWins: match.creatorWins as any,
        opponentWins: match.opponentWins as any,
      });
      if (ok) {
        toast.success('Match abandoned — both players will be refunded');
        navigate('/rps');
      } else {
        toast.error('Failed to abandon — timeout may not have elapsed yet');
      }
    } catch {
      toast.error('Error abandoning match');
    } finally {
      setAbandoning(false);
    }
  }, [match, matchId, abandoning, navigate]);

  // ── Loading state ────────────────────────────────────────────────────────

  if (!match) {
    return (
      <PageLayout fullBleed footer={false}>
        <div className="relative min-h-screen flex items-center justify-center">
          <Particles quantity={30} color={ACCENT} />
          <div className="relative z-10 text-center">
            {matchLoading ? (
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
                  <Scissors className="h-10 w-10" style={{ color: ACCENT }} />
                </div>
                <h2
                  className="text-2xl font-black"
                  style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
                >
                  Match Not Found
                </h2>
                <p className="text-sm text-muted-foreground text-center max-w-[240px]">
                  This match doesn't exist or has already ended.
                </p>
                <Button
                  onClick={() => navigate('/rps')}
                  className="h-11 px-6 font-black tracking-widest"
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    background: `linear-gradient(135deg, ${ACCENT}, hsl(260 100% 55%))`,
                    color: '#fff',
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

  // ── Derived values ────────────────────────────────────────────────────────

  const buyInLamportsSafe = match.buyInLamports ?? 0;
  const buyInSol = solFromLamports(buyInLamportsSafe);
  const potSol = solFromLamports(buyInLamportsSafe * 2);
  const payoutSol = parseFloat((buyInLamportsSafe * 2 * 0.99 / 1_000_000_000).toFixed(4)).toString();

  const iAmWinner = userAddress && match.winner === userAddress;
  const iAmLoser = isParticipant && match.status === 'complete' && !iAmWinner;

  const myScore = isCreator ? match.creatorWins : match.opponentWins;
  const theirScore = isCreator ? match.opponentWins : match.creatorWins;

  const roundPhase = round?.phase ?? 'loading';
  const bothCommitted = !!(round?.creatorCommitHash && round?.opponentCommitHash);
  const bothRevealed = !!(round?.creatorMove && round?.opponentMove);

  // Decide whose move to display during result
  const creatorMoveDisplay = round?.creatorMove as Move | undefined;
  const opponentMoveDisplay = round?.opponentMove as Move | undefined;
  const myMoveDisplay = isCreator ? creatorMoveDisplay : opponentMoveDisplay;
  const theirMoveDisplay = isCreator ? opponentMoveDisplay : creatorMoveDisplay;

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
            onClick={() => navigate('/rps')}
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
            RPS
          </div>
          <div className="w-16 flex justify-end">
            {!user && <WalletButton />}
          </div>
        </header>

        <main className="relative z-10 flex-1 px-4 pb-10 flex flex-col items-center max-w-sm mx-auto w-full">
          {/* Pot + buy-in badges */}
          <div className="flex items-center gap-2 mt-4 mb-6">
            <Badge
              className="text-xs px-3 py-1 font-black tracking-widest"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                background: `${ACCENT}20`,
                color: ACCENT,
                border: `1px solid ${ACCENT}40`,
              }}
            >
              {buyInSol} SOL BUY-IN
            </Badge>
            <Badge
              className="text-xs px-3 py-1 font-black tracking-widest"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                background: 'hsl(var(--muted) / 0.3)',
                color: 'hsl(var(--muted-foreground))',
                border: '1px solid hsl(var(--border))',
              }}
            >
              POT: {potSol} SOL
            </Badge>
          </div>

          {/* ── COMPLETE SCREEN ─────────────────────────────────────────── */}
          {match.status === 'complete' && (
            <div className="w-full flex flex-col items-center">
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center mb-6"
                style={{
                  background: iAmWinner ? 'hsl(160 100% 45% / 0.15)' : 'hsl(var(--muted) / 0.2)',
                  border: `3px solid ${iAmWinner ? 'hsl(160 100% 45%)' : 'hsl(var(--border))'}`,
                  boxShadow: iAmWinner ? '0 0 40px hsl(160 100% 45% / 0.4)' : 'none',
                }}
              >
                {iAmWinner
                  ? <Trophy className="h-12 w-12" style={{ color: 'hsl(160 100% 45%)' }} />
                  : <Scissors className="h-12 w-12 text-muted-foreground" />
                }
              </div>

              {isParticipant && (
                <h2
                  className="text-4xl font-black mb-2 text-center"
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    color: iAmWinner ? 'hsl(160 100% 45%)' : 'hsl(var(--muted-foreground))',
                    textShadow: iAmWinner ? '0 0 30px hsl(160 100% 45% / 0.5)' : 'none',
                  }}
                >
                  {iAmWinner ? 'YOU WON!' : 'YOU LOST'}
                </h2>
              )}

              <div className="text-sm text-muted-foreground text-center mb-2">
                Final Score:{' '}
                <span className="font-bold text-foreground">
                  {match.creatorWins} – {match.opponentWins}
                </span>
              </div>

              {iAmWinner && (
                <p className="text-sm text-muted-foreground mb-6">
                  Payout: <span className="font-black text-foreground">{payoutSol} SOL</span>
                </p>
              )}

              <div className="w-full space-y-3 mt-4">
                <Button
                  onClick={() => navigate('/rps')}
                  className="w-full h-12 font-black tracking-widest rounded-2xl"
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    background: `linear-gradient(135deg, ${ACCENT}, hsl(260 100% 55%))`,
                    color: '#fff',
                    boxShadow: `0 0 20px ${ACCENT}40`,
                  }}
                >
                  <Scissors className="mr-2 h-4 w-4" />
                  PLAY AGAIN
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  variant="ghost"
                  className="w-full h-10 font-bold tracking-widest text-muted-foreground hover:text-foreground"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  HOME
                </Button>
              </div>
            </div>
          )}

          {/* ── ABANDONED SCREEN ────────────────────────────────────────── */}
          {match.status === 'abandoned' && (
            <div className="w-full flex flex-col items-center">
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center mb-6"
                style={{
                  background: 'hsl(0 80% 45% / 0.12)',
                  border: '3px solid hsl(0 80% 55% / 0.5)',
                }}
              >
                <XCircle className="h-12 w-12" style={{ color: 'hsl(0 80% 55%)' }} />
              </div>

              <h2
                className="text-3xl font-black mb-2 text-center"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  color: 'hsl(0 80% 60%)',
                }}
              >
                ABANDONED
              </h2>

              <p className="text-sm text-muted-foreground text-center mb-2 max-w-[220px]">
                This match timed out. Both players have been refunded their buy-in.
              </p>

              <div className="text-sm text-muted-foreground text-center mb-6">
                Score at abandonment:{' '}
                <span className="font-bold text-foreground">
                  {match.creatorWins} – {match.opponentWins}
                </span>
              </div>

              <div className="w-full space-y-3 mt-2">
                <Button
                  onClick={() => navigate('/rps')}
                  className="w-full h-12 font-black tracking-widest rounded-2xl"
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    background: `linear-gradient(135deg, ${ACCENT}, hsl(260 100% 55%))`,
                    color: '#fff',
                    boxShadow: `0 0 20px ${ACCENT}40`,
                  }}
                >
                  <Scissors className="mr-2 h-4 w-4" />
                  BACK TO LOBBY
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  variant="ghost"
                  className="w-full h-10 font-bold tracking-widest text-muted-foreground hover:text-foreground"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  HOME
                </Button>
              </div>
            </div>
          )}

          {/* ── WAITING SCREEN ──────────────────────────────────────────── */}
          {match.status === 'waiting' && (
            <div className="w-full flex flex-col items-center text-center">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-pulse"
                style={{
                  background: `${ACCENT}15`,
                  border: `3px solid ${ACCENT}40`,
                  boxShadow: `0 0 40px ${ACCENT}20`,
                }}
              >
                <Scissors className="h-12 w-12" style={{ color: ACCENT }} />
              </div>
              <h2
                className="text-2xl font-black mb-2"
                style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
              >
                Waiting for Opponent
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Share this match or wait for someone to join from the lobby.
              </p>
              <Button
                onClick={() => navigate('/rps')}
                variant="secondary"
                className="h-10 font-bold tracking-widest"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                BACK TO LOBBY
              </Button>
            </div>
          )}

          {/* ── ACTIVE MATCH ────────────────────────────────────────────── */}
          {match.status === 'active' && (
            <div className="w-full flex flex-col items-center">
              {/* Score */}
              <div className="flex items-center gap-6 mb-4">
                <div className="text-center">
                  <div
                    className="text-4xl font-black"
                    style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
                  >
                    {myScore}
                  </div>
                  <div className="text-[10px] text-muted-foreground tracking-widest uppercase">You</div>
                </div>
                <div
                  className="text-muted-foreground font-black text-xl"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  –
                </div>
                <div className="text-center">
                  <div
                    className="text-4xl font-black"
                    style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(var(--muted-foreground))' }}
                  >
                    {theirScore}
                  </div>
                  <div className="text-[10px] text-muted-foreground tracking-widest uppercase">Opponent</div>
                </div>
              </div>

              {/* Round indicator */}
              <div className="text-[11px] text-muted-foreground tracking-widest uppercase mb-5 flex items-center gap-1.5">
                <span
                  className="font-black"
                  style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
                >
                  Round {currentRound}
                </span>
                <span>of best-of-3</span>
              </div>

              {/* Players */}
              <div className="grid grid-cols-2 gap-3 w-full mb-6">
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}25` }}
                >
                  <div className="text-[10px] text-muted-foreground mb-0.5">Creator</div>
                  <div className="text-xs font-bold">{truncateAddress(match.creator)}</div>
                  {isCreator && (
                    <div
                      className="text-[9px] tracking-widest mt-0.5"
                      style={{ color: ACCENT, fontFamily: "'Orbitron', sans-serif" }}
                    >
                      (you)
                    </div>
                  )}
                </div>
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ background: 'hsl(var(--card) / 0.6)', border: '1px solid hsl(var(--border))' }}
                >
                  <div className="text-[10px] text-muted-foreground mb-0.5">Opponent</div>
                  <div className="text-xs font-bold">{truncateAddress(match.opponent)}</div>
                  {isOpponent && (
                    <div
                      className="text-[9px] tracking-widest mt-0.5"
                      style={{ color: ACCENT, fontFamily: "'Orbitron', sans-serif" }}
                    >
                      (you)
                    </div>
                  )}
                </div>
              </div>

              {/* LOADING PHASE */}
              {roundPhase === 'loading' && (
                <div className="w-full flex flex-col items-center gap-4 py-8">
                  <div
                    className="w-12 h-12 rounded-full border-2 animate-spin"
                    style={{ borderColor: `${ACCENT}40`, borderTopColor: ACCENT }}
                  />
                  <p
                    className="text-sm font-bold tracking-widest uppercase animate-pulse"
                    style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
                  >
                    Loading Round...
                  </p>
                </div>
              )}

              {/* COMMITTING PHASE */}
              {roundPhase === 'committing' && isParticipant && (
                <div className="w-full flex flex-col items-center gap-5">
                  <CountdownTimer seconds={commitTimer} total={COMMIT_SECS} color={ACCENT} />
                  {!hasCommitted ? (
                    <>
                      <p
                        className="text-sm font-bold tracking-widest uppercase text-center"
                        style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
                      >
                        Pick Your Move
                      </p>
                      <div className="flex gap-3 justify-center">
                        {MOVE_LABELS.map((m) => (
                          <MoveButton
                            key={m}
                            move={m}
                            onPick={handleCommit}
                            picked={myMove === m}
                            disabled={hasCommitted}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl">{myMove ? MOVE_EMOJI[myMove] : '?'}</span>
                      <p
                        className="text-sm font-bold tracking-widest uppercase animate-pulse"
                        style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
                      >
                        Move Committed
                      </p>
                      <p className="text-xs text-muted-foreground text-center">
                        Waiting for opponent to commit...
                        {bothCommitted && ' Done!'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {roundPhase === 'committing' && !isParticipant && (
                <p className="text-sm text-muted-foreground text-center animate-pulse">
                  Players are committing moves...
                </p>
              )}

              {/* REVEALING PHASE */}
              {roundPhase === 'revealing' && (
                <div className="w-full flex flex-col items-center gap-4">
                  <CountdownTimer seconds={revealTimer} total={REVEAL_SECS} color="hsl(160 100% 45%)" />
                  <p
                    className="text-sm font-bold tracking-widest uppercase animate-pulse"
                    style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(160 100% 45%)' }}
                  >
                    Revealing...
                  </p>
                  {!bothRevealed && (
                    <p className="text-xs text-muted-foreground text-center">Waiting for both reveals...</p>
                  )}
                </div>
              )}

              {/* ROUND RESULT (phase=complete, before next round doc lands) */}
              {roundPhase === 'complete' && round && (
                <div className="w-full flex flex-col items-center gap-4">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-5xl">{myMoveDisplay ? MOVE_EMOJI[myMoveDisplay] : '?'}</span>
                      <span
                        className="text-[10px] tracking-widest uppercase font-bold"
                        style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
                      >
                        You
                      </span>
                    </div>
                    <div
                      className="text-xl font-black text-muted-foreground"
                      style={{ fontFamily: "'Orbitron', sans-serif" }}
                    >
                      VS
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-5xl">{theirMoveDisplay ? MOVE_EMOJI[theirMoveDisplay] : '?'}</span>
                      <span
                        className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground"
                        style={{ fontFamily: "'Orbitron', sans-serif" }}
                      >
                        Them
                      </span>
                    </div>
                  </div>

                  {round.winner && (
                    <div>
                      {round.winner === 'draw' ? (
                        <Badge
                          className="text-sm px-4 py-1 font-black tracking-widest"
                          style={{
                            fontFamily: "'Orbitron', sans-serif",
                            background: 'hsl(var(--muted)/0.3)',
                            color: 'hsl(var(--muted-foreground))',
                          }}
                        >
                          DRAW
                        </Badge>
                      ) : (
                        <Badge
                          className="text-sm px-4 py-1 font-black tracking-widest"
                          style={{
                            fontFamily: "'Orbitron', sans-serif",
                            background: (isCreator && round.winner === 'creator') || (isOpponent && round.winner === 'opponent')
                              ? 'hsl(160 100% 45% / 0.2)'
                              : 'hsl(0 100% 55% / 0.15)',
                            color: (isCreator && round.winner === 'creator') || (isOpponent && round.winner === 'opponent')
                              ? 'hsl(160 100% 45%)'
                              : 'hsl(0 100% 65%)',
                          }}
                        >
                          {(isCreator && round.winner === 'creator') || (isOpponent && round.winner === 'opponent')
                            ? 'YOU WIN THIS ROUND'
                            : 'THEY WIN THIS ROUND'}
                        </Badge>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground animate-pulse">Next round starting...</p>
                </div>
              )}

              {/* Spectator view when not a participant */}
              {!isParticipant && (
                <div className="flex flex-col items-center gap-3 mt-2">
                  <p className="text-sm text-muted-foreground text-center">
                    Spectating this match.
                  </p>
                  <Button
                    onClick={() => navigate('/rps')}
                    variant="ghost"
                    className="font-bold tracking-widest"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    LOBBY
                  </Button>
                </div>
              )}

              {/* Abandon UI — only when lastActivityAt is present (new matches) */}
              {match.lastActivityAt != null && user && (() => {
                const abandonAt = match.lastActivityAt + 600;
                const canAbandon = now >= abandonAt;
                const secsLeft = Math.max(0, abandonAt - now);
                const minsLeft = Math.floor(secsLeft / 60);
                const sLeft = secsLeft % 60;
                return (
                  <div className="mt-6 w-full">
                    {!canAbandon ? (
                      <p
                        className="text-center text-[10px] text-muted-foreground tracking-wider"
                        style={{ fontFamily: "'Orbitron', sans-serif" }}
                      >
                        Abandon available in {minsLeft}m {sLeft}s
                      </p>
                    ) : (
                      <Button
                        onClick={handleAbandon}
                        disabled={abandoning}
                        variant="ghost"
                        className="w-full h-10 font-bold tracking-widest text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40"
                        style={{ fontFamily: "'Orbitron', sans-serif" }}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {abandoning ? 'ABANDONING...' : 'ABANDON MATCH (REFUND BOTH PLAYERS)'}
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Cancel button — creator, waiting, no opponent (outside active block) */}
          {match.status === 'waiting' && !match.opponent && isCreator && (
            <Button
              onClick={async () => {
                const ok = await deleteRpsMatches(matchId!);
                if (ok) {
                  toast.success('Match cancelled — buy-in refunded');
                  navigate('/rps');
                } else {
                  toast.error('Failed to cancel match');
                }
              }}
              variant="ghost"
              className="mt-4 w-full h-10 font-bold tracking-widest text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              <XCircle className="mr-2 h-4 w-4" />
              CANCEL MATCH
            </Button>
          )}
        </main>
      </div>
    </PageLayout>
  );
};

export default RpsMatch;
