import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";;
import { toast } from 'sonner';
import { PageLayout } from '@/components/poof-ui';
import { Particles } from '@/components/effects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Coins, Users, Trophy, Clock, XCircle } from 'lucide-react';
import WalletButton from '@/components/WalletButton';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import {
  subscribeManyCoinFlipMatches,
  setCoinFlipMatches,
  updateCoinFlipMatches,
  CoinFlipMatchesResponse,
} from '@/lib/collections/coinFlipMatches';
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

const ACCENT = 'hsl(45 100% 60%)';

interface Tier {
  id: number;
  label: string;
  sol: number;
  lamports: number;
  prize: number;
  colorClass: string;
  borderClass: string;
  gradientClass: string;
}

type Currency = 'SOL' | 'MNY';

const SOL_TIERS: Tier[] = [
  {
    id: 1,
    label: 'Tier 1',
    sol: 0.01,
    lamports: Number(COINFLIP_TIER1_LAMPORTS),
    prize: 0.0199,
    colorClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/40 hover:border-emerald-500/70',
    gradientClass: 'from-emerald-500/15 to-emerald-500/5',
  },
  {
    id: 2,
    label: 'Tier 2',
    sol: 0.05,
    lamports: Number(COINFLIP_TIER2_LAMPORTS),
    prize: 0.0995,
    colorClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/40 hover:border-yellow-500/70',
    gradientClass: 'from-yellow-500/15 to-yellow-500/5',
  },
  {
    id: 3,
    label: 'Tier 3',
    sol: 0.1,
    lamports: Number(COINFLIP_TIER3_LAMPORTS),
    prize: 0.199,
    colorClass: 'text-orange-400',
    borderClass: 'border-orange-500/40 hover:border-orange-500/70',
    gradientClass: 'from-orange-500/15 to-orange-500/5',
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
    prize: parseFloat((MNY_CASUAL_DISPLAY * 2 * 0.99).toFixed(4)),
    colorClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/40 hover:border-emerald-500/70',
    gradientClass: 'from-emerald-500/15 to-emerald-500/5',
  },
  {
    id: 2,
    label: 'Tier 2',
    sol: MNY_STANDARD_DISPLAY,
    lamports: Number(MNY_TIER_STANDARD_BASE_UNITS),
    prize: parseFloat((MNY_STANDARD_DISPLAY * 2 * 0.99).toFixed(4)),
    colorClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/40 hover:border-yellow-500/70',
    gradientClass: 'from-yellow-500/15 to-yellow-500/5',
  },
  {
    id: 3,
    label: 'Tier 3',
    sol: MNY_HIGH_DISPLAY,
    lamports: Number(MNY_TIER_HIGH_BASE_UNITS),
    prize: parseFloat((MNY_HIGH_DISPLAY * 2 * 0.99).toFixed(4)),
    colorClass: 'text-orange-400',
    borderClass: 'border-orange-500/40 hover:border-orange-500/70',
    gradientClass: 'from-orange-500/15 to-orange-500/5',
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
      className={`relative rounded-2xl border ${tier.borderClass} bg-card/60 backdrop-blur-sm p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group ${creating ? 'pointer-events-none opacity-60' : ''}`}
    >
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${tier.gradientClass} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground tracking-widest uppercase font-semibold mb-1" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            {tier.label}
          </div>
          <div className={`text-2xl font-black ${tier.colorClass}`} style={{ fontFamily: "'Orbitron', sans-serif" }}>
            {displayAmount} {unit}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Trophy className="h-3 w-3 text-yellow-500" />
            Win <span className="font-bold text-foreground ml-1">{displayPrize} {unit}</span>
          </div>
        </div>
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${tier.borderClass} bg-gradient-to-br ${tier.gradientClass}`}
        >
          <Coins className={`h-6 w-6 ${tier.colorClass}`} />
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
  onCancel,
  cancelling,
}: {
  match: CoinFlipMatchesResponse;
  userAddress?: string;
  onJoin: () => void;
  joining: boolean;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const navigate = useNavigate();
  const tiers = match.buyInCurrency === 'MNY' ? MNY_TIERS : SOL_TIERS;
  const tier = tiers.find((t) => t.id === match.tier) ?? tiers[0];
  const isCreator = match.creator === userAddress;
  const isOpponent = match.opponent === userAddress;
  const unit = match.buyInCurrency === 'MNY' ? 'MNY' : 'SOL';
  const displayAmount = match.buyInCurrency === 'MNY' ? tier.sol : tier.sol;

  return (
    <div
      className={`rounded-2xl border ${tier.borderClass} bg-card/60 backdrop-blur-sm p-4 transition-colors`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-muted-foreground font-semibold tracking-widest uppercase">Waiting</span>
        </div>
        <Badge className={`text-xs font-black px-2 py-0.5`} style={{ fontFamily: "'Orbitron', sans-serif", background: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40` }}>
          {displayAmount} {unit}
        </Badge>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 rounded-xl bg-primary/10 border border-primary/20 p-2 text-center">
          <div className="text-xs text-muted-foreground mb-0.5">Creator</div>
          <div className="text-xs font-bold text-foreground">{truncateAddress(match.creator)}</div>
        </div>
        <div className="text-muted-foreground font-black text-sm" style={{ fontFamily: "'Orbitron', sans-serif" }}>VS</div>
        <div className={`flex-1 rounded-xl p-2 text-center ${match.opponent ? 'bg-primary/10 border border-primary/20' : 'bg-muted/20 border border-dashed border-border'}`}>
          <div className="text-xs text-muted-foreground mb-0.5">Opponent</div>
          {match.opponent ? (
            <div className="text-xs font-bold text-foreground">{truncateAddress(match.opponent)}</div>
          ) : (
            <div className="text-xs text-muted-foreground">Open</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {timeAgo(match.ts)}
        </div>
        {isCreator && !match.opponent && (
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="flex items-center gap-1 text-[10px] text-red-400/80 hover:text-red-400 font-bold tracking-widest transition-colors disabled:opacity-50"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            <XCircle className="h-3 w-3" />
            {cancelling ? '...' : 'CANCEL'}
          </button>
        )}
      </div>

      {isCreator ? (
        <Button
          size="sm"
          variant="secondary"
          className="w-full h-10 font-bold tracking-widest"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
          onClick={() => navigate(`/coinflip/${match.id}`)}
        >
          VIEW YOUR MATCH
        </Button>
      ) : isOpponent ? (
        <Button
          size="sm"
          variant="secondary"
          className="w-full h-10 font-bold tracking-widest"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
          onClick={() => navigate(`/coinflip/${match.id}`)}
        >
          VIEW MATCH
        </Button>
      ) : (
        <Button
          size="sm"
          className="w-full h-10 font-black tracking-widest active:scale-95 transition-transform"
          style={{ fontFamily: "'Orbitron', sans-serif", background: ACCENT, color: '#000', boxShadow: `0 0 20px ${ACCENT}40` }}
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

export const CoinFlipLobby: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
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

  const { data: allMatches } = useRealtimeData<CoinFlipMatchesResponse[]>(
    subscribeManyCoinFlipMatches,
    true,
  );

  const waitingMatches = (allMatches ?? []).filter(
    (m) => m.state === 'waiting' && !m.opponent && (selectedTier === null || m.tier === selectedTier)
  );

  async function handleCreate(tier: Tier) {
    if (!user) {
      toast.error('Connect your wallet first');
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const matchId = `cf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const success = await setCoinFlipMatches(matchId, {
        creator: Address.publicKey(user.address),
        tier: tier.id,
        buyIn: tier.lamports,
        state: 'waiting',
        ts: Time.Now as any,
        buyInCurrency: currency,
      });
      if (success) {
        toast.success(`${tier.label} CoinFlip match created!`);
        navigate(`/coinflip/${matchId}`);
      } else {
        toast.error('Failed to create — wallet may have denied the buy-in');
      }
    } catch {
      toast.error('Error creating match');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(match: CoinFlipMatchesResponse) {
    if (!user) {
      toast.error('Connect your wallet first');
      return;
    }
    if (joiningId) return;
    setJoiningId(match.id);
    try {
      const success = await updateCoinFlipMatches(match.id, {
        opponent: Address.publicKey(user.address),
      });
      if (success) {
        toast.success('Joined! Flipping coin...');
        navigate(`/coinflip/${match.id}`);
      } else {
        toast.error('Failed to join — wallet may have denied the buy-in');
      }
    } catch {
      toast.error('Error joining match');
    } finally {
      setJoiningId(null);
    }
  }

  async function handleCancel(match: CoinFlipMatchesResponse) {
    if (!user || cancellingId) return;
    setCancellingId(match.id);
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
      } else {
        toast.error('Failed to cancel — please try again');
      }
    } catch {
      toast.error('Error cancelling match');
    } finally {
      setCancellingId(null);
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
            <span className="text-sm font-bold tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              BACK
            </span>
          </button>
          <div className="text-right">
            <h1
              className="text-xl font-black tracking-widest"
              style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT, textShadow: `0 0 20px ${ACCENT}60` }}
            >
              COINFLIP
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-wider">1V1 · PROVABLY FAIR</p>
          </div>
        </header>

        {/* Hero */}
        <section className="relative z-10 px-4 pt-6 pb-4 text-center">
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}40`, boxShadow: `0 0 30px ${ACCENT}20` }}
            >
              <Coins className="h-8 w-8" style={{ color: ACCENT }} />
            </div>
          </div>
          <h2
            className="text-3xl font-black leading-tight mb-2"
            style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT, textShadow: `0 0 40px ${ACCENT}40` }}
          >
            Choose Your Stakes
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
            Create a match or join an open one. On-chain resolution picks the winner — winner takes 99% of the pot.
          </p>
        </section>

        {/* Tier Selection */}
        <section className="relative z-10 px-4 pb-4">
          <div className="flex items-center justify-between mb-3 max-w-md mx-auto">
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold" style={{ fontFamily: "'Orbitron', sans-serif" }}>
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
              <div className="text-lg font-black tracking-widest animate-pulse" style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT }}>
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
          <div className="flex items-center justify-between mb-3 max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                Open Matches
              </p>
            </div>
            {/* Tier filter buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedTier(null)}
                className={`text-[9px] px-2 py-0.5 rounded-full border font-bold tracking-widest transition-colors ${selectedTier === null ? 'border-primary/70 text-primary bg-primary/10' : 'border-border text-muted-foreground'}`}
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                ALL
              </button>
              {tiers.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTier(selectedTier === t.id ? null : t.id)}
                  className={`text-[9px] px-2 py-0.5 rounded-full border font-bold tracking-widest transition-colors ${selectedTier === t.id ? 'border-primary/70 text-primary bg-primary/10' : 'border-border text-muted-foreground'}`}
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  T{t.id}
                </button>
              ))}
            </div>
          </div>

          <div className="max-w-md mx-auto">
            {waitingMatches.length === 0 ? (
              <Card className="bg-card/60 border border-border">
                <CardContent className="p-8 text-center">
                  <Coins className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
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
                    onCancel={() => handleCancel(match)}
                    cancelling={cancellingId === match.id}
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

export default CoinFlipLobby;
