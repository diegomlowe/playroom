import { TAROBASE_CONFIG } from '@/lib/config';
import { TPR_TOKEN_ID } from '@/lib/constants';
import { runGetTokenMintAddressQueryForTprToken } from '@/lib/collections/tprToken';
import { useAuth } from '@/hooks/useAuth';
import type { UseAuthReturn } from '@/hooks/useAuth';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, LogOut, RefreshCw, Wallet } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

export type WalletButtonVariant = 'light' | 'dark';

interface WalletButtonProps {
  variant?: WalletButtonVariant;
}

// Isolated button styles that reset all inherited/global styles
const getIsolatedButtonBase = (): React.CSSProperties => ({
  all: 'unset',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
});

const getVariantStyles = (variant: WalletButtonVariant) => {
  if (variant === 'dark') {
    return {
      button: {
        backgroundColor: '#1f2937',
        color: '#e5e7eb',
        border: '1px solid #4b5563',
      },
      buttonHover: {
        backgroundColor: '#374151',
        borderColor: '#6b7280',
      },
      popup: {
        backgroundColor: 'rgba(31, 41, 55, 0.98)',
        border: '1px solid rgba(75, 85, 99, 0.8)',
      },
      text: '#e5e7eb',
      textMuted: '#9ca3af',
      textStrong: '#f9fafb',
      cardBg: 'linear-gradient(135deg, #374151 0%, #1f2937 50%, #111827 100%)',
      itemBg: 'rgba(55, 65, 81, 0.8)',
      itemBorder: 'rgba(75, 85, 99, 0.8)',
      itemHoverBg: 'rgba(75, 85, 81, 1)',
      divider: 'rgba(75, 85, 99, 0.6)',
      iconColor: '#60a5fa',
    };
  }
  // Light variant (default)
  return {
    button: {
      backgroundColor: '#ffffff',
      color: '#374151',
      border: '1px solid #d1d5db',
    },
    buttonHover: {
      backgroundColor: '#f9fafb',
      borderColor: '#9ca3af',
    },
    popup: {
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      border: '1px solid rgba(229, 231, 235, 0.8)',
    },
    text: '#374151',
    textMuted: '#6b7280',
    textStrong: '#111827',
    cardBg: 'linear-gradient(135deg, #fef3c7 0%, #dbeafe 50%, #f3e8ff 100%)',
    itemBg: 'rgba(249, 250, 251, 0.8)',
    itemBorder: 'rgba(229, 231, 235, 0.8)',
    itemHoverBg: 'rgba(243, 244, 246, 1)',
    divider: 'rgba(229, 231, 235, 0.6)',
    iconColor: '#3b82f6',
  };
};

