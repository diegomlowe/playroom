import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Context } from 'hono';
import { validateWalletAuth, validateAdminAuth, AuthenticationError } from '../../lib/wallet-auth';

describe('Wallet Auth', () => {
  let mockContext: Partial<Context>;

  beforeEach(() => {
    mockContext = {
      req: {
        header: vi.fn(),
      },
    };
  });

  describe('validateWalletAuth', () => {
    it('should validate with valid headers', async () => {
      vi.mocked(mockContext.req!.header)
        .mockImplementation((key: string) => {
          if (key === 'Authorization') return 'Bearer token123';
          if (key === 'X-Wallet-Address') return '11111111111111111111111111111111';
          return undefined;
        });

      const result = await validateWalletAuth(mockContext as Context);

      expect(result).toEqual({
        walletAddress: '11111111111111111111111111111111',
      });
    });

    it('should throw error when Authorization header missing', async () => {
      (mockContext.req!.header as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === 'X-Wallet-Address') return '11111111111111111111111111111111';
          return undefined;
        });

      await expect(validateWalletAuth(mockContext as Context)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw error when wallet address header missing', async () => {
      (mockContext.req!.header as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === 'Authorization') return 'Bearer token123';
          return undefined;
        });

      await expect(validateWalletAuth(mockContext as Context)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw error with 401 status code', async () => {
      (mockContext.req!.header as jest.Mock).mockReturnValue(undefined);

      try {
        await validateWalletAuth(mockContext as Context);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect((error as AuthenticationError).statusCode).toBe(401);
      }
    });
  });

  describe('validateAdminAuth', () => {
    beforeEach(() => {
      process.env.ADMIN_ADDRESSES = 'admin1,admin2,admin3';
    });

    afterEach(() => {
      delete process.env.ADMIN_ADDRESSES;
    });

    it('should validate admin user', async () => {
      (mockContext.req!.header as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === 'Authorization') return 'Bearer token123';
          if (key === 'X-Wallet-Address') return 'admin1';
          return undefined;
        });

      const result = await validateAdminAuth(mockContext as Context);

      expect(result).toEqual({ walletAddress: 'admin1' });
    });

    it('should handle case-insensitive admin addresses', async () => {
      (mockContext.req!.header as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === 'Authorization') return 'Bearer token123';
          if (key === 'X-Wallet-Address') return 'ADMIN1';
          return undefined;
        });

      const result = await validateAdminAuth(mockContext as Context);

      expect(result).toEqual({ walletAddress: 'ADMIN1' });
    });

    it('should reject non-admin user', async () => {
      (mockContext.req!.header as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === 'Authorization') return 'Bearer token123';
          if (key === 'X-Wallet-Address') return 'user1';
          return undefined;
        });

      try {
        await validateAdminAuth(mockContext as Context);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect((error as AuthenticationError).statusCode).toBe(403);
      }
    });

    it('should reject with missing headers', async () => {
      (mockContext.req!.header as jest.Mock).mockReturnValue(undefined);

      await expect(validateAdminAuth(mockContext as Context)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should handle empty ADMIN_ADDRESSES env var', async () => {
      process.env.ADMIN_ADDRESSES = '';

      (mockContext.req!.header as jest.Mock)
        .mockImplementation((key: string) => {
          if (key === 'Authorization') return 'Bearer token123';
          if (key === 'X-Wallet-Address') return 'anyuser';
          return undefined;
        });

      await expect(validateAdminAuth(mockContext as Context)).rejects.toThrow();
    });
  });

  describe('AuthenticationError', () => {
    it('should create error with default status code', () => {
      const error = new AuthenticationError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(401);
    });

    it('should create error with custom status code', () => {
      const error = new AuthenticationError('Forbidden', 403);
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
    });
  });
});
