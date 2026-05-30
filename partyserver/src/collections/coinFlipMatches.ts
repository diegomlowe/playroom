import { prisma } from '../db.js';

export interface CoinFlipMatchesResponse {
  id: string;
  creator: string;
  opponent?: string | null;
  tier: number;
  buyIn: string;
  state: string;
  winner?: string | null;
  createdAt: number;
  buyInCurrency: string;
  vrfResult?: string | null;
  txSignature?: string | null;
}

export async function setCoinFlipMatches(
  matchId: string,
  data: Record<string, any>,
): Promise<boolean> {
  try {
    const buyIn = typeof data.buyIn === 'bigint' ? data.buyIn : BigInt(data.buyIn);

    await prisma.coinFlipMatch.upsert({
      where: { id: matchId },
      create: {
        id: matchId,
        creator: data.creator,
        opponent: data.opponent || null,
        tier: data.tier || 1,
        buyIn,
        state: data.state || 'waiting',
        winner: data.winner || null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        buyInCurrency: data.buyInCurrency || 'SOL',
        vrfResult: data.vrfResult || null,
        txSignature: data.txSignature || null,
      },
      update: {
        opponent: data.opponent !== undefined ? data.opponent : undefined,
        tier: data.tier !== undefined ? data.tier : undefined,
        state: data.state !== undefined ? data.state : undefined,
        winner: data.winner !== undefined ? data.winner : undefined,
        vrfResult: data.vrfResult !== undefined ? data.vrfResult : undefined,
        txSignature: data.txSignature !== undefined ? data.txSignature : undefined,
      },
    });

    return true;
  } catch (error) {
    console.error(`Error setting CoinFlipMatches:`, error);
    return false;
  }
}

export async function updateCoinFlipMatches(
  matchId: string,
  data: Record<string, any>,
): Promise<boolean> {
  return setCoinFlipMatches(matchId, data);
}

export async function getCoinFlipMatches(matchId: string): Promise<CoinFlipMatchesResponse | null> {
  try {
    const match = await prisma.coinFlipMatch.findUnique({
      where: { id: matchId },
    });

    if (!match) return null;

    return {
      id: match.id,
      creator: match.creator,
      opponent: match.opponent,
      tier: match.tier,
      buyIn: match.buyIn.toString(),
      state: match.state,
      winner: match.winner,
      createdAt: match.createdAt.getTime(),
      buyInCurrency: match.buyInCurrency,
      vrfResult: match.vrfResult,
      txSignature: match.txSignature,
    };
  } catch (error) {
    console.error(`Error getting CoinFlipMatches:`, error);
    return null;
  }
}

export async function getManyCoinFlipMatches(): Promise<CoinFlipMatchesResponse[]> {
  try {
    const matches = await prisma.coinFlipMatch.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return matches.map(match => ({
      id: match.id,
      creator: match.creator,
      opponent: match.opponent,
      tier: match.tier,
      buyIn: match.buyIn.toString(),
      state: match.state,
      winner: match.winner,
      createdAt: match.createdAt.getTime(),
      buyInCurrency: match.buyInCurrency,
      vrfResult: match.vrfResult,
      txSignature: match.txSignature,
    }));
  } catch (error) {
    console.error(`Error getting CoinFlipMatches collection:`, error);
    return [];
  }
}
