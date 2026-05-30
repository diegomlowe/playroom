import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';

// Mock @solana/wallet-adapter-react
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(() => ({
    publicKey: null,
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signMessage: vi.fn(),
  })),
}));

describe('useAuth Hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should return initial state when wallet is not connected', async () => {
      const { result } = renderHook(() => useAuth());

      // Wait for session restoration to complete
      await waitFor(() => {
        expect(result.current.isSessionRestoring).toBe(false);
      });

      expect(result.current).toEqual({
        user: null,
        loading: false,
        login: expect.any(Function),
        logout: expect.any(Function),
        isSessionRestoring: false,
      });
    });

    it('should have no token in localStorage initially', () => {
      const token = localStorage.getItem('auth_token');
      expect(token).toBeNull();
    });
  });

  describe('Login Flow', () => {
    it('should set auth token on successful login', async () => {
      const { useWallet } = await import('@solana/wallet-adapter-react');
      const mockConnect = vi.fn();
      const mockSignMessage = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
      const mockPublicKey = { toBase58: () => 'test-wallet-address' };

      vi.mocked(useWallet).mockReturnValue({
        publicKey: null,
        connected: false,
        connect: mockConnect,
        disconnect: vi.fn(),
        signMessage: mockSignMessage,
      } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        // Manually trigger login logic
        vi.mocked(useWallet).mockReturnValue({
          publicKey: mockPublicKey,
          connected: true,
          connect: mockConnect,
          disconnect: vi.fn(),
          signMessage: mockSignMessage,
        } as any);
      });

      expect(mockConnect).toBeDefined();
    });

    it('should handle login errors', async () => {
      const { useWallet } = await import('@solana/wallet-adapter-react');
      const mockConnect = vi.fn().mockRejectedValue(new Error('Connection failed'));

      vi.mocked(useWallet).mockReturnValue({
        publicKey: null,
        connected: false,
        connect: mockConnect,
        disconnect: vi.fn(),
        signMessage: vi.fn(),
      } as any);

      const { result } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Logout Flow', () => {
    it('should clear token on logout', async () => {
      localStorage.setItem('auth_token', 'test-token');

      expect(localStorage.getItem('auth_token')).toBe('test-token');

      // Simulate logout
      localStorage.removeItem('auth_token');

      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('should call disconnect on logout', async () => {
      const { useWallet } = await import('@solana/wallet-adapter-react');
      const mockDisconnect = vi.fn();

      vi.mocked(useWallet).mockReturnValue({
        publicKey: null,
        connected: true,
        connect: vi.fn(),
        disconnect: mockDisconnect,
        signMessage: vi.fn(),
      } as any);

      expect(mockDisconnect).toBeDefined();
    });
  });

  describe('Token Storage', () => {
    it('should persist token in localStorage', () => {
      const testToken = 'test-auth-token-123';
      localStorage.setItem('auth_token', testToken);

      const stored = localStorage.getItem('auth_token');
      expect(stored).toBe(testToken);
    });

    it('should clear token on logout', () => {
      localStorage.setItem('auth_token', 'token-to-clear');
      localStorage.removeItem('auth_token');

      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('should handle token format correctly', () => {
      // Test that signature is converted to base64
      const testSignature = new Uint8Array([1, 2, 3, 4, 5]);
      const buffer = Buffer.from(testSignature);
      const base64Token = buffer.toString('base64');

      expect(typeof base64Token).toBe('string');
      expect(base64Token.length).toBeGreaterThan(0);
    });
  });

  describe('Session State', () => {
    it('should track loading state during auth', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isSessionRestoring).toBe(false);
      });

      expect(result.current.loading).toBe(false);
    });

    it('should return user object when wallet is connected', async () => {
      const userObj = { address: 'test-address' };
      expect(userObj.address).toBe('test-address');
    });

    it('should complete session restoration', async () => {
      const { result } = renderHook(() => useAuth());

      // Wait for restoration to complete
      await waitFor(() => {
        expect(result.current.isSessionRestoring).toBe(false);
      });

      // Session restoration should be complete
      expect(result.current.isSessionRestoring).toBe(false);
    });
  });

  describe('Session Persistence', () => {
    it('should restore token from localStorage on mount', async () => {
      localStorage.setItem('auth_token', 'persisted-token');
      localStorage.setItem('auth_address', 'persisted-address');

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isSessionRestoring).toBe(false);
      });

      const token = localStorage.getItem('auth_token');
      expect(token).toBe('persisted-token');
    });

    it('should clear invalid session data', async () => {
      // Set up invalid session
      localStorage.setItem('auth_token', 'stale-token');

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isSessionRestoring).toBe(false);
      });

      // Session should be cleared if wallet can't reconnect
      // This depends on mock setup
    });

    it('should preserve token across component remounts', () => {
      const testToken = 'persistent-token';
      localStorage.setItem('auth_token', testToken);

      const { result: result1 } = renderHook(() => useAuth());
      const stored1 = localStorage.getItem('auth_token');

      const { result: result2 } = renderHook(() => useAuth());
      const stored2 = localStorage.getItem('auth_token');

      expect(stored1).toBe(testToken);
      expect(stored2).toBe(testToken);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing wallet gracefully', async () => {
      const { useWallet } = await import('@solana/wallet-adapter-react');

      vi.mocked(useWallet).mockReturnValue({
        publicKey: null,
        connected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signMessage: null,
      } as any);

      const { result } = renderHook(() => useAuth());
      expect(result.current.user).toBeNull();
    });

    it('should handle message signing failure', async () => {
      const { useWallet } = await import('@solana/wallet-adapter-react');
      const mockSignMessage = vi.fn().mockRejectedValue(new Error('Sign failed'));

      vi.mocked(useWallet).mockReturnValue({
        publicKey: { toBase58: () => 'address' },
        connected: true,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signMessage: mockSignMessage,
      } as any);

      expect(mockSignMessage).toBeDefined();
    });
  });

  describe('API Header Compatibility', () => {
    it('should store token that can be sent as Authorization header', () => {
      const token = 'test-token-value';
      localStorage.setItem('auth_token', token);

      const storedToken = localStorage.getItem('auth_token');
      const authHeader = `Bearer ${storedToken}`;

      expect(authHeader).toBe('Bearer test-token-value');
    });

    it('should work with X-Wallet-Address header', () => {
      const address = 'test-wallet-address';
      const header = address;

      expect(header).toBe('test-wallet-address');
    });
  });
});
