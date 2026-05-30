import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";;
import { toast } from 'sonner';
import { PageLayout, StatCard } from '@/components/poof-ui';
import { Particles } from '@/components/effects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Coins, Info, FileText, Zap, Swords, Layers, Trophy, Clock, Scissors, ArrowRight, Radio, Sparkles, Lock, TrendingUp, Unlock } from 'lucide-react';
import WalletButton from '@/components/WalletButton';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { subscribeManyGames } from '@/lib/collections/games';
import { subscribeManyUsers } from '@/lib/collections/users';
import { subscribeManyCoinFlipMatches, CoinFlipMatchesResponse } from '@/lib/collections/coinFlipMatches';
import { subscribeManyRpsMatches, RpsMatchesResponse } from '@/lib/collections/rpsMatches';
import {
  subscribeMnyStakes,
  setMnyStakes,
  updateMnyStakes,
  MnyStakesResponse,
} from '@/lib/collections/mnyStakes';
import { runTokenBalanceQueryForCommonQueries } from '@/lib/collections/commonQueries';
import { runGetTokenMintAddressQueryForTprToken } from '@/lib/collections/tprToken';
import { Address, Time } from '@/lib/db-client';
import { gamesCatalog, GameDefinition } from '@/utils/games-catalog';

const ACCENT_GOLD = 'hsl(45 100% 60%)';

// ─── Staking Card ────────────────────────────────────────────────────────────

