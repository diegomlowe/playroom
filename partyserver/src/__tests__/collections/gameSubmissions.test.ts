jest.mock('../../db');

import {
  getManyGameSubmissionsPlayers,
  getGameSubmissionsPlayers,
  setGameSubmissionsPlayers,
} from '../../collections/gameSubmissions';
import { prisma } from '../../db';

describe('GameSubmissions Collection', () => {
  const mockSubmission = {
    id: 'sub-123',
    gameId: 'game-123',
    player: 'player1',
    tapCount: 150,
    submittedAt: new Date('2026-05-29T00:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getManyGameSubmissionsPlayers', () => {
    it('should return all submissions for a game', async () => {
      const submissions = [
        mockSubmission,
        {
          ...mockSubmission,
          id: 'sub-124',
          player: 'player2',
          tapCount: 200,
        },
      ];
      (prisma.gameSubmission.findMany as jest.Mock).mockResolvedValue(
        submissions
      );

      const result = await getManyGameSubmissionsPlayers('game-123');

      expect(result).toHaveLength(2);
      expect(result[0].player).toBe('player1');
      expect(result[1].player).toBe('player2');
      expect(prisma.gameSubmission.findMany).toHaveBeenCalledWith({
        where: { gameId: 'game-123' },
        orderBy: { submittedAt: 'asc' },
      });
    });

    it('should return empty array when no submissions', async () => {
      (prisma.gameSubmission.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getManyGameSubmissionsPlayers('game-123');

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      (prisma.gameSubmission.findMany as jest.Mock).mockRejectedValue(
        new Error('DB Error')
      );

      const result = await getManyGameSubmissionsPlayers('game-123');

      expect(result).toEqual([]);
    });

    it('should serialize timestamps correctly', async () => {
      const now = new Date();
      (prisma.gameSubmission.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockSubmission,
          submittedAt: now,
        },
      ]);

      const result = await getManyGameSubmissionsPlayers('game-123');

      expect(result[0].submittedAt).toBe(now.getTime());
    });
  });

  describe('getGameSubmissionsPlayers', () => {
    it('should return a submission when found', async () => {
      (prisma.gameSubmission.findUnique as jest.Mock).mockResolvedValue(
        mockSubmission
      );

      const result = await getGameSubmissionsPlayers('game-123', 'player1');

      expect(result).toEqual({
        id: 'sub-123',
        gameId: 'game-123',
        player: 'player1',
        tapCount: 150,
        submittedAt: mockSubmission.submittedAt.getTime(),
      });
      expect(prisma.gameSubmission.findUnique).toHaveBeenCalledWith({
        where: {
          gameId_player: {
            gameId: 'game-123',
            player: 'player1',
          },
        },
      });
    });

    it('should return null when submission not found', async () => {
      (prisma.gameSubmission.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getGameSubmissionsPlayers('game-123', 'player1');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      (prisma.gameSubmission.findUnique as jest.Mock).mockRejectedValue(
        new Error('Query failed')
      );

      const result = await getGameSubmissionsPlayers('game-123', 'player1');

      expect(result).toBeNull();
    });
  });

  describe('setGameSubmissionsPlayers', () => {
    it('should create a new submission', async () => {
      (prisma.gameSubmission.upsert as jest.Mock).mockResolvedValue(
        mockSubmission
      );

      const result = await setGameSubmissionsPlayers('game-123', 'player1', {
        tapCount: 150,
      });

      expect(result).toBe(true);
      expect(prisma.gameSubmission.upsert).toHaveBeenCalled();
    });

    it('should update existing submission', async () => {
      (prisma.gameSubmission.upsert as jest.Mock).mockResolvedValue({
        ...mockSubmission,
        tapCount: 200,
      });

      const result = await setGameSubmissionsPlayers('game-123', 'player1', {
        tapCount: 200,
      });

      expect(result).toBe(true);
    });

    it('should handle creation errors', async () => {
      (prisma.gameSubmission.upsert as jest.Mock).mockRejectedValue(
        new Error('Constraint violation')
      );

      const result = await setGameSubmissionsPlayers('game-123', 'player1', {
        tapCount: 150,
      });

      expect(result).toBe(false);
    });

    it('should use composite unique key', async () => {
      (prisma.gameSubmission.upsert as jest.Mock).mockResolvedValue(
        mockSubmission
      );

      await setGameSubmissionsPlayers('game-123', 'player1', {
        tapCount: 150,
      });

      const call = (prisma.gameSubmission.upsert as jest.Mock).mock.calls[0][0];
      expect(call.where.gameId_player).toEqual({
        gameId: 'game-123',
        player: 'player1',
      });
    });
  });
});
