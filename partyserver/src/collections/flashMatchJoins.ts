import { prisma } from '../db.js';

export interface FlashMatchJoinsPlayersResponse {
  id: string;
  player: string;
  ts: number;
}

export async function setFlashMatchJoinsPlayers(
  matchId: string,
  playerAddress: string,
  data?: Record<string, any>,
): Promise<boolean> {
  try {
    // For flashMatchJoins, we're tracking that a player joined by creating a FlashTap record
    // This is a join action, not a tap. We'll use current timestamp.
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
        tapTime: BigInt(data?.ts || Date.now()),
      },
      update: {
        tapTime: BigInt(data?.ts || Date.now()),
      },
    });

    return true;
  } catch (error) {
    console.error(`Error setting FlashMatchJoinsPlayers:`, error);
    return false;
  }
}

export async function getFlashMatchJoinsPlayers(
  matchId: string,
  playerAddress: string,
): Promise<FlashMatchJoinsPlayersResponse | null> {
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
      ts: Number(tap.tapTime),
    };
  } catch (error) {
    console.error(`Error getting FlashMatchJoinsPlayers:`, error);
    return null;
  }
}

export async function getManyFlashMatchJoinsPlayers(matchId: string): Promise<FlashMatchJoinsPlayersResponse[]> {
  try {
    const taps = await prisma.flashTap.findMany({
      where: { matchId },
    });

    return taps.map(tap => ({
      id: tap.id,
      player: tap.player,
      ts: Number(tap.tapTime),
    }));
  } catch (error) {
    console.error(`Error getting FlashMatchJoinsPlayers collection:`, error);
    return [];
  }
}
