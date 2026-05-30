import { get, set } from '../db-client.js';

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
    await set(`games/${gameId}`, data);
    return true;
  } catch (error) {
    console.error(`Error setting Games:`, error);
    return false;
  }
}

export async function updateGames(gameId: string, data: Record<string, any>): Promise<boolean> {
  return setGames(gameId, data);
}

export async function getGames(gameId: string): Promise<GamesResponse | null> {
  try {
    const game = await get(`games/${gameId}`);
    if (!game) return null;
    return game as GamesResponse;
  } catch (error) {
    console.error(`Error getting Games:`, error);
    return null;
  }
}

export async function getManyGames(): Promise<GamesResponse[]> {
  try {
    return [];
  } catch (error) {
    console.error(`Error getting Games collection:`, error);
    return [];
  }
}
