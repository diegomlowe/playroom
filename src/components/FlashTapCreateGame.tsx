import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/poof-ui';
import { Particles } from '@/components/effects';
import { ArrowLeft, ChevronRight, Trophy, Coins } from 'lucide-react';
import { setFlashMatches } from '@/lib/collections/flashMatches';
import { runTokenBalanceQueryForCommonQueries } from '@/lib/collections/commonQueries';
import { runGetTokenMintAddressQueryForTprToken } from '@/lib/collections/tprToken';
import { Address, Time } from '@/lib/db-client';
import { useAuth } from "@/hooks/useAuth";;
import { toast } from 'sonner';
import {
  MNY_TIER_CASUAL_BASE_UNITS,
  MNY_TIER_STANDARD_BASE_UNITS,
  MNY_TIER_HIGH_BASE_UNITS,
} from '@/lib/constants';

function formatPrize(n: number): string {
  if (n % 1 === 0) return n.toFixed(1);
  const rounded2 = parseFloat(n.toFixed(2));
  if (rounded2 === n) return rounded2.toString();
  return parseFloat(n.toFixed(3)).toString();
}

interface BuyInTier {
  id: string;
  name: string;
  buyIn: number;
  buyInLabel: string;
  players: number;
  firstPrize: number;
  secondPrize: number;
  fee: number;
}

type Currency = 'SOL' | 'MNY';

const SOL_TIERS: BuyInTier[] = [
  {
    id: 'casual',
    name: 'Casual',
    buyIn: 0.01,
    buyInLabel: '0.01 SOL',
    players: 4,
    firstPrize: 0.03,
    secondPrize: 0.009,
    fee: 0.001,
  },
  {
    id: 'standard',
    name: 'Standard',
    buyIn: 0.1,
    buyInLabel: '0.1 SOL',
    players: 4,
    firstPrize: 0.3,
    secondPrize: 0.09,
    fee: 0.01,
  },
  {
    id: 'high-stakes',
    name: 'High Stakes',
    buyIn: 0.5,
    buyInLabel: '0.5 SOL',
    players: 4,
    firstPrize: 1.5,
    secondPrize: 0.45,
    fee: 0.05,
  },
];

// MNY base units → display MNY: divide by 1e6
const MNY_CASUAL = Number(MNY_TIER_CASUAL_BASE_UNITS) / 1e6;
const MNY_STANDARD = Number(MNY_TIER_STANDARD_BASE_UNITS) / 1e6;
const MNY_HIGH = Number(MNY_TIER_HIGH_BASE_UNITS) / 1e6;

const MNY_TIERS: BuyInTier[] = [
  {
    id: 'casual',
    name: 'Casual',
    buyIn: MNY_CASUAL,
    buyInLabel: `${MNY_CASUAL} MNY`,
    players: 4,
    firstPrize: parseFloat((MNY_CASUAL * 4 * 0.75).toFixed(6)),
    secondPrize: parseFloat((MNY_CASUAL * 4 * 0.225).toFixed(6)),
    fee: parseFloat((MNY_CASUAL * 4 * 0.025).toFixed(6)),
  },
  {
    id: 'standard',
    name: 'Standard',
    buyIn: MNY_STANDARD,
    buyInLabel: `${MNY_STANDARD} MNY`,
    players: 4,
    firstPrize: parseFloat((MNY_STANDARD * 4 * 0.75).toFixed(6)),
    secondPrize: parseFloat((MNY_STANDARD * 4 * 0.225).toFixed(6)),
    fee: parseFloat((MNY_STANDARD * 4 * 0.025).toFixed(6)),
  },
  {
    id: 'high-stakes',
    name: 'High Stakes',
    buyIn: MNY_HIGH,
    buyInLabel: `${MNY_HIGH} MNY`,
    players: 4,
    firstPrize: parseFloat((MNY_HIGH * 4 * 0.75).toFixed(6)),
    secondPrize: parseFloat((MNY_HIGH * 4 * 0.225).toFixed(6)),
    fee: parseFloat((MNY_HIGH * 4 * 0.025).toFixed(6)),
  },
];

