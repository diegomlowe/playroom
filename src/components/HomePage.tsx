import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";;
import { toast } from 'sonner';
import { PageLayout } from '@/components/poof-ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Particles } from '@/components/effects';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { subscribeManyGames, setGames, GamesResponse } from '@/lib/collections/games';
import { setSeedSpinPool } from '@/lib/collections/seedSpinPool';
import { subscribeDailySpinPool, DailySpinPoolResponse } from '@/lib/collections/dailySpinPool';
import { Address, Time } from '@/lib/db-client';
import WalletButton from '@/components/WalletButton';
import { Zap, Users, Trophy, ArrowLeft, ShieldAlert } from 'lucide-react';
import { ADMIN_ADDRESS } from '@/lib/constants';

function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [seedAmount, setSeedAmount] = useState<string>('10000');
  const [seeding, setSeeding] = useState(false);

  const isAdmin = !!user && user.address === ADMIN_ADDRESS;

  async function handleSeedSpinPool() {
    if (!user || seeding) return;
    const humanAmount = parseFloat(seedAmount);
    if (!humanAmount || humanAmount <= 0) {
      toast.error('Enter a valid MNY amount');
      return;
    }
    const rawAmount = Math.round(humanAmount * 1_000_000);
    setSeeding(true);
    try {
      const seedId = `seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const success = await setSeedSpinPool(seedId, {
        amount: rawAmount,
        createdAt: Time.Now,
        createdBy: Address.publicKey(user.address),
      });
      if (success) {
        toast.success(`Seeded spin pool with ${humanAmount.toLocaleString()} MNY`);
      } else {
        toast.error('Seed failed — transaction denied or policy rejected');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unexpected error seeding pool');
    } finally {
      setSeeding(false);
    }
  }

  const { data: allGames } = useRealtimeData<GamesResponse[]>(
    subscribeManyGames,
    true,
  );

  const { data: spinPoolData } = useRealtimeData<DailySpinPoolResponse | null>(
    subscribeDailySpinPool,
    isAdmin,
    'main',
  );

  const spinPoolBalanceMny = spinPoolData?.balance != null
    ? (spinPoolData.balance / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : null;

  const waitingGames = (allGames ?? []).filter(
    (g) => g.state === 'waiting' && (g.playerCount as number) < 4
  );

  async function handleJoin(game: GamesResponse) {
    if (!user) {
      toast.error('Connect your wallet first');
      return;
    }
    if (joiningId) return;
    setJoiningId(game.id);
    try {
      const slotsFilled = game.playerCount as number;
      const nextSlot = !game.player2 ? 'player2' : !game.player3 ? 'player3' : 'player4';
      const newCount = slotsFilled + 1;
      const willStart = newCount === 4;

      const success = await setGames(game.id, {
        creator: Address.publicKey(game.creator),
        player2: game.player2
          ? Address.publicKey(game.player2)
          : nextSlot === 'player2'
          ? Address.publicKey(user.address)
          : undefined,
        player3: game.player3
          ? Address.publicKey(game.player3)
          : nextSlot === 'player3'
          ? Address.publicKey(user.address)
          : undefined,
        player4: game.player4
          ? Address.publicKey(game.player4)
          : nextSlot === 'player4'
          ? Address.publicKey(user.address)
          : undefined,
        playerCount: newCount,
        state: willStart ? 'playing' : 'waiting',
        createdAt: game.createdAt as number,
        startedAt: willStart ? (Time.Now as any) : (game.startedAt as number),
        winnerScore: game.winnerScore as number,
        secondPlaceScore: game.secondPlaceScore as number,
        gameType: 'tapwars',
        buyIn: game.buyIn,
        buyInCurrency: 'SOL',
      });
      if (success) {
        navigate(`/games/${game.id}`);
      } else {
        toast.error('Failed to join — wallet may have denied the 0.1 SOL buy-in');
      }
    } catch {
      toast.error('Error joining game');
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <PageLayout fullBleed footer={false}>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <Particles quantity={60} color="hsl(280 100% 65%)" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
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
              TAPWARS
            </h1>
          </div>
          <WalletButton />
        </header>

        {/* Hero */}
        <section className="relative z-10 px-4 pt-8 pb-6 text-center">
          <div className="mb-3 flex justify-center">
            <Badge className="bg-accent/20 text-accent border-accent/40 px-3 py-1 text-xs tracking-widest font-semibold">
              4 PLAYERS · 10 SECONDS · WINNER TAKES 3×
            </Badge>
          </div>
          <h2
            className="text-4xl font-black leading-tight mb-3"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            <span className="gradient-text">TAP FASTER.</span>
            <br />
            <span className="text-foreground">WIN BIG.</span>
          </h2>
          <p className="text-muted-foreground text-base mb-8 max-w-sm mx-auto leading-relaxed">
            Pay 0.1 SOL to enter. Tap as fast as you can. Winner gets{' '}
            <span className="text-accent font-bold">0.3 SOL</span>.
          </p>

          {/* Prize breakdown */}
          <div className="flex justify-center mb-8">
            <div className="glass rounded-xl p-4 border border-accent/30">
              <Trophy className="h-5 w-5 text-accent mx-auto mb-1" />
              <div
                className="text-accent font-black text-sm"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                0.3
              </div>
              <div className="text-muted-foreground text-xs">1st Prize · SOL</div>
            </div>
          </div>

          {/* Play CTA */}
          {user ? (
            <Button
              onClick={() => navigate('/tapwars/new')}
              size="lg"
              className="w-full max-w-sm h-16 text-xl font-black tracking-widest rounded-2xl shadow-lg shadow-primary/40 active:scale-95 transition-transform"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              <Zap className="mr-2 h-6 w-6" />
              PLAY
            </Button>
          ) : (
            <div className="max-w-sm mx-auto text-center">
              <p className="text-muted-foreground text-sm mb-3">Connect wallet to play</p>
              <WalletButton />
            </div>
          )}
        </section>

        {/* Admin: Seed Spin Pool */}
        {isAdmin && (
          <section className="relative z-10 px-4 pb-4">
            <Card className="border border-yellow-500/30 bg-yellow-500/5">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-yellow-400 tracking-widest uppercase" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                  <ShieldAlert className="h-4 w-4" />
                  Admin · Seed Spin Pool
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {/* Pool Balance */}
                <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <span className="text-xs text-yellow-400/70 font-semibold tracking-widest uppercase">Pool Balance</span>
                  <span
                    className="text-sm font-black text-yellow-300 tabular-nums"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    {spinPoolBalanceMny != null ? `${spinPoolBalanceMny} MNY` : '—'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      min="1"
                      step="1000"
                      value={seedAmount}
                      onChange={(e) => setSeedAmount(e.target.value)}
                      placeholder="Amount in MNY"
                      className="h-10 bg-background/60 border-yellow-500/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-yellow-500/50"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      MNY amount (human units, 6 decimals)
                    </p>
                  </div>
                  <Button
                    onClick={handleSeedSpinPool}
                    disabled={seeding}
                    className="h-10 px-4 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/40 font-bold text-xs tracking-widest shrink-0"
                    variant="outline"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    {seeding ? 'SEEDING...' : 'SEED POOL'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Open Lobbies */}
        <section className="relative z-10 px-4 pb-10 flex-1">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            <h3
              className="text-sm font-bold tracking-widest text-muted-foreground uppercase"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              Open Lobbies
            </h3>
          </div>

          {waitingGames.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center border border-border">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">No open games right now.</p>
              <p className="text-muted-foreground text-sm mt-1">Create one above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {waitingGames.map((game) => (
                <GameLobbyCard
                  key={game.id}
                  game={game}
                  userAddress={user?.address}
                  onJoin={() => handleJoin(game)}
                  joining={joiningId === game.id}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
};

interface GameLobbyCardProps {
  game: GamesResponse;
  userAddress?: string;
  onJoin: () => void;
  joining: boolean;
}

function GameLobbyCard({ game, userAddress, onJoin, joining }: GameLobbyCardProps) {
  const navigate = useNavigate();
  const isPlayer =
    game.creator === userAddress ||
    game.player2 === userAddress ||
    game.player3 === userAddress ||
    game.player4 === userAddress;

  const slotsFilled = game.playerCount as number;

  return (
    <div
      className="glass rounded-2xl p-4 border border-border hover:border-primary/40 transition-colors cursor-pointer"
      onClick={() => navigate(`/games/${game.id}`)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-muted-foreground font-semibold tracking-widest uppercase">
            WAITING
          </span>
        </div>
        <Badge
          className="bg-accent/20 text-accent border-accent/40 text-xs font-black"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          {slotsFilled}/4
        </Badge>
      </div>

      {/* Player slots */}
      <div className="grid grid-cols-4 gap-1.5 mb-4">
        {[game.creator, game.player2, game.player3, game.player4].map((addr, i) => (
          <div
            key={i}
            className={`rounded-lg p-2 text-center text-xs ${
              addr
                ? 'bg-primary/20 border border-primary/40 text-primary font-semibold'
                : 'bg-muted/30 border border-dashed border-border text-muted-foreground'
            }`}
          >
            {addr ? truncateAddress(addr) : '—'}
          </div>
        ))}
      </div>

      {isPlayer ? (
        <Button
          size="sm"
          variant="secondary"
          className="w-full h-11 font-bold tracking-widest"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/games/${game.id}`);
          }}
        >
          VIEW LOBBY
        </Button>
      ) : (
        <Button
          size="sm"
          className="w-full h-11 font-black tracking-widest shadow-md shadow-primary/30 active:scale-95 transition-transform"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
          onClick={(e) => {
            e.stopPropagation();
            onJoin();
          }}
          disabled={joining}
        >
          {joining ? 'JOINING...' : 'JOIN · 0.1 SOL'}
        </Button>
      )}
    </div>
  );
}

export default HomePage;
