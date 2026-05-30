import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface AuthUser {
  address: string;
}

export interface UseAuthReturn {
  user: AuthUser | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  isSessionRestoring: boolean;
}

/**
 * useAuth - Wallet authentication hook with session persistence
 * Provides wallet connection, login/logout, and user session management
 * with localStorage-based session restoration
 *
 * Returns:
 * - user: AuthUser | null - Current connected wallet (null if not connected)
 * - login: () => Promise<void> - Connect wallet
 * - logout: () => Promise<void> - Disconnect wallet
 * - loading: boolean - Auth state loading indicator
 * - isSessionRestoring: boolean - Whether session is being restored from storage
 */
export function useAuth(): UseAuthReturn {
  const { publicKey, connected, connect, disconnect, signMessage } = useWallet();
  const [loading, setLoading] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isSessionRestoring, setIsSessionRestoring] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = localStorage.getItem('auth_token');
        const savedAddress = localStorage.getItem('auth_address');

        if (savedToken && savedAddress) {
          // Token exists, validate it's still usable
          setAuthToken(savedToken);

          // If wallet is not connected but we have a saved token, try to auto-reconnect
          if (!connected && !publicKey) {
            try {
              await connect();
            } catch (err) {
              // Connection failed, token may be stale
              console.warn('Failed to restore wallet connection:', err);
              localStorage.removeItem('auth_token');
              localStorage.removeItem('auth_address');
              setAuthToken(null);
            }
          }
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
        // Clear invalid session data
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_address');
        setAuthToken(null);
      } finally {
        setIsSessionRestoring(false);
      }
    };

    restoreSession();
  }, []);

  // Update token when wallet changes
  useEffect(() => {
    if (!connected || !publicKey) {
      return;
    }

    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setAuthToken(savedToken);
    }
  }, [connected, publicKey]);

  const login = async () => {
    if (connected && publicKey && authToken) {
      // Already logged in
      return;
    }

    setLoading(true);
    try {
      // Connect wallet if not already connected
      if (!connected) {
        await connect();
      }

      if (!publicKey || !signMessage) {
        throw new Error('Wallet connection failed');
      }

      // Sign message to get auth token
      const message = new TextEncoder().encode(
        `Sign to authenticate on Solplayroom: ${Date.now()}`
      );
      const signature = await signMessage(message);

      if (!signature) {
        throw new Error('Failed to sign message');
      }

      // Convert signature to base64 for token
      const token = Buffer.from(signature).toString('base64');
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_address', publicKey.toBase58());
      setAuthToken(token);

      toast.success('Connected to wallet');
    } catch (error) {
      console.error('Login failed:', error);
      toast.error('Failed to connect wallet');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_address');
      setAuthToken(null);
      await disconnect();
      toast.success('Logged out');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Failed to disconnect wallet');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const user = connected && publicKey ? { address: publicKey.toBase58() } : null;

  return {
    user,
    login,
    logout,
    loading,
    isSessionRestoring,
  };
}
