import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";;
import { toast } from 'sonner';
import { PageLayout } from '@/components/poof-ui';
import { Particles } from '@/components/effects';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Sparkles, Trophy, RotateCcw, Clock, Shield, Coins } from 'lucide-react';
import WalletButton from '@/components/WalletButton';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import {
  subscribeDailySpins,
  DailySpinsResponse,
} from '@/lib/collections/dailySpins';
import { subscribeDailySpinPool, DailySpinPoolResponse } from '@/lib/collections/dailySpinPool';
import { setSeedSpinPool } from '@/lib/collections/seedSpinPool';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { ADMIN_ADDRESS } from '@/lib/constants';
import { Time, Address } from '@/lib/db-client';
import confetti from 'canvas-confetti';

const ACCENT_GOLD = 'hsl(45 100% 60%)';
const WHEEL_SIZE = 320;

interface Segment {
  amount: number;
  label: string;
  weight: number;
  color: string;
  borderColor: string;
}

// Exact prize tiers:
// 40% → 0 MNY (loss)
// 30% → 0.1 MNY
// 20% → 0.5 MNY
//  9% → 1 MNY
// 0.9% → 5 MNY
// 0.1% → 10 MNY
const SEGMENTS: Segment[] = [
  { amount: 0,   label: '0',    weight: 0.40,  color: 'hsl(265 30% 12%)', borderColor: 'hsl(265 30% 20%)' },
  { amount: 0.1, label: '0.1',  weight: 0.30,  color: 'hsl(265 45% 15%)', borderColor: 'hsl(265 45% 23%)' },
  { amount: 0.5, label: '0.5',  weight: 0.20,  color: 'hsl(45 55% 18%)',  borderColor: 'hsl(45 55% 27%)'  },
  { amount: 1,   label: '1',    weight: 0.09,  color: 'hsl(45 75% 22%)',  borderColor: 'hsl(45 75% 32%)'  },
  { amount: 5,   label: '5',    weight: 0.009, color: 'hsl(45 90% 26%)',  borderColor: 'hsl(45 90% 36%)'  },
  { amount: 10,  label: '10',   weight: 0.001, color: 'hsl(45 100% 30%)', borderColor: 'hsl(45 100% 42%)' },
];

// Shuffle display order so prizes don't appear in sequence around the wheel
(function shuffleSegments() {
  for (let i = SEGMENTS.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [SEGMENTS[i], SEGMENTS[j]] = [SEGMENTS[j], SEGMENTS[i]];
  }
})();

const SEGMENT_ANGLE = 360 / SEGMENTS.length; // 60deg