function FlashTierCard({ tier, onClick, currency }: { tier: BuyInTier; onClick: () => void; currency: Currency }) {
  const totalPool = tier.buyIn * tier.players;
  const firstPrize = tier.firstPrize;
  const secondPrize = tier.secondPrize;
  const unit = currency === 'SOL' ? 'SOL' : 'MNY';

  const gradient =
    tier.id === 'casual'
      ? 'from-emerald-500/20 to-teal-500/5'
      : tier.id === 'standard'
        ? 'from-purple-500/20 to-blue-500/5'
        : 'from-amber-500/20 to-red-500/5';

  const border =
    tier.id === 'casual'
      ? 'border-emerald-500/30 hover:border-emerald-500/60'
      : tier.id === 'standard'
        ? 'border-purple-500/30 hover:border-purple-500/60'
        : 'border-amber-500/30 hover:border-amber-500/60';

  const accent =
    tier.id === 'casual'
      ? 'text-emerald-400'
      : tier.id === 'standard'
        ? 'text-purple-400'
        : 'text-amber-400';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className={`relative rounded-2xl border ${border} bg-card/60 backdrop-blur-sm p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group`}
    >
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              {tier.name}
            </h3>
            <p className={`text-2xl font-black ${accent}`} style={{ fontFamily: "'Orbitron', sans-serif" }}>
              {tier.buyInLabel}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient} border ${border}`}>
            <Coins className="h-6 w-6" style={{ color: 'currentColor' }} />
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-yellow-500" />
              1st Place
            </span>
            <span className="font-bold" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              {formatPrize(firstPrize)} {unit}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-gray-400" />
              2nd Place
            </span>
            <span className="font-bold" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              {formatPrize(secondPrize)} {unit}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border/50 pt-2">
            <span className="text-muted-foreground">Prize Pool</span>
            <span className="font-bold" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              {formatPrize(totalPool)} {unit}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold tracking-widest uppercase text-muted-foreground group-hover:text-foreground transition-colors" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          Create Match
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export const FlashTapCreateGame: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
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

  const handleCreate = async (tier: BuyInTier) => {
    if (!user?.address) {
      toast.error('Connect your wallet to create a match');
      return;
    }

    setCreating(true);
    try {
      const matchId = `ft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const buyIn = currency === 'MNY'
        ? Math.floor(tier.buyIn * 1_000_000)
        : Math.floor(tier.buyIn * 1_000_000_000);

      const success = await setFlashMatches(matchId, {
        creator: Address.publicKey(user.address),
        playerCount: 1,
        state: 'waiting',
        flashMomentMs: 0,
        winnerDeltaMs: 0,
        secondPlaceDeltaMs: 0,
        ts: Time.Now as any,
        buyIn,
        buyInCurrency: currency,
      });

      if (success) {
        toast.success(`${tier.name} FlashTap match created!`);
        navigate(`/flashtap/${matchId}`);
      } else {
        toast.error('Failed to create match. Check policy permissions.');
      }
    } catch (err) {
      toast.error('Failed to create match');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageLayout fullBleed footer={false}>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <Particles quantity={40} color="hsl(160 100% 45%)" />
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
              style={{
                fontFamily: "'Orbitron', sans-serif",
                color: 'hsl(160 100% 45%)',
                textShadow: '0 0 20px hsl(160 100% 45% / 0.5)',
              }}
            >
              FLASHTAP
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-wider">CHOOSE YOUR STAKES</p>
          </div>
        </header>

        {/* Hero */}
        <section className="relative z-10 px-4 pt-8 pb-6 text-center">
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: 'hsl(160 100% 45% / 0.15)',
                border: '1px solid hsl(160 100% 45% / 0.4)',
                boxShadow: '0 0 30px hsl(160 100% 45% / 0.2)',
              }}
            >
              <Coins
                className="h-8 w-8"
                style={{ color: 'hsl(160 100% 45%)' }}
              />
            </div>
          </div>
          <h2
            className="text-3xl sm:text-4xl font-black leading-tight mb-2"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: 'hsl(160 100% 45%)',
              textShadow: '0 0 40px hsl(160 100% 45% / 0.4)',
            }}
          >
            New Match
          </h2>
          <p className="text-muted-foreground text-sm text-center leading-relaxed max-w-xs mx-auto">
            React when the target flashes. Closest reaction time wins 75% of the pot.
          </p>
        </section>

        {/* Currency Toggle */}
        <section className="relative z-10 px-4 pb-4">
          <div className="flex items-center justify-center">
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
            <div className="text-center mt-2">
              <span className="text-[10px] text-muted-foreground tracking-wider uppercase font-semibold">
                Balance: {' '}
                <span className="text-foreground font-bold">
                  {mnyBalance !== null ? `${mnyBalance.toLocaleString()} MNY` : '...'}
                </span>
              </span>
            </div>
          )}
        </section>

        {/* Buy-in tiers */}
        <section className="relative z-10 px-4 pb-12 flex-1">
          {creating ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div
                className="text-lg font-black tracking-widest animate-pulse"
                style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(160 100% 45%)' }}
              >
                CREATING...
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 max-w-md mx-auto">
              {tiers.map((tier) => (
                <FlashTierCard key={`${currency}-${tier.id}`} tier={tier} onClick={() => handleCreate(tier)} currency={currency} />
              ))}
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
};

export default FlashTapCreateGame;