export const WalletButton: React.FC<WalletButtonProps> = ({ variant = 'light' }) => {
  const styles = getVariantStyles(variant);
  const { user, loading, login, logout, isSessionRestoring } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const lastFetchTime = useRef<number>(0);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const FETCH_COOLDOWN = 5000;

  const fetchBalance = async () => {
    if (!user?.address || !TAROBASE_CONFIG.rpcUrl) {
      setBalance(null);
      setTokenBalance(0);
      setBalanceLoading(false);
      return;
    }

    setBalanceLoading(true);

    try {
      // Fetch native SOL balance
      const nativeSolResponse = await fetch(TAROBASE_CONFIG.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [user.address],
        }),
      });

      const nativeSolData = await nativeSolResponse.json();
      if (nativeSolData.error)
        throw new Error(nativeSolData.error.message || 'Failed to fetch balance');

      const balanceInSol = nativeSolData.result.value / 1_000_000_000;
      setBalance(balanceInSol);

      // Resolve the MNY mint address from the tprToken collection, then fetch the specific token account
      let mnyBal = 0;
      try {
        const mintAddress = await runGetTokenMintAddressQueryForTprToken(TPR_TOKEN_ID);
        if (mintAddress) {
          const tokenResponse = await fetch(TAROBASE_CONFIG.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'getTokenAccountsByOwner',
              params: [
                user.address,
                { mint: mintAddress },
                { encoding: 'jsonParsed' },
              ],
            }),
          });

          const tokenData = await tokenResponse.json();
          if (tokenData.result?.value?.length > 0) {
            const info = tokenData.result.value[0].account?.data?.parsed?.info;
            if (info?.tokenAmount?.uiAmount != null) {
              mnyBal = info.tokenAmount.uiAmount;
            }
          }
        }
      } catch {
        // If mint address query fails, mnyBal stays 0 — still display the row
      }
      setTokenBalance(mnyBal);
    } catch (err) {
      console.error('Error fetching SOL balance:', err);
      setBalance(null);
      setTokenBalance(0);
    } finally {
      setBalanceLoading(false);
    }
  };

  const refetch = () => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;

    if (timeSinceLastFetch < FETCH_COOLDOWN) {
      const remaining = Math.ceil((FETCH_COOLDOWN - timeSinceLastFetch) / 1000);
      toast.info(`Please wait ${remaining}s before refreshing`);
      return;
    }

    lastFetchTime.current = now;
    fetchBalance();
  };

  useEffect(() => {
    lastFetchTime.current = 0;
    fetchBalance();
  }, [user?.address]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePopupPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const popupWidth = 320;
      const margin = 8;
      const nextLeft = Math.min(
        Math.max(rect.right - popupWidth, margin),
        window.innerWidth - popupWidth - margin
      );
      const nextTop = Math.max(rect.bottom + 8, margin);

      setPopupPosition({
        top: nextTop,
        left: nextLeft,
      });
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    updatePopupPosition();
    window.addEventListener('resize', updatePopupPosition);
    window.addEventListener('scroll', updatePopupPosition, true);
    document.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('resize', updatePopupPosition);
      window.removeEventListener('scroll', updatePopupPosition, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Failed to login', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to logout', error);
    }
  };

  const getNetworkInfo = () => {
    const chain = TAROBASE_CONFIG.chain;
    const isInMockMode = chain === 'offchain';
    const isMainnet = chain === 'solana_mainnet' || chain === 'solana_mainnet_preview';
    const isSurfnet = chain === 'surfnet';
    return {
      name: isInMockMode ? 'Poofnet' : isMainnet ? 'Mainnet' : isSurfnet ? 'Surfnet' : 'Devnet',
      dotColor: isInMockMode
        ? '#3b82f6' // blue for poofnet
        : isMainnet
          ? '#22c55e' // green for mainnet
          : isSurfnet
            ? '#3b82f6' // blue for surfnet
            : '#f97316', // orange for devnet
    };
  };

  const formatBalance = (bal: number | null) => {
    if (bal === null) return '0.00';
    return bal.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = async () => {
    if (user?.address) {
      await navigator.clipboard.writeText(user.address);
      setJustCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setJustCopied(false), 2000);
    }
  };

  if (loading || isSessionRestoring) {
    return (
      <div>
        <div
          style={{
            height: '36px',
            width: '140px',
            borderRadius: '8px',
            backgroundColor: '#e5e5e5',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {!user ? (
        <motion.button
          onClick={handleLogin}
          style={{
            ...getIsolatedButtonBase(),
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '8px',
            gap: '8px',
            transition: 'all 0.2s ease',
            ...styles.button,
          }}
          whileHover={styles.buttonHover}
          whileTap={{ scale: 0.98 }}
        >
          <Wallet style={{ height: '16px', width: '16px' }} />
          Connect
        </motion.button>
      ) : (
        <div style={{ position: 'relative' }}>
          <motion.button
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            style={{
              ...getIsolatedButtonBase(),
              padding: '8px 12px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '8px',
              gap: '8px',
              transition: 'all 0.2s ease',
              ...styles.button,
            }}
            whileHover={styles.buttonHover}
            whileTap={{ scale: 0.98 }}
          >
            <Wallet style={{ height: '16px', width: '16px' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
              <span>
                {balance !== null ? balance.toFixed(3) : (balanceLoading ? '…' : '-.---')} SOL
              </span>
              <span>
                {balanceLoading ? '…' : `${(tokenBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MNY`}
              </span>
            </span>
          </motion.button>

          {isMounted &&
            createPortal(
              <AnimatePresence>
                {isOpen && (
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 2147483646,
                      pointerEvents: 'auto',
                    }}
                    onMouseDown={() => setIsOpen(false)}
                  >
                    <motion.div
                      ref={popupRef}
                      initial={{ opacity: 0, scale: 0.95, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -8 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      style={{
                        position: 'fixed',
                        top: `${popupPosition.top}px`,
                        left: `${popupPosition.left}px`,
                        width: '320px',
                        backgroundColor: styles.popup.backgroundColor,
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderRadius: '16px',
                        boxShadow:
                          variant === 'dark'
                            ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)'
                            : '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
                        border: styles.popup.border,
                        overflow: 'hidden',
                        zIndex: 2147483647,
                        pointerEvents: 'auto',
                      }}
                      onMouseDown={event => event.stopPropagation()}
                      onClick={event => event.stopPropagation()}
                    >
                {/* Network Indicator */}
                <div
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: getNetworkInfo().dotColor,
                      boxShadow: `0 0 8px ${getNetworkInfo().dotColor}40`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: styles.textMuted,
                    }}
                  >
                    {getNetworkInfo().name}
                  </span>
                </div>

                {/* Poofnet minting hint */}
                {getNetworkInfo().name === 'Poofnet' && (
                  <div
                    style={{
                      padding: '0 16px 8px',
                      fontSize: '11px',
                      color: styles.textMuted,
                      lineHeight: '1.4',
                    }}
                  >
                    App owner can use the poof UI's poofnet button to mint new fake test solana or other tokens directly to wallets.
                  </div>
                )}

                {/* Balance Card */}
                <div
                  style={{
                    margin: '0 16px 16px',
                    padding: '20px',
                    background: styles.cardBg,
                    borderRadius: '12px',
                    position: 'relative',
                  }}
                >
                  {/* Decorative circle */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Wallet style={{ height: '24px', width: '24px', color: styles.iconColor }} />
                  </div>

                  <div style={{ marginLeft: '72px' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: styles.text,
                        marginBottom: '4px',
                      }}
                    >
                      {getNetworkInfo().name} Wallet
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '24px',
                          fontWeight: 600,
                          color: styles.textStrong,
                        }}
                      >
                        {formatBalance(balance)} SOL
                      </span>
                      <motion.button
                        onClick={refetch}
                        disabled={balanceLoading}
                        style={{
                          ...getIsolatedButtonBase(),
                          padding: '4px',
                          backgroundColor:
                            variant === 'dark'
                              ? 'rgba(55, 65, 81, 0.6)'
                              : 'rgba(255, 255, 255, 0.6)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: balanceLoading ? 'not-allowed' : 'pointer',
                          justifyContent: 'center',
                          opacity: balanceLoading ? 0.5 : 1,
                        }}
                        whileHover={{
                          backgroundColor:
                            variant === 'dark'
                              ? 'rgba(55, 65, 81, 0.9)'
                              : 'rgba(255, 255, 255, 0.9)',
                        }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <RefreshCw
                          style={{
                            height: '14px',
                            width: '14px',
                            color: styles.textMuted,
                            animation: balanceLoading ? 'spin 1s linear infinite' : 'none',
                          }}
                        />
                      </motion.button>
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: styles.textMuted,
                        }}
                      >
                        {balanceLoading
                          ? '… MNY'
                          : `${(tokenBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MNY`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Wallet Address */}
                <div style={{ padding: '0 16px', marginBottom: '12px' }}>
                  <motion.button
                    onClick={copyAddress}
                    style={{
                      ...getIsolatedButtonBase(),
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: styles.itemBg,
                      border: `1px solid ${styles.itemBorder}`,
                      borderRadius: '10px',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                    }}
                    whileHover={{
                      backgroundColor: styles.itemHoverBg,
                      borderColor:
                        variant === 'dark' ? 'rgba(107, 114, 128, 1)' : 'rgba(209, 213, 219, 1)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        color: styles.text,
                      }}
                    >
                      {shortenAddress(user.address)}
                    </span>
                    {justCopied ? (
                      <Check style={{ height: '16px', width: '16px', color: '#10b981' }} />
                    ) : (
                      <Copy style={{ height: '16px', width: '16px', color: styles.textMuted }} />
                    )}
                  </motion.button>
                </div>

                {/* Divider */}
                <div
                  style={{
                    height: '1px',
                    backgroundColor: styles.divider,
                    margin: '0 16px',
                  }}
                />

                {/* Logout Button */}
                <div style={{ padding: '12px 16px 16px' }}>
                  <motion.button
                    onClick={handleLogout}
                    style={{
                      ...getIsolatedButtonBase(),
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '10px',
                      gap: '12px',
                      transition: 'all 0.2s ease',
                    }}
                    whileHover={{ backgroundColor: styles.itemBg }}
                  >
                    <LogOut style={{ height: '18px', width: '18px', color: styles.text }} />
                    <span
                      style={{
                        fontSize: '15px',
                        fontWeight: 500,
                        color: styles.text,
                      }}
                    >
                      Log out
                    </span>
                  </motion.button>
                </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>,
              document.body
            )}
        </div>
      )}

      {/* Keyframes for animations */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};

export default WalletButton;
