import { prisma } from '../db.js';

export interface GamesResponse {
  id: string;
  creator: string;
  player2?: string | null;
  player3?: string | null;
  player4?: string | null;
  playerCount: number;
  state: string;
  createdAt: number;
  startedAt: number | null;
  winner?: string | null;
  secondPlace?: string | null;
  winnerScore: number;
  secondPlaceScore: number;
  gameType?: string | null;
  buyIn: string;
  buyInCurrency: string;
}

export async function setGames(gameId: string, data: Record<string, any>): Promise<boolean> {
  try {
    const buyIn = typeof data.buyIn === 'bigint' ? data.buyIn : BigInt(data.buyIn);
    const startedAt = data.startedAt ? new Date(data.startedAt) : undefined;

    const result = await prisma.game.upsert({
      where: { id: gameId },
      create: {
        id: gameId,
        creator: data.creator,
        player2: data.player2 || null,
        player3: data.player3 || null,
        player4: data.player4 || null,
        playerCount: data.playerCount || 1,
        state: data.state || 'waiting',
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        startedAt,
        winner: data.winner || null,
        secondPlace: data.secondPlace || null,
        winnerScore: data.winnerScore || 0,
        secondPlaceScore: data.secondPlaceScore || 0,
        buyIn,
        buyInCurrency: data.buyInCurrency || 'SOL',
        gameType: data.gameType || null,
        txSignature: data.txSignature || null,
      },
      update: {
        player2: data.player2 !== undefined ? data.player2 : undefined,
        player3: data.player3 !== undefined ? data.player3 : undefined,
        player4: data.player4 !== undefined ? data.player4 : undefined,
        playerCount: data.playerCount !== undefined ? data.playerCount : undefined,
        state: data.state !== undefined ? data.state : undefined,
        startedAt,
        winner: data.winner !== undefined ? data.winner : undefined,
        secondPlace: data.secondPlace !== undefined ? data.secondPlace : undefined,
        winnerScore: data.winnerScore !== undefined ? data.winnerScore : undefined,
        secondPlaceScore: data.secondPlaceScore !== undefined ? data.secondPlaceScore : undefined,
        txSignature: data.txSignature !== undefined ? data.txSignature : undefined,
      },
    });

    return !!result;
  } catch (error) {
    console.error(`Error setting Games:`, error);
    return false;
  }
}

export async function getGames(gameId: string): Promise<GamesResponse | null> {
  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) return null;

    return {
      id: game.id,
      creator: game.creator,
      player2: game.player2,
      player3: game.player3,
      player4: game.player4,
      playerCount: game.playerCount,
      state: game.state,
      createdAt: game.createdAt.getTime(),
      startedAt: game.startedAt?.getTime() || null,
      winner: game.winner,
      secondPlace: game.secondPlace,
      winnerScore: game.winnerScore,
      secondPlaceScore: game.secondPlaceScore,
      gameType: game.gameType,
      buyIn: game.buyIn.toString(),
      buyInCurrency: game.buyInCurrency,
    };
  } catch (error) {
    console.error(`Error getting Games:`, error);
    return null;
  }
}

export async function getManyGames(): Promise<GamesResponse[]> {
  try {
    const games = await prisma.game.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return games.map(game => ({
      id: game.id,
      creator: game.creator,
      player2: game.player2,
      player3: game.player3,
      player4: game.player4,
      playerCount: game.playerCount,
      state: game.state,
      createdAt: game.createdAt.getTime(),
      startedAt: game.startedAt?.getTime() || null,
      winner: game.winner,
      secondPlace: game.secondPlace,
      winnerScore: game.winnerScore,
      secondPlaceScore: game.secondPlaceScore,
      gameType: game.gameType,
      buyIn: game.buyIn.toString(),
      buyInCurrency: game.buyInCurrency,
    }));
  } catch (error) {
    console.error(`Error getting Games collection:`, error);
    return [];
  }
}
