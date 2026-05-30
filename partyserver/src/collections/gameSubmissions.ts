import { prisma } from '../db.js';

export interface GameSubmissionsPlayersResponse {
  id: string;
  gameId: string;
  player: string;
  tapCount: number;
  submittedAt: number;
}

export async function setGameSubmissionsPlayers(
  gameId: string,
  playerAddress: string,
  data?: Record<string, any>,
): Promise<boolean> {
  try {
    await prisma.gameSubmission.upsert({
      where: {
        gameId_player: {
          gameId,
          player: playerAddress,
        },
      },
      create: {
        gameId,
        player: playerAddress,
        tapCount: data?.tapCount || 0,
        submittedAt: data?.submittedAt ? new Date(data.submittedAt) : new Date(),
      },
      update: {
        tapCount: data?.tapCount !== undefined ? data.tapCount : undefined,
        submittedAt: data?.submittedAt ? new Date(data.submittedAt) : undefined,
      },
    });

    return true;
  } catch (error) {
    console.error(`Error setting GameSubmissionsPlayers:`, error);
    return false;
  }
}

export async function getGameSubmissionsPlayers(
  gameId: string,
  playerAddress: string,
): Promise<GameSubmissionsPlayersResponse | null> {
  try {
    const submission = await prisma.gameSubmission.findUnique({
      where: {
        gameId_player: {
          gameId,
          player: playerAddress,
        },
      },
    });

    if (!submission) return null;

    return {
      id: submission.id,
      gameId: submission.gameId,
      player: submission.player,
      tapCount: submission.tapCount,
      submittedAt: submission.submittedAt.getTime(),
    };
  } catch (error) {
    console.error(`Error getting GameSubmissionsPlayers:`, error);
    return null;
  }
}

export async function getManyGameSubmissionsPlayers(
  gameId: string,
): Promise<GameSubmissionsPlayersResponse[]> {
  try {
    const submissions = await prisma.gameSubmission.findMany({
      where: { gameId },
      orderBy: { submittedAt: 'asc' },
    });

    return submissions.map(sub => ({
      id: sub.id,
      gameId: sub.gameId,
      player: sub.player,
      tapCount: sub.tapCount,
      submittedAt: sub.submittedAt.getTime(),
    }));
  } catch (error) {
    console.error(`Error getting GameSubmissionsPlayers collection:`, error);
    return [];
  }
}
