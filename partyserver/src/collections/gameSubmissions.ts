import { get, set } from '../db-client.js';

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
    await set(`gameSubmission/${gameId}/${playerAddress}`, data);
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
    const submission = await get(`gameSubmission/${gameId}/${playerAddress}`);
    if (!submission) return null;
    return submission as GameSubmissionsPlayersResponse;
  } catch (error) {
    console.error(`Error getting GameSubmissionsPlayers:`, error);
    return null;
  }
}

export async function getManyGameSubmissionsPlayers(
  gameId: string,
): Promise<GameSubmissionsPlayersResponse[]> {
  try {
    return [];
  } catch (error) {
    console.error(`Error getting GameSubmissionsPlayers collection:`, error);
    return [];
  }
}
