jest.mock('../../db');

import { getGames, setGames, getManyGames } from '../../collections/games';
import { prisma } from '../../db';

describe('Games Collection', () => {
  const mockGame = {
    id: 'game-123',
    creator: 'player1',
    player2: null,
    player3: null,
    player4: null,
    playerCount: 1,
    state: 'waiting',
    createdAt: new Date('2026-05-29T00:00:00Z'),
    startedAt: null,
    winner: null,
    secondPlace: null,
    winnerScore: 0,
    secondPlaceScore: 0,
    buyIn: BigInt(1000000),
    buyInCurrency: 'SOL',
    gameType: null,
    txSignature: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGames', () => {
    it('should return a game when found', async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);

      const result = await getGames('game-123');

      expect(result).toEqual({
        id: 'game-123',
        creator: 'player1',
        player2: null,
        player3: null,
        player4: null,
        playerCount: 1,
        state: 'waiting',
        createdAt: mockGame.createdAt.getTime(),
        startedAt: null,
        winner: null,
        secondPlace: null,
        winnerScore: 0,
        secondPlaceScore: 0,
        buyIn: '1000000',
        buyInCurrency: 'SOL',
        gameType: null,
      });
      expect(prisma.game.findUnique).toHaveBeenCalledWith({
        where: { id: 'game-123' },
      });
    });

    it('should return null when game not found', async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getGames('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      (prisma.game.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await getGames('game-123');

      expect(result).toBeNull();
    });
  });

  describe('setGames', () => {
    it('should create a new game', async () => {
      (prisma.game.upsert as jest.Mock).mockResolvedValue(mockGame);

      const result = await setGames('game-123', {
        creator: 'player1',
        playerCount: 1,
        state: 'waiting',
        buyIn: '1000000',
        buyInCurrency: 'SOL',
      });

      expect(result).toBe(true);
      expect(prisma.game.upsert).toHaveBeenCalled();
    });

    it('should update an existing game', async () => {
      (prisma.game.upsert as jest.Mock).mockResolvedValue({
        ...mockGame,
        state: 'playing',
      });

      const result = await setGames('game-123', {
        state: 'playing',
        playerCount: 2,
        player2: 'player2',
      });

      expect(result).toBe(true);
    });

    it('should handle creation errors', async () => {
      (prisma.game.upsert as jest.Mock).mockRejectedValue(
        new Error('Creation failed')
      );

      const result = await setGames('game-123', {
        creator: 'player1',
        buyIn: '1000000',
      });

      expect(result).toBe(false);
    });

    it('should convert BigInt buyIn to string', async () => {
      (prisma.game.upsert as jest.Mock).mockResolvedValue(mockGame);

      await setGames('game-123', {
        creator: 'player1',
        buyIn: BigInt(1000000),
        state: 'waiting',
      });

      expect(prisma.game.upsert).toHaveBeenCalled();
      const call = (prisma.game.upsert as jest.Mock).mock.calls[0][0];
      expect(call.create.buyIn).toEqual(BigInt(1000000));
    });
  });

  describe('getManyGames', () => {
    it('should return all games', async () => {
      const games = [
        mockGame,
        { ...mockGame, id: 'game-124', creator: 'player2' },
      ];
      (prisma.game.findMany as jest.Mock).mockResolvedValue(games);

      const result = await getManyGames();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('game-123');
      expect(result[1].id).toBe('game-124');
      expect(prisma.game.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no games exist', async () => {
      (prisma.game.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getManyGames();

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      (prisma.game.findMany as jest.Mock).mockRejectedValue(
        new Error('Query failed')
      );

      const result = await getManyGames();

      expect(result).toEqual([]);
    });

    it('should serialize BigInt fields', async () => {
      const games = [
        {
          ...mockGame,
          buyIn: BigInt('9999999999999'),
        },
      ];
      (prisma.game.findMany as jest.Mock).mockResolvedValue(games);

      const result = await getManyGames();

      expect(result[0].buyIn).toBe('9999999999999');
      expect(typeof result[0].buyIn).toBe('string');
    });
  });
});
