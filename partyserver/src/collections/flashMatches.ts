import { prisma } from '../db.js';

export interface FlashMatchesResponse {
  id: string;
  creator: string;
  player2?: string | null;
  player3?: string | null;
  player4?: string | null;
  playerCount: number;
  state: string;
  flashMomentMs?: string | null;
  createdAt: number;
  startedAt?: number | null;
  winner?: string | null;
  secondPlace?: string | null;
  winnerDeltaMs?: number | null;
  secondPlaceDeltaMs?: number | null;
  ts: number;
  buyIn: string;
  buyInCurrency?: string;
}

export async function setFlashMatches(
  matchId: string,
  data: Record<string, any>,
): Promise<boolean> {
  try {
    const startedAt = data.startedAt ? new Date(data.startedAt) : undefined;
    const flashMomentMs = data.flashMomentMs ? BigInt(data.flashMomentMs) : undefined;

    await prisma.flashMatch.upsert({
      where: { id: matchId },
      create: {
        id: matchId,
        creator: data.creator,
        player2: data.player2 || null,
        player3: data.player3 || null,
        player4: data.player4 || null,
        state: data.state || 'waiting',
        flashMomentMs,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        startedAt,
        winner: data.winner || null,
        secondPlace: data.secondPlace || null,
      },
      update: {
        player2: data.player2 !== undefined ? data.player2 : undefined,
        player3: data.player3 !== undefined ? data.player3 : undefined,
        player4: data.player4 !== undefined ? data.player4 : undefined,
        state: data.state !== undefined ? data.state : undefined,
        flashMomentMs: data.flashMomentMs !== undefined ? flashMomentMs : undefined,
        startedAt,
        winner: data.winner !== undefined ? data.winner : undefined,
        secondPlace: data.secondPlace !== undefined ? data.secondPlace : undefined,
      },
    });

    return true;
  } catch (error) {
    console.error(`Error setting FlashMatches:`, error);
    return false;
  }
}

export async function updateFlashMatches(
  matchId: string,
  data: Record<string, any>,
): Promise<boolean> {
  return setFlashMatches(matchId, data);
}

export async function getFlashMatches(matchId: string): Promise<FlashMatchesResponse | null> {
  try {
    const match = await prisma.flashMatch.findUnique({
      where: { id: matchId },
    });

    if (!match) return null;

    return {
      id: match.id,
      creator: match.creator,
      player2: match.player2,
      player3: match.player3,
      player4: match.player4,
      playerCount: match.playerCount || 1,
      state: match.state,
      flashMomentMs: match.flashMomentMs?.toString() || null,
      createdAt: match.createdAt.getTime(),
      startedAt: match.startedAt?.getTime() || null,
      winner: match.winner,
      secondPlace: match.secondPlace,
      winnerDeltaMs: match.winnerDeltaMs || null,
      secondPlaceDeltaMs: match.secondPlaceDeltaMs || null,
      ts: match.ts?.getTime ? match.ts.getTime() : 0,
      buyIn: match.buyIn?.toString() || '0',
      buyInCurrency: match.buyInCurrency || 'SOL',
    };
  } catch (error) {
    console.error(`Error getting FlashMatches:`, error);
    return null;
  }
}

export async function getManyFlashMatches(): Promise<FlashMatchesResponse[]> {
  try {
    const matches = await prisma.flashMatch.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return matches.map(match => ({
      id: match.id,
      creator: match.creator,
      player2: match.player2,
      player3: match.player3,
      player4: match.player4,
      state: match.state,
      flashMomentMs: match.flashMomentMs?.toString() || null,
      createdAt: match.createdAt.getTime(),
      startedAt: match.startedAt?.getTime() || null,
      winner: match.winner,
      secondPlace: match.secondPlace,
    }));
  } catch (error) {
    console.error(`Error getting FlashMatches collection:`, error);
    return [];
  }
}
