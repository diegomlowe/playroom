import { prisma } from '../db.js';

export interface FlashMatchTapsPlayersResponse {
  id: string;
  player: string;
  tapTime: string;
  reactionTime?: string | null;
}

export async function setFlashMatchTapsPlayers(
  matchId: string,
  playerAddress: string,
  data?: Record<string, any>,
): Promise<boolean> {
  try {
    const tapTime = BigInt(data?.tapTimeMs || data?.tapTime || 0);

    await prisma.flashTap.upsert({
      where: {
        matchId_player: {
          matchId,
          player: playerAddress,
        },
      },
      create: {
        matchId,
        player: playerAddress,
        tapTime,
      },
      update: {
        tapTime,
      },
    });

    return true;
  } catch (error) {
    console.error(`Error setting FlashMatchTapsPlayers:`, error);
    return false;
  }
}

export async function getFlashMatchTapsPlayers(
  matchId: string,
  playerAddress: string,
): Promise<FlashMatchTapsPlayersResponse | null> {
  try {
    const tap = await prisma.flashTap.findUnique({
      where: {
        matchId_player: {
          matchId,
          player: playerAddress,
        },
      },
    });

    if (!tap) return null;

    return {
      id: tap.id,
      player: tap.player,
      tapTime: tap.tapTime.toString(),
      reactionTime: tap.reactionTime?.toString() || null,
    };
  } catch (error) {
    console.error(`Error getting FlashMatchTapsPlayers:`, error);
    return null;
  }
}

export async function getManyFlashMatchTapsPlayers(matchId: string): Promise<FlashMatchTapsPlayersResponse[]> {
  try {
    const taps = await prisma.flashTap.findMany({
      where: { matchId },
    });

    return taps.map(tap => ({
      id: tap.id,
      player: tap.player,
      tapTime: tap.tapTime.toString(),
      reactionTime: tap.reactionTime?.toString() || null,
    }));
  } catch (error) {
    console.error(`Error getting FlashMatchTapsPlayers collection:`, error);
    return [];
  }
}