function formatCooldown(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// ─── Wheel Segment Labels ───────────────────────────────────────────────────

function WheelLabels() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {SEGMENTS.map((seg, i) => {
        const angle = i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
        const rad = (angle * Math.PI) / 180;
        const radius = WHEEL_SIZE * 0.32;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        return (
          <div
            key={i}
            className="absolute flex flex-col items-center justify-center"
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
              width: 60,
            }}
          >
            <span
              className="text-xs font-black tracking-wider leading-none"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                color: seg.amount >= 5 ? ACCENT_GOLD : 'hsl(var(--foreground))',
                textShadow: seg.amount >= 5 ? `0 0 8px ${ACCENT_GOLD}80` : 'none',
              }}
            >
              {seg.label}
            </span>
            <span className="text-[9px] text-muted-foreground font-semibold">MNY</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Spin Wheel Component ───────────────────────────────────────────────────

function SpinWheel({
  rotation,
  spinning,
}: {
  rotation: number;
  spinning: boolean;
}) {
  const gradientStops = useMemo(() => {
    return SEGMENTS.map((seg, i) => {
      const start = i * SEGMENT_ANGLE;
      const end = (i + 1) * SEGMENT_ANGLE;
      return `${seg.color} ${start}deg ${end}deg`;
    }).join(', ');
  }, []);

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: WHEEL_SIZE + 16,
          height: WHEEL_SIZE + 16,
          background: `radial-gradient(circle, ${ACCENT_GOLD}15 0%, transparent 70%)`,
          boxShadow: `0 0 40px ${ACCENT_GOLD}20, inset 0 0 20px ${ACCENT_GOLD}10`,
        }}
      />

      {/* Pointer / indicator at top */}
      <div
        className="absolute z-20"
        style={{
          top: -12,
          width: 0,
          height: 0,
          borderLeft: '12px solid transparent',
          borderRight: '12px solid transparent',
          borderTop: `18px solid ${ACCENT_GOLD}`,
          filter: `drop-shadow(0 0 6px ${ACCENT_GOLD})`,
        }}
      />

      {/* The wheel */}
      <div
        className="relative rounded-full border-4"
        style={{
          width: WHEEL_SIZE,
          height: WHEEL_SIZE,
          background: `conic-gradient(from -90deg, ${gradientStops})`,
          borderColor: `${ACCENT_GOLD}40`,
          boxShadow: `0 0 30px ${ACCENT_GOLD}15, inset 0 0 40px rgba(0,0,0,0.5)`,
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? 'transform 4s cubic-bezier(0.15, 0, 0.15, 1)'
            : 'transform 0.3s ease-out',
        }}
      >
        {/* Segment divider lines */}
        {SEGMENTS.map((_, i) => {
          const angle = i * SEGMENT_ANGLE;
          return (
            <div
              key={i}
              className="absolute left-1/2 top-0 origin-bottom"
              style={{
                width: 1,
                height: '50%',
                background: `${ACCENT_GOLD}30`,
                transform: `translateX(-50%) rotate(${angle}deg)`,
              }}
            />
          );
        })}

        {/* Center hub */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center z-10"
          style={{
            width: 72,
            height: 72,
            background: 'hsl(var(--card))',
            border: `2px solid ${ACCENT_GOLD}50`,
            boxShadow: `0 0 20px ${ACCENT_GOLD}30`,
          }}
        >
          <Sparkles className="h-5 w-5" style={{ color: ACCENT_GOLD }} />
        </div>

        <WheelLabels />
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export const DailySpinPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [wonAmount, setWonAmount] = useState<number | null>(null);
  const [spinResult, setSpinResult] = useState<'idle' | 'win' | 'bigwin' | 'nowin'>('idle');
  const [showBigWinFlash, setShowBigWinFlash] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [fundAmount, setFundAmount] = useState('');
  const [funding, setFunding] = useState(false);
  const mountedRef = useRef(true);
  const resultAmountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const userAddress = user?.address ?? '';
  const isAdmin = userAddress === ADMIN_ADDRESS;

  const { data: spinRecord } = useRealtimeData<DailySpinsResponse | null>(
    subscribeDailySpins,
    !!userAddress,
    userAddress
  );

  const { data: poolData } = useRealtimeData<DailySpinPoolResponse | null>(
    subscribeDailySpinPool,
    true,
    'main'
  );

  // Cooldown countdown timer — tick every second and auto-enable the button
  // the moment the 24h window elapses. The interval stores a ref to itself
  // so it can self-clear when remaining reaches 0.
  useEffect(() => {
    if (!spinRecord?.lastSpinAt) {
      setCooldownRemaining(0);
      return;
    }

    const computeRemaining = () => {
      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, 86400 - (now - spinRecord.lastSpinAt));
    };

    // Set immediately so there's no 1-second blank gap on mount
    const initial = computeRemaining();
    setCooldownRemaining(initial);

    // If the cooldown is already expired, no interval needed
    if (initial === 0) return;

    const intervalId = setInterval(() => {
      const remaining = computeRemaining();
      setCooldownRemaining(remaining);
      // Self-clear once expired so we stop ticking and re-enable the button
      if (remaining === 0) {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [spinRecord?.lastSpinAt]);

  const fireConfetti = useCallback((isBigWin: boolean) => {
    const count = isBigWin ? 6 : 3;
    const particleCount = isBigWin ? 120 : 60;
    const spread = isBigWin ? 90 : 60;
    const colors = ['#FFD700', '#FFA500', '#FF6B6B', '#C0A0FF', '#7BFFB0'];

    const fire = (origin: { x: number; y: number }) => {
      confetti({
        particleCount,
        spread,
        origin,
        colors,
        scalar: isBigWin ? 1.3 : 1.0,
        gravity: 0.9,
        ticks: isBigWin ? 280 : 180,
        zIndex: 9999,
        disableForReducedMotion: true,
      });
    };

    // Always fire from center-top
    fire({ x: 0.5, y: 0.3 });

    if (isBigWin) {
      // Additional bursts from sides for big win
      for (let i = 1; i < count; i++) {
        setTimeout(() => {
          fire({ x: i % 2 === 0 ? 0.2 : 0.8, y: 0.4 });
        }, i * 220);
      }
    }
  }, []);

  const handleSpin = useCallback(async () => {
    if (!user || spinning) return;
    const walletAddress = user.address;
    if (!walletAddress) return;

    // Double-check cooldown
    if (spinRecord?.lastSpinAt) {
      const now = Math.floor(Date.now() / 1000);
      if (now - spinRecord.lastSpinAt < 86400) {
        toast.error('Daily spin already used. Come back tomorrow!');
        return;
      }
    }

    setSpinning(true);
    setWonAmount(null);
    setSpinResult('idle');
    setShowBigWinFlash(false);

    // ── STEP 1: Call the server FIRST to get the authoritative prize ──────────
    // This ensures the wheel lands on the segment that matches what the server
    // actually awarded. The server call is fast (~200ms) and starts a brief
    // "calling server..." phase before the wheel moves.
    let serverPrize = 0;
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error('Authentication required. Please reconnect your wallet.');
        setSpinning(false);
        return;
      }
      const authApi = createAuthenticatedApiClient(token, walletAddress ?? '');
      const result = await authApi.post<{ prize: number }>('/api/daily-spin');
      serverPrize = result.prize;
    } catch (err: any) {
      if (!mountedRef.current) return;
      toast.error(err?.message || 'Failed to spin. Please try again.');
      setSpinning(false);
      return;
    }

    if (!mountedRef.current) return;

    // ── STEP 2: Find the segment that matches the server-returned prize ───────
    // SEGMENTS may be shuffled but the amounts are unique — find by amount.
    const segmentIndex = SEGMENTS.findIndex((s) => s.amount === serverPrize);
    // Fallback to index 0 if not found (should never happen with valid prizes)
    const targetIndex = segmentIndex >= 0 ? segmentIndex : 0;

    // ── STEP 3: Compute rotation so the wheel lands on that segment ───────────
    // Pointer is at top (0°). Segment i spans from i*60 to (i+1)*60 (6 segments = 60deg each).
    // conic-gradient starts at -90deg, so segment i's center is at -90 + i*60 + 30 degrees.
    // We rotate clockwise so that center aligns with -90deg (top pointer).
    // Rotation needed = 360 - (i*60 + 30) + multiples of 360 for visual effect.
    const baseRotation = 360 - (targetIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2);
    const extraSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full spins for drama
    const targetRotation = rotation + extraSpins * 360 + baseRotation;

    setRotation(targetRotation);

    // ── STEP 4: Wait for wheel animation (4s transition + 200ms buffer) ───────
    // then reveal the result that matches what the server returned.
    setTimeout(() => {
      if (!mountedRef.current) return;
      setWonAmount(serverPrize);

      if (serverPrize >= 5) {
        // Big win: 5 MNY or 10 MNY jackpot
        setSpinResult('bigwin');
        setShowBigWinFlash(true);
        fireConfetti(true);
        // Flash fades after 2.5s
        setTimeout(() => {
          if (mountedRef.current) setShowBigWinFlash(false);
        }, 2500);
        toast.success(`🎰 JACKPOT! You won ${serverPrize} MNY!`);
      } else if (serverPrize > 0) {
        // Normal win
        setSpinResult('win');
        fireConfetti(false);
        toast.success(`You won ${serverPrize} MNY!`);
      } else {
        // No win
        setSpinResult('nowin');
        toast.info('Better luck tomorrow!');
      }

      if (mountedRef.current) {
        setSpinning(false);
      }
    }, 4200);
  }, [user, spinning, spinRecord, rotation, fireConfetti]);

  const poolBalance = poolData?.balance ?? 0;
  const totalDistributed = poolData?.totalDistributed ?? 0;

  const handleFundPool = async () => {
    if (!userAddress || !fundAmount) return;
    const num = parseFloat(fundAmount);
    if (Number.isNaN(num) || num <= 0) {
      toast.error('Enter a valid amount greater than 0');
      return;
    }
    setFunding(true);
    const seedId = `seed_${Date.now()}_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const success = await setSeedSpinPool(seedId, {
      amount: Math.floor(num * 1_000_000),
      createdAt: Time.Now,
      createdBy: Address.publicKey(userAddress),
    });
    if (success) {
      toast.success(`Successfully funded spin pool with ${num} MNY`);
      setFundAmount('');
    } else {
      toast.error('Failed to fund pool. Check permissions and try again.');
    }
    setFunding(false);
  };

  return (
    <PageLayout fullBleed footer={false}>
      {/* Keyframe styles for spin result animations */}
      <style>{`
        @keyframes spin-result-win {
          0%   { opacity: 0; transform: scale(0.6) translateY(12px); }
          70%  { opacity: 1; transform: scale(1.1) translateY(-3px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin-result-bigwin {
          0%   { opacity: 0; transform: scale(0.4) translateY(16px); }
          60%  { opacity: 1; transform: scale(1.2) translateY(-5px); }
          80%  { transform: scale(0.97) translateY(2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin-result-nowin {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes bigwin-flash {
          0%   { opacity: 0; transform: scale(0.5); }
          20%  { opacity: 1; transform: scale(1.1); }
          70%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.05); }
        }
      `}</style>

      <div className="relative min-h-screen flex flex-col overflow-hidden">
        {/* BIG WIN flash overlay — fixed so it renders above everything */}
        {showBigWinFlash && (
          <div
            className="fixed inset-0 pointer-events-none flex items-center justify-center"
            style={{ zIndex: 9998 }}
          >
            <div
              style={{
                animation: 'bigwin-flash 2.5s ease-out forwards',
                textAlign: 'center',
              }}
            >
              <div
                className="font-black tracking-widest"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 'clamp(3rem, 12vw, 6rem)',
                  color: ACCENT_GOLD,
                  textShadow: `0 0 40px ${ACCENT_GOLD}, 0 0 80px ${ACCENT_GOLD}80, 0 0 120px ${ACCENT_GOLD}40`,
                  WebkitTextStroke: `2px ${ACCENT_GOLD}`,
                }}
              >
                BIG WIN!
              </div>
              <div
                className="text-lg font-black tracking-widest mt-2"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  color: 'white',
                  textShadow: '0 0 20px rgba(255,255,255,0.6)',
                }}
              >
                +{wonAmount} MNY
              </div>
            </div>
          </div>
        )}

        {/* Background */}
        <div className="absolute inset-0 z-0">
          <Particles quantity={50} color="hsl(280 100% 65%)" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 pt-5 pb-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-bold tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              BACK
            </span>
          </button>
          <div className="text-right">
            <h1
              className="text-xl font-black tracking-widest"
              style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT_GOLD, textShadow: `0 0 20px ${ACCENT_GOLD}60` }}
            >
              DAILY SPIN
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-wider">WIN MNY EVERY 24H</p>
          </div>
          <WalletButton />
        </header>

        {/* Stats row */}
        <section className="relative z-10 px-4 pt-4 pb-2">
          <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
            <Card className="bg-card/60 backdrop-blur-sm border-border/60">
              <CardContent className="p-3 text-center">
                <div className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mb-1" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                  Total Distributed
                </div>
                <div className="text-lg font-black" style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT_GOLD }}>
                  {(totalDistributed / 1e6).toLocaleString()} MNY
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/60 backdrop-blur-sm border-border/60">
              <CardContent className="p-3 text-center">
                <div className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mb-1" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                  Prize Pool
                </div>
                <div className="text-lg font-black" style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT_GOLD }}>
                  {(poolBalance / 1e6).toLocaleString()} MNY
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Wheel */}
        <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6">
          <SpinWheel rotation={rotation} spinning={spinning} />

          {/* Spin button */}
          <div className="mt-8 flex flex-col items-center gap-3">
            {!user ? (
              <Button
                className="h-14 px-10 font-black tracking-widest text-base"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  background: ACCENT_GOLD,
                  color: '#000',
                  boxShadow: `0 0 30px ${ACCENT_GOLD}40`,
                }}
                onClick={() => toast.info('Connect your wallet to spin!')}
              >
                <Sparkles className="h-5 w-5 mr-2" />
                CONNECT WALLET
              </Button>
            ) : cooldownRemaining > 0 ? (
              <div className="flex flex-col items-center gap-2">
                <Button
                  disabled
                  className="h-14 px-10 font-black tracking-widest text-base opacity-50 cursor-not-allowed"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  <Clock className="h-5 w-5 mr-2" />
                  SPIN AGAIN IN
                </Button>
                <span
                  className="text-sm font-bold tracking-wider"
                  style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT_GOLD }}
                >
                  {formatCooldown(cooldownRemaining)}
                </span>
              </div>
            ) : (
              <Button
                className="h-14 px-10 font-black tracking-widest text-base active:scale-95 transition-transform"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  background: ACCENT_GOLD,
                  color: '#000',
                  boxShadow: `0 0 30px ${ACCENT_GOLD}40`,
                }}
                onClick={handleSpin}
                disabled={spinning}
              >
                {spinning ? (
                  <>
                    <RotateCcw className="h-5 w-5 mr-2 animate-spin" />
                    SPINNING...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    SPIN
                  </>
                )}
              </Button>
            )}

            {/* Won display */}
            {wonAmount !== null && !spinning && (
              <div className="mt-2 text-center">
                {wonAmount > 0 ? (
                  <div
                    ref={resultAmountRef}
                    className="flex flex-col items-center"
                    style={{
                      animation: spinResult === 'bigwin'
                        ? 'spin-result-bigwin 0.5s cubic-bezier(0.34,1.56,0.64,1) both'
                        : 'spin-result-win 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
                    }}
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Trophy
                        className="h-5 w-5"
                        style={{
                          color: spinResult === 'bigwin' ? ACCENT_GOLD : ACCENT_GOLD,
                          filter: spinResult === 'bigwin'
                            ? `drop-shadow(0 0 8px ${ACCENT_GOLD})`
                            : `drop-shadow(0 0 4px ${ACCENT_GOLD}80)`,
                        }}
                      />
                      <span
                        className="font-black"
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: spinResult === 'bigwin' ? '2rem' : '1.5rem',
                          color: ACCENT_GOLD,
                          textShadow: spinResult === 'bigwin'
                            ? `0 0 30px ${ACCENT_GOLD}, 0 0 60px ${ACCENT_GOLD}60`
                            : `0 0 20px ${ACCENT_GOLD}60`,
                        }}
                      >
                        +{wonAmount} MNY
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Added to your total winnings!</p>
                  </div>
                ) : (
                  <div
                    style={{ animation: 'spin-result-nowin 0.6s ease-out both' }}
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <RotateCcw className="h-5 w-5 text-muted-foreground" />
                      <span
                        className="text-xl font-black text-muted-foreground"
                        style={{ fontFamily: "'Orbitron', sans-serif" }}
                      >
                        NO WIN
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Come back tomorrow and try again!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Admin Pool Funding Panel */}
        {isAdmin && (
          <section className="relative z-10 px-4 pb-8">
            <div className="max-w-sm mx-auto">
              <Card className="bg-card/60 backdrop-blur-sm border-border/60 overflow-hidden">
                <div className="h-1" style={{ background: ACCENT_GOLD }} />
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${ACCENT_GOLD}20`, color: ACCENT_GOLD }}
                    >
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <h2
                        className="text-xs font-black tracking-widest uppercase"
                        style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT_GOLD }}
                      >
                        Admin — Top Up Spin Pool
                      </h2>
                      <p className="text-[10px] text-muted-foreground tracking-wider">
                        Add MNY to the daily spin prize pool
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Coins className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="Amount (MNY)"
                        value={fundAmount}
                        onChange={(e) => setFundAmount(e.target.value)}
                        className="pl-9 h-10 text-sm font-bold bg-background/60 border-border/60"
                        style={{ fontFamily: "'Orbitron', sans-serif" }}
                      />
                    </div>
                    <Button
                      onClick={handleFundPool}
                      disabled={funding || !fundAmount}
                      className="h-10 px-4 font-bold tracking-wider text-xs active:scale-95 transition-transform"
                      style={{
                        fontFamily: "'Orbitron', sans-serif",
                        background: ACCENT_GOLD,
                        color: '#000',
                      }}
                    >
                      {funding ? (
                        <RotateCcw className="h-4 w-4 animate-spin" />
                      ) : (
                        'TOP UP'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

      </div>
    </PageLayout>
  );
};

export default DailySpinPage;
