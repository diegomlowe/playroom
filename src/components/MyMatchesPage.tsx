import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";;
import { PageLayout } from '@/components/poof-ui';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Particles } from '@/components/effects';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { subscribeManyGames, GamesResponse } from '@/lib/collections/games';
import { subscribeManyFlashMatches, FlashMatchesResponse } from '@/lib/collections/flashMatches';
import WalletButton from '@/components/WalletButton';
import {
  ArrowLeft,
  Trophy,
  TrendingUp,
  TrendingDown,
  Swords,
  Zap,
  Clock,
  BarChart2,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const TAPWARS_BUY_IN_SOL = 0.1;
const TAPWARS_WIN_PAYOUT_SOL = 0.288; // winner payout
const FLASHTAP_BUY_IN_SOL = 0.01;
const FLASHTAP_WIN_RATE = 0.97; // 97% of pool to winner

// ── Helpers ───────────────────────────────────────────────────────────────────
function truncateAddress(addr: string): string {
  if (!addr || addr.length < 8) return addr ?? '';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSol(amount: number): string {
  return amount.toFixed(3).replace(/\.?0+$/, '') + ' SOL';
}

// ── Unified match shape ───────────────────────────────────────────────────────
type GameKind = 'tapwars' | 'flashtap';
type MatchStatus = 'completed' | 'in-progress' | 'waiting' | 'cancelled';

interface UnifiedMatch {
  id: string;
  kind: GameKind;
  status: MatchStatus;
  timestamp: number;
  isWin: boolean;
  opponents: string[];
  buyIn: number;
  payout: number; // how much received (0 if lost)
  players: string[];
  winner?: string;
}

function tapwarsStatus(state: string): MatchStatus {
  if (state === 'resolved') return 'completed';
  if (state === 'playing') return 'in-progress';
  if (state === 'waiting') return 'waiting';
  if (state === 'cancelled') return 'cancelled';
  return 'completed';
}

function flashStatus(state: string): MatchStatus {
  if (state === 'resolved') return 'completed';
  if (state === 'playing' || state === 'countdown') return 'in-progress';
  if (state === 'waiting') return 'waiting';
  if (state === 'cancelled') return 'cancelled';
  return 'completed';
}

function buildTapwarsMatch(g: GamesResponse, userAddr: string): UnifiedMatch | null {
  const players = [g.creator, g.player2, g.player3, g.player4].filter(Boolean) as string[];
  const isParticipant = players.some((p) => p === userAddr);
  if (!isParticipant) return null;

  const status = tapwarsStatus(g.state);
  const isWin = g.winner === userAddr;
  const opponents = players.filter((p) => p !== userAddr);

  // Payout: winner gets 0.288, second gets 0.1 refund, losers get 0
  let payout = 0;
  if (isWin) payout = TAPWARS_WIN_PAYOUT_SOL;
  else if (g.secondPlace === userAddr) payout = TAPWARS_BUY_IN_SOL; // refund

  return {
    id: g.id,
    kind: 'tapwars',
    status,
    timestamp: g.createdAt ?? g.tarobase_created_at ?? 0,
    isWin,
    opponents,
    buyIn: TAPWARS_BUY_IN_SOL,
    payout,
    players,
    winner: g.winner,
  };
}

function buildFlashMatch(m: FlashMatchesResponse, userAddr: string): UnifiedMatch | null {
  // For FlashTap the creator is tracked; join participants are in subcollection
  // We only have matches from subscribeManyFlashMatches — we check creator field
  // and also check winner. For non-creator players the check is done client-side.
  const isCreator = m.creator === userAddr;
  const isWinner = m.winner === userAddr;
  // Without subcollection data we only know the creator directly; for other players
  // we infer participation if they appear as winner or if they appear in joins.
  // We'll include matches where user is creator or winner (best we can without joins data).
  if (!isCreator && !isWinner) return null;

  const status = flashStatus(m.state);
  const playerCount = m.playerCount ?? 1;
  const poolSol = playerCount * FLASHTAP_BUY_IN_SOL;
  const winPayout = poolSol * FLASHTAP_WIN_RATE;
  const isWin = isWinner;
  const payout = isWin ? winPayout : 0;

  // Opponents: unknown addresses (playerCount - 1 others) — show count
  const opponents: string[] = [];

  return {
    id: m.id,
    kind: 'flashtap',
    status,
    timestamp: m.ts ?? m.tarobase_created_at ?? 0,
    isWin,
    opponents,
    buyIn: FLASHTAP_BUY_IN_SOL,
    payout,
    players: [m.creator],
    winner: m.winner,
  };
}

// ── Stat summary card ─────────────────────────────────────────────────────────
interface SummaryStatsProps {
  matches: UnifiedMatch[];
}

function SummaryStats({ matches }: SummaryStatsProps) {
  // Cancelled matches are excluded from win rate — only 'completed' matches count
  // This ensures cancelled games are neither wins nor losses in the win rate denominator
  const completed = matches.filter((m) => m.status === 'completed');
  const wins = completed.filter((m) => m.isWin);
  const losses = completed.filter((m) => !m.isWin);

  const totalWon = wins.reduce((acc, m) => acc + m.payout - m.buyIn, 0);
  const totalLost = losses.reduce((acc, m) => acc + m.buyIn, 0);
  const netPnl = totalWon - totalLost;
  // Win rate denominator is completed.length (excludes cancelled, waiting, in-progress)
  const winRate = completed.length > 0 ? (wins.length / completed.length) * 100 : 0;

  const stats = [
    {
      label: 'Matches',
      value: matches.length.toString(),
      icon: <BarChart2 className="h-4 w-4" />,
      color: 'text-foreground',
    },
    {
      label: 'Win Rate',
      value: `${winRate.toFixed(0)}%`,
      icon: <Trophy className="h-4 w-4" />,
      color: 'text-accent',
    },
    {
      label: 'SOL Won',
      value: formatSol(totalWon > 0 ? totalWon : 0),
      icon: <TrendingUp className="h-4 w-4" />,
      color: 'text-green-400',
    },
    {
      label: 'Net P/L',
      value: (netPnl >= 0 ? '+' : '') + formatSol(netPnl),
      icon: netPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
      color: netPnl >= 0 ? 'text-green-400' : 'text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {stats.map((s) => (
        <div
          key={s.label}
          className="glass rounded-2xl p-4 border border-border/60 flex flex-col gap-1"
        >
          <div className={`flex items-center gap-1.5 ${s.color} mb-1`}>
            {s.icon}
            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
              {s.label}
            </span>
          </div>
          <span
            className={`text-xl font-black ${s.color}`}
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Match card ────────────────────────────────────────────────────────────────
interface MatchCardProps {
  match: UnifiedMatch;
  userAddr: string;
}

function MatchCard({ match, userAddr: _userAddr }: MatchCardProps) {
  const navigate = useNavigate();

  const statusBadge: Record<MatchStatus, { label: string; cls: string }> = {
    completed: { label: 'DONE', cls: 'bg-muted/30 text-muted-foreground border-border' },
    'in-progress': { label: 'LIVE', cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
    waiting: { label: 'WAITING', cls: 'bg-accent/15 text-accent border-accent/30' },
    cancelled: { label: 'CANCELLED', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  };

  const gameBadge =
    match.kind === 'tapwars'
      ? { label: 'TAPWARS', cls: 'bg-primary/15 text-primary border-primary/30', icon: <Swords className="h-3 w-3" /> }
      : { label: 'FLASHTAP', cls: 'bg-accent/15 text-accent border-accent/30', icon: <Zap className="h-3 w-3" /> };

  const sb = statusBadge[match.status];
  const pnl = match.isWin ? match.payout - match.buyIn : -match.buyIn;

  function handleClick() {
    if (match.kind === 'tapwars') navigate(`/games/${match.id}`);
    else navigate(`/flashtap/${match.id}`);
  }

  return (
    <Card
      className="relative overflow-hidden border border-border/60 hover:border-primary/40 transition-all duration-200 cursor-pointer bg-card/50 backdrop-blur-sm group"
      onClick={handleClick}
    >
      {/* Win accent stripe */}
      {match.isWin && match.status === 'completed' && (
        <div className="absolute inset-y-0 left-0 w-1 bg-green-400 rounded-l-xl" />
      )}
      {!match.isWin && match.status === 'completed' && (
        <div className="absolute inset-y-0 left-0 w-1 bg-red-500/60 rounded-l-xl" />
      )}

      <CardContent className="p-4">
        {/* Top row: game badge + status + date */}
        <div className="flex items-center gap-2 mb-3">
          <Badge className={`text-[10px] font-bold tracking-widest px-2 py-0.5 gap-1 ${gameBadge.cls}`}>
            {gameBadge.icon}
            {gameBadge.label}
          </Badge>
          <Badge className={`text-[10px] font-bold tracking-widest px-2 py-0.5 ${sb.cls}`}>
            {match.status === 'in-progress' && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse mr-1" />
            )}
            {sb.label}
          </Badge>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDate(match.timestamp)}
          </div>
        </div>

        {/* Result row */}
        {match.status === 'completed' ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {match.isWin ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20">
                  <Trophy className="h-3.5 w-3.5 text-green-400" />
                  <span
                    className="text-sm font-black text-green-400 tracking-wider"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    WON
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                  <span
                    className="text-sm font-black text-red-400 tracking-wider"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    LOST
                  </span>
                </div>
              )}

              {/* Opponent(s) */}
              {match.opponents.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">vs</span>
                  {match.opponents.slice(0, 2).map((addr) => (
                    <span
                      key={addr}
                      className="text-[10px] font-semibold text-muted-foreground bg-muted/30 rounded-md px-1.5 py-0.5"
                    >
                      {truncateAddress(addr)}
                    </span>
                  ))}
                  {match.opponents.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{match.opponents.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* P/L */}
            <div className="text-right">
              <div
                className={`text-sm font-black ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                {pnl >= 0 ? '+' : ''}{formatSol(pnl)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                buy-in: {formatSol(match.buyIn)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {match.status === 'waiting'
                ? 'Waiting for players…'
                : match.status === 'in-progress'
                ? 'Match in progress'
                : 'Match cancelled'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              buy-in: {formatSol(match.buyIn)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="glass rounded-2xl p-10 text-center border border-border/40 flex flex-col items-center gap-4">
      <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 border border-primary/20">
        <Swords className="h-8 w-8 text-primary opacity-60" />
      </div>
      <div>
        <h3
          className="text-lg font-black tracking-widest mb-1 gradient-text"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          NO MATCHES YET
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your match history is empty. Jump in and play your first game!
        </p>
      </div>
      <button
        onClick={() => navigate('/games')}
        className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-sm transition-all hover:scale-105 active:scale-95"
        style={{
          fontFamily: "'Orbitron', sans-serif",
          background: 'linear-gradient(135deg, hsl(280 100% 65%), hsl(220 100% 65%))',
          color: '#fff',
          boxShadow: '0 0 20px hsl(280 100% 65% / 0.35)',
        }}
      >
        <Zap className="h-4 w-4 fill-current" />
        Play Now
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export const MyMatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: allGames, loading: gamesLoading } = useRealtimeData<GamesResponse[]>(
    subscribeManyGames,
    !!user,
  );

  const { data: allFlashMatches, loading: flashLoading } = useRealtimeData<FlashMatchesResponse[]>(
    subscribeManyFlashMatches,
    !!user,
  );

  const loading = gamesLoading || flashLoading;

  const matches = useMemo<UnifiedMatch[]>(() => {
    if (!user) return [];
    const addr = user.address;

    const tapMatches = (allGames ?? [])
      .map((g) => buildTapwarsMatch(g, addr))
      .filter(Boolean) as UnifiedMatch[];

    const flashMatches = (allFlashMatches ?? [])
      .map((m) => buildFlashMatch(m, addr))
      .filter(Boolean) as UnifiedMatch[];

    // Combined, sorted newest first
    return [...tapMatches, ...flashMatches].sort((a, b) => b.timestamp - a.timestamp);
  }, [allGames, allFlashMatches, user]);

  return (
    <PageLayout fullBleed footer={false}>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <Particles quantity={40} color="hsl(280 100% 65%)" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 pt-5 pb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-semibold">Home</span>
            </button>
            <div className="h-4 w-px bg-border" />
            <h1
              className="text-xl font-black tracking-widest gradient-text"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              MY MATCHES
            </h1>
          </div>
          <WalletButton />
        </header>

        {/* Content */}
        <section className="relative z-10 px-4 pt-6 pb-10 flex-1">
          {!user ? (
            <div className="glass rounded-2xl p-10 text-center border border-border/40 flex flex-col items-center gap-4 mt-4">
              <Swords className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">Connect your wallet to view your match history.</p>
              <WalletButton />
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <div
                className="h-8 w-8 rounded-full border-2 border-primary/40 border-t-primary animate-spin"
              />
              <span className="text-sm tracking-widest uppercase font-semibold">Loading matches…</span>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              {matches.length > 0 && <SummaryStats matches={matches} />}

              {/* Match list header */}
              {matches.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  <h2
                    className="text-xs font-bold tracking-widest text-muted-foreground uppercase"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    Match History ({matches.length})
                  </h2>
                </div>
              )}

              {/* Match cards */}
              {matches.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-3">
                  {matches.map((m) => (
                    <MatchCard key={`${m.kind}-${m.id}`} match={m} userAddr={user.address} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </PageLayout>
  );
};

export default MyMatchesPage;
