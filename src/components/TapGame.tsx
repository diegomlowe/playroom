import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { getIdToken } from '@pooflabs/web';
import { toast } from 'sonner';
import { setGameSubmissionsPlayers } from '@/lib/collections/gameSubmissions';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { Address, Time } from '@/lib/db-client';
import { Zap } from 'lucide-react';

interface TapGameProps {
  gameId: string;
  startedAt: number; // unix seconds from server
  onFinalized: () => void;
}

const GAME_DURATION = 10; // seconds
const COUNTDOWN_SECONDS = 3;

type Phase = 'countdown' | 'tapping' | 'submitting' | 'waiting';

export const TapGame: React.FC<TapGameProps> = ({ gameId, startedAt, onFinalized }) => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [tapCount, setTapCount] = useState(0);
  const tapCountRef = useRef(0);
  const submittedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tapBtnRef = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  let rippleCounter = useRef(0);

  // Determine phase from real startedAt
  useEffect(() => {
    if (!startedAt || startedAt === 0) return;
    const nowSec = Date.now() / 1000;
    const elapsed = nowSec - startedAt;

    if (elapsed < 0) {
      // Future start — wait
      setPhase('countdown');
      return;
    }

    const remaining = GAME_DURATION - elapsed;
    if (remaining > 0) {
      // Game is mid-flight
      setPhase('tapping');
      setTimeLeft(Math.ceil(remaining));
      startTapTimer(remaining);
    } else {
      // Game already ended
      setPhase('submitting');
      submitAndFinalize(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);

  // Countdown phase
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      setPhase('tapping');
      startTapTimer(GAME_DURATION);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  function startTapTimer(duration: number) {
    const end = Date.now() + duration * 1000;
    timerRef.current = setInterval(() => {
      const remaining = (end - Date.now()) / 1000;
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        setTimeLeft(0);
        setPhase('submitting');
        submitAndFinalize(tapCountRef.current);
      } else {
        setTimeLeft(Math.ceil(remaining));
      }
    }, 100);
  }

  const submitAndFinalize = useCallback(
    async (count: number) => {
      if (submittedRef.current || !user) return;
      submittedRef.current = true;

      // Submit tap count
      const submitted = await setGameSubmissionsPlayers(gameId, user.address, {
        gameId,
        player: Address.publicKey(user.address),
        tapCount: count,
        submittedAt: Time.Now as any,
      });

      if (!submitted) {
        // May already be submitted (immutable) — continue to finalize
      }

      // Call backend to finalize
      try {
        const token = await getIdToken();
        if (token) {
          const authApi = createAuthenticatedApiClient(token, user.address);
          await authApi.post(`/api/games/${gameId}/finalize`);
        }
      } catch {
        // Will be retried by other players
      }

      setPhase('waiting');
      onFinalized();
    },
    [gameId, user, onFinalized]
  );

  function handleTap(e: React.PointerEvent<HTMLButtonElement>) {
    if (phase !== 'tapping') return;

    // Haptic feedback (Solana Seeker supports vibrate)
    if (navigator.vibrate) navigator.vibrate(8);

    tapCountRef.current += 1;
    setTapCount((c) => c + 1);

    // Ripple effect
    const rect = tapBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = rippleCounter.current++;
      setRipples((r) => [...r, { id, x, y }]);
      setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 600);
    }
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (phase === 'countdown') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <p
          className="text-muted-foreground text-sm tracking-widest uppercase"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          GET READY
        </p>
        <div
          className="text-[8rem] font-black leading-none gradient-text animate-pulse"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          {countdown === 0 ? 'TAP!' : countdown}
        </div>
        <p className="text-muted-foreground text-sm">Starting in {countdown}...</p>
      </div>
    );
  }

  if (phase === 'submitting' || phase === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div
          className="text-6xl font-black gradient-text"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          {tapCount}
        </div>
        <p className="text-muted-foreground tracking-widest text-sm uppercase">TAPS</p>
        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="h-1 w-32 bg-primary/20 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-primary rounded-full animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm tracking-widest">
            {phase === 'submitting' ? 'SUBMITTING...' : 'CALCULATING RESULTS...'}
          </p>
        </div>
      </div>
    );
  }

  // Tapping phase
  const progressPct = ((GAME_DURATION - timeLeft) / GAME_DURATION) * 100;
  const urgency = timeLeft <= 3;

  return (
    <div className="flex flex-col items-center gap-6 pt-4">
      {/* Timer */}
      <div className="w-full px-4">
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-3xl font-black ${urgency ? 'text-destructive animate-pulse' : 'text-accent'}`}
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            {timeLeft}s
          </span>
          <span
            className="text-4xl font-black gradient-text"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            {tapCount}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-100 ${
              urgency ? 'bg-destructive' : 'bg-primary'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">TIME</span>
          <span className="text-xs text-muted-foreground">TAPS</span>
        </div>
      </div>

      {/* Big TAP button */}
      <div className="relative w-72 h-72">
        <button
          ref={tapBtnRef}
          onPointerDown={handleTap}
          className={`relative w-full h-full rounded-full select-none touch-none overflow-hidden
            flex items-center justify-center flex-col gap-2
            transition-transform active:scale-95
            ${
              urgency
                ? 'bg-destructive/20 border-4 border-destructive shadow-[0_0_60px_rgba(239,68,68,0.5)]'
                : 'bg-primary/20 border-4 border-primary shadow-[0_0_60px_rgba(168,85,247,0.5)]'
            }
          `}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {/* Ripples */}
          {ripples.map((rp) => (
            <span
              key={rp.id}
              className="absolute rounded-full bg-white/20 animate-ping pointer-events-none"
              style={{
                width: 60,
                height: 60,
                left: rp.x - 30,
                top: rp.y - 30,
              }}
            />
          ))}

          <Zap
            className={`h-16 w-16 ${urgency ? 'text-destructive' : 'text-primary'}`}
            strokeWidth={2.5}
          />
          <span
            className={`text-2xl font-black tracking-widest ${urgency ? 'text-destructive' : 'text-primary'}`}
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            TAP!
          </span>
        </button>
      </div>

      {urgency && (
        <p
          className="text-destructive font-black tracking-widest text-lg animate-pulse"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          FASTER! FASTER!
        </p>
      )}
    </div>
  );
};

export default TapGame;
