import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useAuth";;
import { toast } from 'sonner';
import { PageLayout } from '@/components/poof-ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Particles } from '@/components/effects';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { subscribeGames, updateGames, GamesResponse } from '@/lib/collections/games';
import { subscribeManyGameSubmissionsPlayers, GameSubmissionsPlayersResponse } from '@/lib/collections/gameSubmissions';
import TapGame from '@/components/TapGame';
import { Trophy, Medal, Users, ArrowLeft, Clock, XCircle } from 'lucide-react';
import { Address } from '@/lib/db-client';

function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export const Lobby: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cancelling, setCancelling] = useState(false);

  const { data: game, loading } = useRealtimeData<GamesResponse | null>(
    subscribeGames,
    !!gameId,
    gameId!
  );

  const { data: submissions } = useRealtimeData<GameSubmissionsPlayersResponse[]>(
    subscribeManyGameSubmissionsPlayers,
    !!gameId,
    gameId!
  );

  // Redirect to tapwars lobby if game not found after loading
  useEffect(() => {
    if (!loading && game === null) {
      navigate('/tapwars');
    }
  }, [loading, game, navigate]);

  async function handleCancel() {
    if (!game || !user || cancelling) return;
    setCancelling(true);
    try {
      const success = await updateGames(game.id, {
        state: 'cancelled',
        creator: Address.publicKey(game.creator),
        playerCount: game.playerCount,
        createdAt: game.createdAt,
        startedAt: game.startedAt,
        winnerScore: game.winnerScore,
        secondPlaceScore: game.secondPlaceScore,
        buyIn: game.buyIn,
        buyInCurrency: game.buyInCurrency,
      });
      if (success) {
        toast.success('Match cancelled — buy-in refunded');
        navigate('/tapwars');
      } else {
        toast.error('Failed to cancel — please try again');
      }
    } catch {
      toast.error('Error cancelling match');
    } finally {
      setCancelling(false);
    }
  }

  if (!game) {
    return (
      <PageLayout fullBleed footer={false}>
        <div className="relative min-h-screen flex items-center justify-center">
          <Particles quantity={30} color="hsl(280 100% 65%)" />
          <div className="relative z-10 text-center">
            <div
              className="text-2xl font-black gradient-text animate-pulse"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              LOADING...
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const players = [game.creator, game.player2, game.player3, game.player4].filter(Boolean) as string[];
  const isPlayer = user && players.includes(user.address);
  const slotsFilled = game.playerCount as number;
  const slotsNeeded = 4 - slotsFilled;

  return (
    <PageLayout fullBleed footer={false}>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Particles quantity={40} color="hsl(280 100% 65%)" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 pt-5 pb-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-semibold">TapWars</span>
          </button>
          <div
            className="text-lg font-black tracking-widest gradient-text"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            TAPWARS
          </div>
          <div className="w-16" />
        </header>

        {/* Game state routing */}
        <main className="relative z-10 flex-1 px-4 pb-8">
          {game.state === 'waiting' && (
            <WaitingLobby
              game={game}
              slotsFilled={slotsFilled}
              slotsNeeded={slotsNeeded}
              isPlayer={!!isPlayer}
              isCreator={user?.address === game.creator}
              cancelling={cancelling}
              onCancel={handleCancel}
            />
          )}

          {game.state === 'playing' && isPlayer && (
            <div>
              <div className="text-center mb-4">
                <Badge
                  className="bg-destructive/20 text-destructive border-destructive/40 text-xs tracking-widest"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  GAME ON
                </Badge>
              </div>
              <TapGame
                gameId={game.id}
                startedAt={game.startedAt as number}
                onFinalized={() => {
                  // Game doc will update via subscription
                }}
              />
            </div>
          )}

          {game.state === 'playing' && !isPlayer && (
            <SpectatorView game={game} />
          )}

          {game.state === 'resolved' && (
            <ResultsView game={game} submissions={submissions ?? []} />
          )}
        </main>
      </div>
    </PageLayout>
  );
};

// --- Sub-components ---

function WaitingLobby({
  game,
  slotsFilled,
  slotsNeeded,
  isPlayer,
  isCreator,
  cancelling,
  onCancel,
}: {
  game: GamesResponse;
  slotsFilled: number;
  slotsNeeded: number;
  isPlayer: boolean;
  isCreator: boolean;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const slots = [game.creator, game.player2, game.player3, game.player4];

  return (
    <div className="mt-4">
      <div className="text-center mb-6">
        <Badge
          className="bg-green-500/20 text-green-400 border-green-500/40 text-xs tracking-widest mb-3"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          WAITING FOR PLAYERS
        </Badge>
        <h2
          className="text-3xl font-black gradient-text"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          {slotsFilled}/4
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {slotsNeeded === 0
            ? 'Starting soon...'
            : `Waiting for ${slotsNeeded} more player${slotsNeeded > 1 ? 's' : ''}...`}
        </p>
      </div>

      {/* Player slots */}
      <div className="space-y-3 mb-8">
        {slots.map((addr, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 rounded-2xl p-4 border transition-all ${
              addr
                ? 'glass border-primary/40'
                : 'border-dashed border-border bg-muted/10'
            }`}
          >
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-black ${
                addr ? 'bg-primary/30 text-primary' : 'bg-muted/30 text-muted-foreground'
              }`}
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              {i + 1}
            </div>
            <div className="flex-1">
              {addr ? (
                <div>
                  <div className="font-semibold text-foreground text-sm">
                    {truncateAddress(addr)}
                  </div>
                  {i === 0 && (
                    <div className="text-xs text-muted-foreground">Creator</div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">Waiting...</div>
              )}
            </div>
            {addr && (
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            )}
          </div>
        ))}
      </div>

      {/* Buy-in info */}
      <div className="glass rounded-2xl p-4 border border-border">
        <h3
          className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          Prize Pool
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-accent" />
              <span className="text-sm text-foreground">1st Place</span>
            </div>
            <span
              className="font-black text-accent"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              0.300 SOL
            </span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Medal className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground">2nd Place</span>
            </div>
            <span
              className="font-black text-primary"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              0.090 SOL
            </span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Buy-in</span>
            </div>
            <span className="font-semibold text-muted-foreground">0.1 SOL each</span>
          </div>
        </div>
      </div>

      {!isPlayer && (
        <p className="text-center text-muted-foreground text-xs mt-4">
          You are spectating this lobby
        </p>
      )}

      {/* Cancel button — only for creator while solo (no joiners) */}
      {isCreator && slotsFilled === 1 && (
        <div className="mt-6 space-y-2">
          <Button
            onClick={onCancel}
            disabled={cancelling}
            variant="ghost"
            className="w-full h-10 font-bold tracking-widest rounded-2xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-colors"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            {cancelling ? (
              'CANCELLING...'
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                CANCEL MATCH
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground/60">
            Auto-refund in ~10 minutes if no opponent joins
          </p>
        </div>
      )}
    </div>
  );
}

function SpectatorView({ game }: { game: GamesResponse }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Users className="h-12 w-12 text-muted-foreground" />
      <h2
        className="text-2xl font-black gradient-text"
        style={{ fontFamily: "'Orbitron', sans-serif" }}
      >
        BATTLE IN PROGRESS
      </h2>
      <p className="text-muted-foreground text-center text-sm">
        4 players are tapping right now.
        <br />
        Results will appear here when the game ends.
      </p>
    </div>
  );
}

function ResultsView({
  game,
  submissions,
}: {
  game: GamesResponse;
  submissions: GameSubmissionsPlayersResponse[];
}) {
  const navigate = useNavigate();

  // Build sorted player list
  const allPlayers = [game.creator, game.player2, game.player3, game.player4].filter(
    Boolean
  ) as string[];

  const playerScores = allPlayers.map((addr) => {
    const sub = submissions?.find((s) => s.player === addr);
    return {
      address: addr,
      tapCount: sub?.tapCount ?? 0,
      isWinner: addr === game.winner,
      isSecond: addr === game.secondPlace,
    };
  });

  playerScores.sort((a, b) => b.tapCount - a.tapCount);

  return (
    <div className="mt-4">
      <div className="text-center mb-6">
        <Badge
          className="bg-accent/20 text-accent border-accent/40 text-xs tracking-widest mb-3"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          RESULTS
        </Badge>
        <h2
          className="text-3xl font-black gradient-text"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          GAME OVER
        </h2>
      </div>

      <div className="space-y-3 mb-8">
        {playerScores.map((p, i) => (
          <div
            key={p.address}
            className={`flex items-center gap-4 rounded-2xl p-4 border ${
              p.isWinner
                ? 'glass border-accent/60 bg-accent/5'
                : p.isSecond
                ? 'glass border-primary/40 bg-primary/5'
                : 'glass border-border'
            }`}
          >
            {/* Rank */}
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center font-black text-lg ${
                p.isWinner
                  ? 'bg-accent/30 text-accent'
                  : p.isSecond
                  ? 'bg-primary/30 text-primary'
                  : 'bg-muted/30 text-muted-foreground'
              }`}
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              {p.isWinner ? '🏆' : p.isSecond ? '🥈' : i + 1}
            </div>

            {/* Address + taps */}
            <div className="flex-1">
              <div className="font-semibold text-sm">{truncateAddress(p.address)}</div>
              <div
                className={`text-xs font-black ${
                  p.isWinner
                    ? 'text-accent'
                    : p.isSecond
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                {p.tapCount} TAPS
              </div>
            </div>

            {/* Payout */}
            <div className="text-right">
              {p.isWinner && (
                <div
                  className="font-black text-accent text-sm"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  +0.300 SOL
                </div>
              )}
              {p.isSecond && (
                <div
                  className="font-black text-primary text-sm"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  +0.090 SOL
                </div>
              )}
              {!p.isWinner && !p.isSecond && (
                <div className="text-muted-foreground text-xs">—</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={() => navigate('/tapwars')}
        size="lg"
        className="w-full h-14 font-black tracking-widest rounded-2xl shadow-lg shadow-primary/40"
        style={{ fontFamily: "'Orbitron', sans-serif" }}
      >
        PLAY AGAIN
      </Button>
    </div>
  );
}

export default Lobby;
