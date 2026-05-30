import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";;
import { PageLayout } from '@/components/poof-ui';
import { Particles } from '@/components/effects';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Coins, Lock, Unlock } from 'lucide-react';
import { AdminUnlockPanel } from '@/components/AdminUnlockPanel';
import { BuyMNYPanel } from '@/components/BuyMNYPanel';
import { StakingCard } from '@/components/PlayroomPage';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { subscribeManyTokenUnlocks, TokenUnlocksResponse } from '@/lib/collections/tokenUnlocks';
import { ADMIN_ADDRESS } from '@/lib/constants';

const TOTAL_SUPPLY = 1_000_000;

interface SliceDef {
  label: string;
  amount: number;
  color: string;
  description: string;
}

const SLICES: SliceDef[] = [
  {
    label: 'Ecosystem Reserve',
    amount: 600_000,
    color: '#22c55e',
    description:
      '600k MNY locked in reserve. Unlocks in 3 stages via milestones: Second Sale, Special Prizes Part 2, and Final Sale. Each unlock also increases Dev Stake by 100k.',
  },
  {
    label: 'Dev Wallet Stake',
    amount: 200_000,
    color: '#818cf8',
    description:
      '200k MNY initially staked by the dev team. Grows by 100k at each of the 3 unlock milestones, reaching 500k MNY total.',
  },
  {
    label: 'Daily Spin Prize Pool',
    amount: 100_000,
    color: '#f59e0b',
    description: '100k MNY allocated to the daily spin prize pool for community rewards.',
  },
  {
    label: 'Primary Sale',
    amount: 100_000,
    color: '#06b6d4',
    description: '100k MNY allocated to the initial primary token sale.',
  },
];

const MILESTONES = [
  { label: 'Second Sale', index: 1, milestoneId: 'second-sale' },
  { label: 'Special Prizes Part 2', index: 2, milestoneId: 'special-prizes-part-2' },
  { label: 'Final Sale', index: 3, milestoneId: 'final-sale' },
];

function getSlicePath(
  center: number,
  radius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const x1 = center + radius * Math.cos(startAngle);
  const y1 = center + radius * Math.sin(startAngle);
  const x2 = center + radius * Math.cos(endAngle);
  const y2 = center + radius * Math.sin(endAngle);
  const ix1 = center + innerRadius * Math.cos(startAngle);
  const iy1 = center + innerRadius * Math.sin(startAngle);
  const ix2 = center + innerRadius * Math.cos(endAngle);
  const iy2 = center + innerRadius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${ix1} ${iy1}`,
    `L ${x1} ${y1}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${ix2} ${iy2}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
    'Z',
  ].join(' ');
}

function PieChart() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const size = 260;
  const center = size / 2;
  const radius = 100;
  const innerRadius = 55;

  const sliceAngles = SLICES.reduce<{ start: number; end: number; mid: number }[]>(
    (acc, slice) => {
      const prevEnd = acc.length > 0 ? acc[acc.length - 1].end : -Math.PI / 2;
      const angle = (slice.amount / TOTAL_SUPPLY) * 2 * Math.PI;
      acc.push({ start: prevEnd, end: prevEnd + angle, mid: prevEnd + angle / 2 });
      return acc;
    },
    []
  );

  const paths = SLICES.map((slice, i) => {
    const { start, end, mid } = sliceAngles[i];
    const isActive = activeIndex === i;
    const expand = isActive ? 5 : 0;
    const tx = expand * Math.cos(mid);
    const ty = expand * Math.sin(mid);
    const d = getSlicePath(center, radius, innerRadius, start, end);

    return (
      <path
        key={slice.label}
        d={d}
        fill={slice.color}
        stroke="hsl(var(--card))"
        strokeWidth={2}
        transform={`translate(${tx}, ${ty})`}
        style={{
          transition: 'transform 0.25s ease, opacity 0.25s ease',
          opacity: activeIndex !== null && !isActive ? 0.45 : 1,
          cursor: 'pointer',
        }}
        onMouseEnter={() => setActiveIndex(i)}
        onMouseLeave={() => {
          setActiveIndex(null);
          setMousePos(null);
        }}
        onMouseMove={(e) => {
          const svg = (e.target as SVGElement).closest('svg');
          if (!svg) return;
          const rect = svg.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onClick={() => setActiveIndex(i === activeIndex ? null : i)}
      />
    );
  });

  return (
    <div className="space-y-4">
      <div className="relative flex justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="max-w-full"
        >
          {paths}
          <text
            x={center}
            y={center - 7}
            textAnchor="middle"
            fill="hsl(var(--foreground))"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '15px',
              fontWeight: 900,
            }}
          >
            1M
          </text>
          <text
            x={center}
            y={center + 11}
            textAnchor="middle"
            fill="hsl(var(--muted-foreground))"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '9px',
              fontWeight: 700,
            }}
          >
            MNY TOTAL
          </text>
        </svg>

        {activeIndex !== null && mousePos && (
          <div
            className="absolute hidden sm:block pointer-events-none z-50 rounded-xl p-3 text-xs max-w-[240px] shadow-2xl border"
            style={{
              left: Math.min(mousePos.x + 14, size - 120),
              top: Math.max(mousePos.y - 14, 0),
              background: 'hsl(var(--card))',
              borderColor: `${SLICES[activeIndex].color}50`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: SLICES[activeIndex].color }}
              />
              <span
                className="font-bold"
                style={{ color: SLICES[activeIndex].color }}
              >
                {SLICES[activeIndex].label}
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {SLICES[activeIndex].description}
            </p>
            <div
              className="mt-1.5 text-[10px] font-bold tracking-wider"
              style={{ color: SLICES[activeIndex].color }}
            >
              {SLICES[activeIndex].amount.toLocaleString()} MNY
            </div>
          </div>
        )}
      </div>

      {/* Legend / mobile tap targets */}
      <div className="flex flex-wrap justify-center gap-2">
        {SLICES.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setActiveIndex(i === activeIndex ? null : i)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold tracking-wider border transition-colors"
            style={{
              borderColor:
                i === activeIndex ? `${s.color}60` : 'hsl(var(--border) / 0.4)',
              background:
                i === activeIndex ? `${s.color}12` : 'transparent',
              color: i === activeIndex ? s.color : 'hsl(var(--muted-foreground))',
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </button>
        ))}
      </div>

      {/* Active slice detail card */}
      {activeIndex !== null && (
        <div
          className="rounded-xl p-3.5 border text-xs animate-fade-in"
          style={{
            borderColor: `${SLICES[activeIndex].color}40`,
            background: `${SLICES[activeIndex].color}08`,
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: SLICES[activeIndex].color }}
            />
            <span
              className="font-bold"
              style={{ color: SLICES[activeIndex].color }}
            >
              {SLICES[activeIndex].label}
            </span>
            <span className="text-muted-foreground">
              — {SLICES[activeIndex].amount.toLocaleString()} MNY
            </span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {SLICES[activeIndex].description}
          </p>
        </div>
      )}
    </div>
  );
}

