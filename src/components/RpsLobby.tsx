import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";;
import { toast } from 'sonner';
import { PageLayout } from '@/components/poof-ui';
import { Particles } from '@/components/effects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Scissors, Users, Trophy, Clock } from 'lucide-react';
import WalletButton from '@/components/WalletButton';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import {
  subscribeManyRpsMatches,
  setRpsMatches,
  updateRpsMatches,
  RpsMatchesResponse,
} from '@/lib/collections/rpsMatches';
import { runTokenBalanceQueryForCommonQueries } from '@/lib/collections/commonQueries';
import { runGetTokenMintAddressQueryForTprToken } from '@/lib/collections/tprToken';
import { Address, Time } from '@/lib/db-client';
import {
  COINFLIP_TIER1_LAMPORTS,
  COINFLIP_TIER2_LAMPORTS,
  COINFLIP_TIER3_LAMPORTS,
  MNY_TIER_CASUAL_BASE_UNITS,
  MNY_TIER_STANDARD_BASE_UNITS,
  MNY_TIER_HIGH_BASE_UNITS,
} from '@/lib/constants';

const ACCENT = 'hsl(280 100% 65%)';

interface Tier {
  id: number;
  label: string;
  sol: number;
  lamports: number;
  prize: number;
  colorClass: string;
  borderStyle: string;
  gradientStyle: string;
}

type Currency = 'SOL' | 'MNY';

const SOL_TIERS: Tier[] = [
  {
    id: 1,
    label: 'Tier 1',
    sol: 0.01,
    lamports: Number(COINFLIP_TIER1_LAMPORTS),
    prize: 0.0198,
    colorClass: 'text-violet-300',
    borderStyle: 'border: 1px solid hsl(280 100% 65% / 0.35)',
    gradientStyle: 'hsl(280 100% 65% / 0.12)',
  },
  {
    id: 2,
    label: 'Tier 2',
    sol: 0.05,
    lamports: Number(COINFLIP_TIER2_LAMPORTS),
    prize: 0.099,
    colorClass: 'text-fuchsia-300',
    borderStyle: 'border: 1px solid hsl(290 100% 65% / 0.35)',
    gradientStyle: 'hsl(290 100% 65% / 0.12)',
  },
  {
    id: 3,
    label: 'Tier 3',
    sol: 0.1,
    lamports: Number(COINFLIP_TIER3_LAMPORTS),
    prize: 0.198,
    colorClass: 'text-purple-300',
    borderStyle: 'border: 1px solid hsl(270 100% 65% / 0.35)',
    gradientStyle: 'hsl(270 100% 65% / 0.12)',
  },
];

// MNY base units → display MNY: divide by 1e6
const MNY_CASUAL_DISPLAY = Number(MNY_TIER_CASUAL_BASE_UNITS) / 1e6;
const MNY_STANDARD_DISPLAY = Number(MNY_TIER_STANDARD_BASE_UNITS) / 1e6;
const MNY_HIGH_DISPLAY = Number(MNY_TIER_HIGH_BASE_UNITS) / 1e6;

const MNY_TIERS: Tier[] = [
  {
    id: 1,
    label: 'Tier 1',
    sol: MNY_CASUAL_DISPLAY,
    lamports: Number(MNY_TIER_CASUAL_BASE_UNITS),
    prize: parseFloat((MNY_CASUAL_DISPLAY * 2 * 0.975).toFixed(4)),
    colorClass: 'text-violet-300',
    borderStyle: 'border: 1px solid hsl(280 100% 65% / 0.35)',
    gradientStyle: 'hsl(280 100% 65% / 0.12)',
  },
  {
    id: 2,
    label: 'Tier 2',
    sol: MNY_STANDARD_DISPLAY,
    lamports: Number(MNY_TIER_STANDARD_BASE_UNITS),
    prize: parseFloat((MNY_STANDARD_DISPLAY * 2 * 0.975).toFixed(4)),
    colorClass: 'text-fuchsia-300',
    borderStyle: 'border: 1px solid hsl(290 100% 65% / 0.35)',
    gradientStyle: 'hsl(290 100% 65% / 0.12)',
  },
  {
    id: 3,
    label: 'Tier 3',
    sol: MNY_HIGH_DISPLAY,
    lamports: Number(MNY_TIER_HIGH_BASE_UNITS),
    prize: parseFloat((MNY_HIGH_DISPLAY * 2 * 0.975).toFixed(4)),
    colorClass: 'text-purple-300',
    borderStyle: 'border: 1px solid hsl(270 100% 65% / 0.35)',
    gradientStyle: 'hsl(270 100% 65% / 0.12)',
  },
];