export function StakingCard() {
  const { user } = useAuth();
  const [stakeInput, setStakeInput] = useState('');
  const [unstakeInput, setUnstakeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mnyBalance, setMnyBalance] = useState<number | null>(null);
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);

  const { data: stakeRecord } = useRealtimeData<MnyStakesResponse | null>(
    subscribeMnyStakes,
    !!user?.address,
    user?.address ?? ''
  );

  const fetchMnyBalance = useCallback(async () => {
    if (!user?.address) { setMnyBalance(null); return; }
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

  useEffect(() => { fetchMnyBalance(); }, [fetchMnyBalance]);

  const stakedDisplay = stakeRecord ? (stakeRecord.amountStaked / 1e6) : 0;

  const handleStake = async () => {
    if (!user) { toast.error('Connect your wallet first'); return; }
    const amount = parseFloat(stakeInput);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    const amountBaseUnits = Math.floor(amount * 1e6);
    const newTotal = stakeRecord ? stakeRecord.amountStaked + amountBaseUnits : amountBaseUnits;
    setLoading(true);
    try {
      let success: boolean;
      if (stakeRecord) {
        success = await updateMnyStakes(user.address, {
          amountStaked: newTotal,
          stakedAt: Time.Now as any,
          unstakedAt: stakeRecord.unstakedAt,
          stakerAddress: Address.publicKey(user.address),
        });
      } else {
        success = await setMnyStakes(user.address, {
          stakerAddress: Address.publicKey(user.address),
          amountStaked: amountBaseUnits,
          stakedAt: Time.Now as any,
          unstakedAt: 0,
        });
      }
      if (success) {
        toast.success(`Staked ${amount} MNY!`);
        setStakeInput('');
        fetchMnyBalance();
      } else {
        toast.error('Stake failed — check wallet balance');
      }
    } catch {
      toast.error('Error staking');
    } finally {
      setLoading(false);
    }
  };

  const openUnstakeModal = () => {
    if (!user) { toast.error('Connect your wallet first'); return; }
    if (!stakeRecord || stakeRecord.amountStaked === 0) { toast.error('No MNY staked'); return; }
    const amount = parseFloat(unstakeInput);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    const amountBaseUnits = Math.floor(amount * 1e6);
    if (amountBaseUnits > stakeRecord.amountStaked) { toast.error('Cannot unstake more than staked'); return; }
    setShowUnstakeModal(true);
  };

  const handleUnstake = async () => {
    if (!user || !stakeRecord) return;
    const amount = parseFloat(unstakeInput);
    const amountBaseUnits = Math.floor(amount * 1e6);
    const newTotal = stakeRecord.amountStaked - amountBaseUnits;
    setLoading(true);
    try {
      const success = await updateMnyStakes(user.address, {
        amountStaked: newTotal,
        stakedAt: stakeRecord.stakedAt,
        unstakedAt: Time.Now as any,
        stakerAddress: Address.publicKey(user.address),
      });
      if (success) {
        toast.success(`Unstaked ${amount} MNY`);
        setUnstakeInput('');
        setShowUnstakeModal(false);
        fetchMnyBalance();
      } else {
        toast.error('Unstake failed');
      }
    } catch {
      toast.error('Error unstaking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      className="relative overflow-hidden border bg-card/60 backdrop-blur-sm max-w-md mx-auto"
      style={{ borderColor: `${ACCENT_GOLD}40` }}
    >
      {/* Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${ACCENT_GOLD}10 0%, transparent 60%)` }}
      />
      <CardContent className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${ACCENT_GOLD}20`, border: `1px solid ${ACCENT_GOLD}40` }}
            >
              <Lock className="h-4 w-4" style={{ color: ACCENT_GOLD }} />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                STAKE MNY
              </h3>
              <p className="text-[10px] text-muted-foreground">Earn SOL fee share hourly</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase font-semibold">Staked</div>
            <div className="text-base font-black" style={{ fontFamily: "'Orbitron', sans-serif", color: ACCENT_GOLD }}>
              {stakedDisplay > 0 ? stakedDisplay.toLocaleString() : '—'} MNY
            </div>
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-2 rounded-xl p-3 mb-4" style={{ background: `${ACCENT_GOLD}08`, border: `1px solid ${ACCENT_GOLD}20` }}>
          <TrendingUp className="h-4 w-4 shrink-0" style={{ color: ACCENT_GOLD }} />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Stakers earn a <span className="text-foreground font-bold">pro-rata share</span> of the platform's SOL fee pool, distributed <span className="text-foreground font-bold">every hour</span>. Only staked MNY earns — holding alone does not.
          </p>
        </div>

        {user ? (
          <div className="space-y-3">
            {/* Balance */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Wallet balance</span>
              <span className="font-bold text-foreground">
                {mnyBalance !== null ? `${mnyBalance.toLocaleString()} MNY` : '...'}
              </span>
            </div>

            {/* Stake row */}
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                placeholder="Amount to stake"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                className="h-10 text-sm flex-1 bg-background/50"
                style={{ borderColor: `${ACCENT_GOLD}30` }}
              />
              <Button
                size="sm"
                className="h-10 px-4 font-bold tracking-wider text-xs shrink-0"
                style={{ fontFamily: "'Orbitron', sans-serif", background: ACCENT_GOLD, color: '#000' }}
                onClick={handleStake}
                disabled={loading || !stakeInput}
              >
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                STAKE
              </Button>
            </div>

            {/* Unstake row */}
            {stakedDisplay > 0 && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  max={stakedDisplay}
                  placeholder="Amount to unstake"
                  value={unstakeInput}
                  onChange={(e) => setUnstakeInput(e.target.value)}
                  className="h-10 text-sm flex-1 bg-background/50"
                  style={{ borderColor: 'hsl(var(--border))' }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-10 px-4 font-bold tracking-wider text-xs shrink-0"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                  onClick={openUnstakeModal}
                  disabled={loading || !unstakeInput}
                >
                  <Unlock className="h-3.5 w-3.5 mr-1.5" />
                  UNSTAKE
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">Connect your wallet to stake MNY</p>
        )}
      </CardContent>

      <Dialog open={showUnstakeModal} onOpenChange={setShowUnstakeModal}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle
              className="text-base font-black tracking-wider"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              Confirm Unstake
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              You are about to unstake{' '}
              <span className="text-foreground font-bold">
                {parseFloat(unstakeInput || '0').toLocaleString()} MNY
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2">
            <Button
              variant="secondary"
              className="w-full sm:w-auto font-bold tracking-wider text-xs"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
              onClick={() => setShowUnstakeModal(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto font-bold tracking-wider text-xs"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                background: ACCENT_GOLD,
                color: '#000',
              }}
              onClick={handleUnstake}
              disabled={loading}
            >
              <Unlock className="h-3.5 w-3.5 mr-1.5" />
              Confirm Unstake
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Game Card ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  Zap: <Zap className="h-7 w-7" />,
  Layers: <Layers className="h-7 w-7" />,
  Trophy: <Trophy className="h-7 w-7" />,
  Clock: <Clock className="h-7 w-7" />,
  Scissors: <Scissors className="h-7 w-7" />,
};

interface GameCardProps {
  game: GameDefinition;
}

function GameCard({ game }: GameCardProps) {
  const navigate = useNavigate();
  const isLive = game.status === 'live';

  return (
    <Card
      className="relative overflow-hidden border border-border hover:border-accent/50 transition-all duration-300 group cursor-pointer bg-card/60 backdrop-blur-sm"
      onClick={() => isLive && navigate(game.route)}
    >
      {/* Hover glow */}
      {isLive && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${game.accentColor}15 0%, transparent 70%)`,
          }}
        />
      )}

      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="flex items-center justify-center h-12 w-12 rounded-2xl"
            style={{
              background: isLive ? `${game.accentColor}20` : 'hsl(var(--muted)/0.3)',
              border: `1px solid ${isLive ? game.accentColor + '40' : 'hsl(var(--border))'}`,
              color: isLive ? game.accentColor : 'hsl(var(--muted-foreground))',
            }}
          >
            {ICON_MAP[game.icon] ?? <Zap className="h-7 w-7" />}
          </div>

          {isLive ? (
            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs px-2 py-0.5 gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </Badge>
          ) : (
            <Badge className="bg-muted/30 text-muted-foreground border-border text-xs px-2 py-0.5">
              SOON
            </Badge>
          )}
        </div>

        {/* Name + tagline */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3
            className="text-xl font-black tracking-wide"
            style={{ fontFamily: "'Orbitron', sans-serif", color: isLive ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}
          >
            {game.name}
          </h3>
          {isLive && game.potBadge && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest border cursor-default"
                    style={{
                      color: game.accentColor,
                      borderColor: `${game.accentColor}50`,
                      backgroundColor: `${game.accentColor}15`,
                      fontFamily: "'Orbitron', sans-serif",
                    }}
                  >
                    {game.potBadge}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>*minus fees</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{game.tagline}</p>

        {/* CTA */}
        {isLive ? (
          <Button
            className="w-full font-black tracking-widest h-11 gap-2 group-hover:shadow-lg transition-all"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              boxShadow: '0 0 20px hsl(var(--primary)/0.3)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              navigate(game.route);
            }}
          >
            <Zap className="h-4 w-4" />
            PLAY NOW
            <ArrowRight className="h-4 w-4 ml-auto opacity-70" />
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="w-full font-bold tracking-widest h-11 opacity-50 cursor-not-allowed"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
            disabled
          >
            <Radio className="h-4 w-4 mr-2" />
            COMING SOON
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export const PlayroomPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: games } = useRealtimeData(
    subscribeManyGames,
    true
  );
  const { data: coinFlipMatches } = useRealtimeData<CoinFlipMatchesResponse[]>(
    subscribeManyCoinFlipMatches,
    true
  );
  const { data: rpsMatches } = useRealtimeData<RpsMatchesResponse[]>(
    subscribeManyRpsMatches,
    true
  );
  const { data: users } = useRealtimeData(
    subscribeManyUsers,
    true
  );
  const { data: stakeRecord } = useRealtimeData<MnyStakesResponse | null>(
    subscribeMnyStakes,
    !!user?.address,
    user?.address ?? ''
  );
  const stakedDisplay = stakeRecord ? (stakeRecord.amountStaked / 1e6) : 0;

  // Games Played = resolved tapwars + resolved coinflip + completed rps
  const tapwarsResolved = (games ?? []).filter(g => g.state === 'resolved').length;
  const coinFlipResolved = (coinFlipMatches ?? []).filter(m => m.state === 'resolved').length;
  const rpsCompleted = (rpsMatches ?? []).filter(m => m.status === 'complete').length;
  const gamesPlayed = tapwarsResolved + coinFlipResolved + rpsCompleted;
  const activePlayers = users?.length ?? 0;

  // Minigame prize pool = total buy-in escrow across active games/matches
  // TapWars: waiting or playing states, pot = buyIn * playerCount
  const tapwarsPool = (games ?? []).reduce((sum, g) => {
    if (g.state === 'waiting' || g.state === 'playing') {
      return sum + g.buyIn * g.playerCount;
    }
    return sum;
  }, 0);
  // CoinFlip: waiting state. If opponent has joined, both players have staked (buyIn * 2).
  // If only the creator is waiting, only one player has staked (buyIn).
  const coinFlipPool = (coinFlipMatches ?? []).reduce((sum, m) => {
    if (m.state === 'waiting') {
      return sum + (m.opponent != null ? m.buyIn * 2 : m.buyIn);
    }
    return sum;
  }, 0);
  // RPS: waiting or active states, pot = buyInLamports * 2 (both players paid in when active; 1 when waiting)
  const rpsPool = (rpsMatches ?? []).reduce((sum, m) => {
    if (m.status === 'active') {
      return sum + m.buyInLamports * 2;
    }
    if (m.status === 'waiting') {
      return sum + m.buyInLamports;
    }
    return sum;
  }, 0);
  const minigamePool = tapwarsPool + coinFlipPool + rpsPool;
  const displayMinigamePool = minigamePool > 0
    ? `${(minigamePool / 1e9).toLocaleString()} SOL`
    : '-';

  return (
    <PageLayout fullBleed footer={false}>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <Particles quantity={50} color="hsl(280 100% 65%)" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 pt-5 pb-2">
          <div>
            <h1
              className="text-xl sm:text-2xl font-black tracking-widest gradient-text"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              THE PLAYROOM
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <WalletButton />
            {user && stakedDisplay > 0 && (
              <Badge
                className="text-[10px] font-black tracking-wider px-2 py-1 border cursor-pointer hover:brightness-110 transition-all"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  color: ACCENT_GOLD,
                  borderColor: `${ACCENT_GOLD}40`,
                  background: `${ACCENT_GOLD}15`,
                }}
                onClick={() => navigate('/marketplace?tab=stake')}
              >
                <Lock className="h-2.5 w-2.5 mr-1" />
                {stakedDisplay.toLocaleString()} MNY
              </Badge>
            )}
          </div>
        </header>

        {/* Hero */}
        <section className="relative z-10 px-4 pt-8 pb-4 text-center">
          <h2
            className="text-3xl sm:text-5xl font-black leading-tight mb-2 gradient-text"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            Mini-Games<br />on Solana
          </h2>

          <p className="text-muted-foreground text-sm text-center leading-relaxed">
            Quick, on-chain games. Real stakes.
          </p>
        </section>

        {/* Metrics Grid */}
        <section className="relative z-10 px-4 pb-2">
          <div className="grid grid-cols-3 gap-2 max-w-[50%] mx-auto">
            <StatCard
              label="Minigame Prize Pool"
              value={displayMinigamePool}
              className="animate-fade-in-up delay-1"
            />
            <StatCard
              label="Games Played"
              value={gamesPlayed > 0 ? gamesPlayed.toLocaleString() : '-'}
              className="animate-fade-in-up delay-2"
            />
            <StatCard
              label="Active Players"
              value={activePlayers > 0 ? activePlayers.toLocaleString() : '-'}
              className="animate-fade-in-up delay-3"
            />
          </div>
        </section>

        {/* Game Selection */}
        <section className="relative z-10 px-4 pt-4 pb-16 flex-1">
          <p
            className="text-xs text-muted-foreground tracking-widest uppercase font-bold mb-4"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            Select a game
          </p>

          <div className="grid grid-cols-1 gap-4 max-w-md mx-auto">
            {gamesCatalog.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </section>

        {/* Bottom Navigation Buttons */}
        <section className="relative z-10 px-4 pb-12">
          <div className="flex items-center justify-center gap-4 max-w-sm mx-auto flex-wrap">
            {/* Daily Spin */}
            <button
              onClick={() => navigate('/daily-spin')}
              className="flex flex-col items-center gap-2 group"
              aria-label="Daily Spin"
            >
              <div className="w-14 h-14 rounded-full border border-accent/40 flex items-center justify-center transition-colors group-hover:border-accent group-hover:bg-accent/10 bg-accent/5">
                <Sparkles className="h-5 w-5 text-accent transition-colors group-hover:text-accent" />
              </div>
              <span className="text-[10px] text-accent tracking-widest uppercase font-bold group-hover:text-foreground transition-colors">
                Daily Spin
              </span>
            </button>

            {/* Token */}
            <button
              onClick={() => navigate('/marketplace')}
              className="flex flex-col items-center gap-2 group"
              aria-label="Token"
            >
              <div
                className="w-14 h-14 rounded-full border flex items-center justify-center transition-colors group-hover:brightness-110"
                style={{
                  borderColor: `${ACCENT_GOLD}60`,
                  background: `${ACCENT_GOLD}10`,
                  boxShadow: `0 0 16px ${ACCENT_GOLD}20, inset 0 0 8px ${ACCENT_GOLD}10`,
                }}
              >
                <Coins className="h-5 w-5 transition-colors group-hover:brightness-125" style={{ color: ACCENT_GOLD }} />
              </div>
              <span
                className="text-[10px] tracking-widest uppercase font-semibold transition-colors group-hover:brightness-125"
                style={{ color: ACCENT_GOLD }}
              >
                Token
              </span>
            </button>

            {/* My Matches */}
            <button
              onClick={() => navigate('/my-matches')}
              className="flex flex-col items-center gap-2 group"
              aria-label="My Matches"
            >
              <div className="w-14 h-14 rounded-full border border-primary/40 flex items-center justify-center transition-colors group-hover:border-primary group-hover:bg-primary/10 bg-primary/5">
                <Swords className="h-5 w-5 text-primary transition-colors group-hover:text-primary" />
              </div>
              <span className="text-[10px] text-primary tracking-widest uppercase font-bold group-hover:text-foreground transition-colors">
                Match History
              </span>
            </button>

            {/* Whitepaper */}
            <button
              onClick={() => navigate('/whitepaper')}
              className="flex flex-col items-center gap-2 group"
              aria-label="Whitepaper"
            >
              <div className="w-14 h-14 rounded-full border border-border/60 flex items-center justify-center transition-colors group-hover:border-primary/60 group-hover:bg-primary/5">
                <Info className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-semibold group-hover:text-foreground transition-colors">
                Whitepaper
              </span>
            </button>

            {/* Terms */}
            <button
              onClick={() => navigate('/terms')}
              className="flex flex-col items-center gap-2 group"
              aria-label="Terms"
            >
              <div className="w-14 h-14 rounded-full border border-border/60 flex items-center justify-center transition-colors group-hover:border-primary/60 group-hover:bg-primary/5">
                <FileText className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-semibold group-hover:text-foreground transition-colors">
                Terms
              </span>
            </button>
          </div>
        </section>
      </div>
    </PageLayout>
  );
};

export default PlayroomPage;