function MilestoneTracker() {
  const { data: allUnlocks } = useRealtimeData<TokenUnlocksResponse[]>(
    subscribeManyTokenUnlocks,
    true,
  );

  const unlocksArr = allUnlocks ?? [];

  return (
    <div className="space-y-3">
      <h2
        className="text-xs font-black tracking-widest text-muted-foreground uppercase text-center"
        style={{ fontFamily: "'Orbitron', sans-serif" }}
      >
        Unlock Milestones
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {MILESTONES.map((m) => {
          const isUnlocked = unlocksArr.some((u) => u.milestoneId === m.milestoneId);
          return (
            <div
              key={m.label}
              className="rounded-xl p-3 text-center border backdrop-blur-sm transition-all"
              style={{
                background: isUnlocked
                  ? 'hsl(var(--card) / 0.75)'
                  : 'hsl(var(--border) / 0.12)',
                borderColor: isUnlocked
                  ? '#22c55e45'
                  : 'hsl(var(--border) / 0.35)',
              }}
            >
              <div className="flex justify-center mb-2">
                {isUnlocked ? (
                  <Unlock
                    className="h-5 w-5"
                    style={{ color: '#22c55e' }}
                  />
                ) : (
                  <Lock className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div
                className="text-[10px] font-bold tracking-wider mb-1"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  color: isUnlocked ? '#22c55e' : 'hsl(var(--muted-foreground))',
                }}
              >
                {isUnlocked ? 'UNLOCKED' : 'LOCKED'}
              </div>
              <div
                className="text-[11px] font-bold text-foreground leading-tight"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                {m.label}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 leading-tight">
                100k Reserve + 100k Dev
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const TokenPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const stakingRef = useRef<HTMLDivElement>(null);

  const isAdmin = !!(user && user.address === ADMIN_ADDRESS);

  useEffect(() => {
    if (searchParams.get('tab') === 'stake' && stakingRef.current) {
      stakingRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams]);

  return (
    <PageLayout fullBleed footer={false}>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <Particles quantity={40} color="hsl(280 100% 65%)" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center px-4 pt-5 pb-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span
              className="text-sm font-bold tracking-wider"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              PLAYROOM
            </span>
          </button>
        </header>

        {/* Content */}
        <section className="relative z-10 flex-1 px-4 py-6">
          <div className="max-w-md mx-auto space-y-6">
            {/* Buy MNY Panel — primary sale */}
            <BuyMNYPanel />

            {/* Staking Card */}
            <div ref={stakingRef} id="staking-section">
              <StakingCard />
            </div>

            {/* MNY Token Distribution Header + Pie Chart + Milestones */}
            <Card className="bg-card/60 border border-border/60 backdrop-blur-sm">
              {/* Hero */}
              <div className="px-5 pt-5 pb-2 text-center border-b border-border/40">
                <div className="mb-3 flex justify-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{
                      background: 'hsl(var(--primary) / 0.1)',
                      border: '2px solid hsl(var(--primary) / 0.3)',
                      boxShadow: '0 0 40px hsl(var(--primary) / 0.2)',
                    }}
                  >
                    <Coins className="h-7 w-7 text-primary/80" />
                  </div>
                </div>
                <h1
                  className="text-3xl font-black tracking-widest gradient-text mb-1"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  MNY Token Distribution
                </h1>
                <p className="text-muted-foreground text-xs leading-relaxed pb-3">
                  Total supply of{' '}
                  <span className="font-bold text-foreground">
                    {TOTAL_SUPPLY.toLocaleString()} MNY
                  </span>{' '}
                  — distributed across four initial allocations with milestone-based reserve unlocks.
                </p>
              </div>
              <CardContent className="p-5 space-y-5">
                <PieChart />
                <div className="h-px bg-border/40" />
                <MilestoneTracker />
              </CardContent>
            </Card>

            {/* Admin Unlock Panel — double-gated: parent check + component internal guard */}
            {isAdmin && <AdminUnlockPanel />}

            {/* Back Button */}
            <div className="pb-8">
              <Button
                onClick={() => navigate('/')}
                size="lg"
                className="w-full h-12 font-bold tracking-widest rounded-2xl shadow-lg shadow-primary/30 active:scale-95 transition-transform"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                BACK TO PLAYROOM
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
};

export default TokenPage;