function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function timeAgo(tsSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - tsSeconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function getTierForLamports(lamports: number, currency: Currency): Tier {
  const tiers = currency === 'MNY' ? MNY_TIERS : SOL_TIERS;
  return tiers.find((t) => t.lamports === lamports) ?? tiers[0];
}

// ─── Tier Card ────────────────────────────────────────────────────────────────

function TierCard({ tier, onSelect, creating, currency }: { tier: Tier; onSelect: () => void; creating: boolean; currency: Currency }) {
  const unit = currency === 'SOL' ? 'SOL' : 'MNY';
  const displayAmount = currency === 'SOL' ? tier.sol : tier.sol;
  const displayPrize = currency === 'SOL' ? parseFloat(tier.prize.toFixed(4)).toString() : tier.prize.toLocaleString();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      className={`relative rounded-2xl bg-card/60 backdrop-blur-sm p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group ${creating ? 'pointer-events-none opacity-60' : ''}`}
      style={{
        border: `1px solid ${ACCENT}35`,
        boxShadow: `0 0 0px ${ACCENT}00`,
        transition: 'box-shadow 0.3s ease, transform 0.2s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${ACCENT}20`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0px ${ACCENT}00`;
      }}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${tier.gradientStyle} 0%, transparent 70%)` }}
      />
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div
            className="text-xs text-muted-foreground tracking-widest uppercase font-semibold mb-1"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            {tier.label}
          </div>
          <div
            className="text-2xl font-black"
            style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
          >
            {displayAmount} {unit}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Trophy className="h-3 w-3" style={{ color: ACCENT }} />
            Win <span className="font-bold text-foreground ml-1">{displayPrize} {unit}</span>
          </div>
        </div>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{
            background: `${ACCENT}15`,
            border: `1px solid ${ACCENT}35`,
          }}
        >
          <Scissors className="h-6 w-6" style={{ color: ACCENT }} />
        </div>
      </div>
    </div>
  );
}

// ─── Waiting Match Card ───────────────────────────────────────────────────────

function WaitingMatchCard({
  match,
  userAddress,
  onJoin,
  joining,
}: {
  match: RpsMatchesResponse;
  userAddress?: string;
  onJoin: () => void;
  joining: boolean;
}) {
  const navigate = useNavigate();
  const currency: Currency = (match.buyInCurrency as Currency) || 'SOL';
  const tier = getTierForLamports(match.buyInLamports ?? 0, currency);
  const isCreator = match.creator === userAddress;
  const unit = currency === 'MNY' ? 'MNY' : 'SOL';
  const displayAmount = currency === 'MNY' ? tier.sol.toLocaleString() : tier.sol.toString();

  return (
    <div
      className="rounded-2xl bg-card/60 backdrop-blur-sm p-4 transition-colors"
      style={{ border: `1px solid ${ACCENT}30` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: ACCENT }} />
          <span
            className="text-xs text-muted-foreground font-semibold tracking-widest uppercase"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            Waiting
          </span>
        </div>
        <Badge
          className="text-xs font-black px-2 py-0.5"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            background: `${ACCENT}20`,
            color: ACCENT,
            border: `1px solid ${ACCENT}40`,
          }}
        >
          {displayAmount} {unit}
        </Badge>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex-1 rounded-xl p-2 text-center"
          style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}20` }}
        >
          <div className="text-xs text-muted-foreground mb-0.5">Creator</div>
          <div className="text-xs font-bold text-foreground">{truncateAddress(match.creator)}</div>
        </div>
        <div
          className="text-muted-foreground font-black text-sm"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          VS
        </div>
        <div className="flex-1 rounded-xl bg-muted/20 border border-dashed border-border p-2 text-center">
          <div className="text-xs text-muted-foreground mb-0.5">Opponent</div>
          <div className="text-xs text-muted-foreground">Open</div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-3">
        <Clock className="h-3 w-3" />
        {timeAgo(match.createdAt)}
      </div>

      {isCreator ? (
        <Button
          size="sm"
          variant="secondary"
          className="w-full h-10 font-bold tracking-widest"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
          onClick={() => navigate(`/rps/${match.id}`)}
        >
          VIEW YOUR MATCH
        </Button>
      ) : (
        <Button
          size="sm"
          className="w-full h-10 font-black tracking-widest active:scale-95 transition-transform"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            background: `linear-gradient(135deg, ${ACCENT}, hsl(260 100% 55%))`,
            color: '#fff',
            boxShadow: `0 0 20px ${ACCENT}40`,
          }}
          onClick={onJoin}
          disabled={joining}
        >
          {joining ? 'JOINING...' : `JOIN · ${displayAmount} ${unit}`}
        </Button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const RpsLobby: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>('SOL');
  const [mnyBalance, setMnyBalance] = useState<number | null>(null);

  const tiers = currency === 'MNY' ? MNY_TIERS : SOL_TIERS;

  // Fetch MNY balance
  const fetchMnyBalance = useCallback(async () => {
    if (!user?.address) {
      setMnyBalance(null);
      return;
    }
    try {
      const tokenMint = await runGetTokenMintAddressQueryForTprToken('pppToken');
      const bal = await runTokenBalanceQueryForCommonQueries('token-balance', {
        walletAddress: user.address,
        tokenMint,
      });
      setMnyBalance(bal / 1e6);
    } catch {
      setMnyBalance(null);
    }
  }, [user?.address]);

  useEffect(() => {
    fetchMnyBalance();
  }, [fetchMnyBalance]);

  const { data: allMatches } = useRealtimeData<RpsMatchesResponse[]>(
    subscribeManyRpsMatches,
    true,
  );

  const waitingMatches = (allMatches ?? []).filter((m) => m.status === 'waiting');
  const myActiveMatches = (allMatches ?? []).filter(
    (m) =>
      (m.status === 'waiting' || m.status === 'active') &&
      (m.creator === user?.address || m.opponent === user?.address)
  );

  async function handleCreate(tier: Tier) {
    if (!user) {
      toast.error('Connect your wallet first');
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const matchId = `rps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const success = await setRpsMatches(matchId, {
        creator: Address.publicKey(user.address),
        opponent: null as any,
        buyInLamports: tier.lamports,
        status: 'waiting',
        creatorWins: 0,
        opponentWins: 0,
        currentRound: 1,
        winner: null as any,
        createdAt: Time.Now as any,
        buyInCurrency: currency,
        lastActivityAt: Time.Now as any,
      });
      if (success) {
        toast.success(`${tier.label} RPS match created!`);
        navigate(`/rps/${matchId}`);
      } else {
        toast.error('Failed to create — wallet may have denied the buy-in');
      }
    } catch {
      toast.error('Error creating match');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(match: RpsMatchesResponse) {
    if (!user) {
      toast.error('Connect your wallet first');
      return;
    }
    if (joiningId) return;
    setJoiningId(match.id);
    try {
      const success = await updateRpsMatches(match.id, {
        opponent: Address.publicKey(user.address),
        status: 'active',
        lastActivityAt: Time.Now as any,
      });
      if (success) {
        toast.success('Joined! Best of 3 — good luck!');
        navigate(`/rps/${match.id}`);
      } else {
        toast.error('Failed to join — wallet may have denied the buy-in');
      }
    } catch {
      toast.error('Error joining match');
    } finally {
      setJoiningId(null);
    }
  }

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
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span
              className="text-sm font-bold tracking-wider"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              BACK
            </span>
          </button>
          <div className="text-right">
            <h1
              className="text-xl font-black tracking-widest"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                color: ACCENT,
                textShadow: `0 0 20px ${ACCENT}60`,
              }}
            >
              RPS
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-wider">BEST OF 3 · COMMIT-REVEAL</p>
          </div>
        </header>

        {/* Hero */}
        <section className="relative z-10 px-4 pt-6 pb-4 text-center">
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: `${ACCENT}15`,
                border: `1px solid ${ACCENT}40`,
                boxShadow: `0 0 30px ${ACCENT}20`,
              }}
            >
              <Scissors className="h-8 w-8" style={{ color: ACCENT }} />
            </div>
          </div>
          <h2
            className="text-3xl font-black leading-tight mb-2"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: ACCENT,
              textShadow: `0 0 40px ${ACCENT}40`,
            }}
          >
            Rock Paper Scissors
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
            Best of 3 — winner takes ~97.5% of pot. Commit-reveal proves fair play.
          </p>
        </section>

        {/* My Active Matches */}
        {myActiveMatches.length > 0 && (
          <section className="relative z-10 px-4 pb-4">
            <p
              className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mb-3"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              Your Active Matches
            </p>
            <div className="space-y-2 max-w-md mx-auto">
              {myActiveMatches.map((m) => {
                const matchCurrency: Currency = (m.buyInCurrency as Currency) || 'SOL';
                const tier = getTierForLamports(m.buyInLamports ?? 0, matchCurrency);
                const unit = matchCurrency === 'MNY' ? 'MNY' : 'SOL';
                const displayAmount = matchCurrency === 'MNY' ? tier.sol.toLocaleString() : tier.sol.toString();
                return (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/rps/${m.id}`)}
                    className="w-full rounded-xl p-3 text-left transition-all hover:scale-[1.01] flex items-center justify-between"
                    style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}30` }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full animate-pulse"
                        style={{ background: m.status === 'active' ? ACCENT : 'hsl(160 100% 45%)' }}
                      />
                      <span
                        className="text-xs font-bold tracking-widest"
                        style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
                      >
                        {m.status === 'active' ? 'ACTIVE' : 'WAITING'}
                      </span>
                      <span className="text-xs text-muted-foreground">· {displayAmount} {unit}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {m.creatorWins} – {m.opponentWins} →
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Tier Selection */}
        <section className="relative z-10 px-4 pb-4">
          <div className="flex items-center justify-between mb-3 max-w-md mx-auto">
            <p
              className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              Create New Match
            </p>
            {/* Currency Toggle */}
            <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
              <button
                onClick={() => setCurrency('SOL')}
                className={`text-[10px] px-3 py-1 rounded-full font-bold tracking-wider transition-all ${currency === 'SOL' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                SOL
              </button>
              <button
                onClick={() => setCurrency('MNY')}
                className={`text-[10px] px-3 py-1 rounded-full font-bold tracking-wider transition-all ${currency === 'MNY' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                MNY
              </button>
            </div>
          </div>

          {/* MNY Balance */}
          {currency === 'MNY' && user && (
            <div className="max-w-md mx-auto mb-3 text-right">
              <span className="text-[10px] text-muted-foreground tracking-wider uppercase font-semibold">
                Balance: {' '}
                <span className="text-foreground font-bold">
                  {mnyBalance !== null ? `${mnyBalance.toLocaleString()} MNY` : '...'}
                </span>
              </span>
            </div>
          )}

          {creating ? (
            <div className="flex items-center justify-center min-h-[160px]">
              <div
                className="text-lg font-black tracking-widest animate-pulse"
                style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}
              >
                CREATING...
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
              {tiers.map((tier) => (
                <TierCard key={`${currency}-${tier.id}`} tier={tier} onSelect={() => handleCreate(tier)} creating={creating} currency={currency} />
              ))}
            </div>
          )}
        </section>

        {/* Open Matches */}
        <section className="relative z-10 px-4 pb-12 flex-1">
          <div className="flex items-center gap-2 mb-3 max-w-md mx-auto">
            <Users className="h-4 w-4" style={{ color: ACCENT }} />
            <p
              className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              Open Matches
            </p>
          </div>

          <div className="max-w-md mx-auto">
            {waitingMatches.length === 0 ? (
              <Card className="bg-card/60 border border-border">
                <CardContent className="p-8 text-center">
                  <Scissors className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-muted-foreground">No open matches right now.</p>
                  <p className="text-muted-foreground text-sm mt-1">Create one above!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {waitingMatches.map((match) => (
                  <WaitingMatchCard
                    key={match.id}
                    match={match}
                    userAddress={user?.address}
                    onJoin={() => handleJoin(match)}
                    joining={joiningId === match.id}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </PageLayout>
  );
};

export default RpsLobby;
