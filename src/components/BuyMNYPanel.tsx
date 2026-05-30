import React, { useState } from 'react';
import { toast } from 'sonner';
import { Coins, ShieldAlert, TrendingUp, Zap, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from "@/hooks/useAuth";;
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { subscribeTprSalePrice } from '@/lib/collections/tprSalePrice';
import { subscribeTprPrimarySaleStats } from '@/lib/collections/tprPrimarySaleStats';
import { subscribeTprBuyerStats } from '@/lib/collections/tprBuyerStats';
import { setTprPrimarySales } from '@/lib/collections/tprPrimarySales';
import { Address, Time } from '@/lib/db-client';
import {
  TPR_PRIMARY_SALE_PRICE_LAMPORTS,
  TPR_PRIMARY_SALE_CAP_BASE_UNITS,
  TPR_PER_WALLET_CAP_BASE_UNITS,
} from '@/lib/constants';

const BASE_UNITS = 1_000_000; // 10^6 base units per whole MNY
const LAMPORTS_PER_SOL = 1_000_000_000;

function lamportsToSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4).replace(/\.?0+$/, '') || '0';
}

export const BuyMNYPanel: React.FC = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [isPurchasing, setIsPurchasing] = useState(false);

  // --- Realtime data ---
  const { data: salePriceDoc } = useRealtimeData(
    subscribeTprSalePrice,
    true,
    'main'
  );
  const { data: saleStats } = useRealtimeData(
    subscribeTprPrimarySaleStats,
    true,
    'main'
  );
  const { data: buyerStats } = useRealtimeData(
    subscribeTprBuyerStats,
    !!user?.address,
    user?.address ?? ''
  );

  // --- Derived values ---
  const capBaseUnits = Number(TPR_PRIMARY_SALE_CAP_BASE_UNITS);
  const walletCapBaseUnits = Number(TPR_PER_WALLET_CAP_BASE_UNITS);

  const priceLamports = salePriceDoc?.priceLamportsPerWholeToken
    ?? Number(TPR_PRIMARY_SALE_PRICE_LAMPORTS);

  const totalSold = saleStats?.totalSoldBaseUnits ?? 0;
  const totalSoldMNY = totalSold / BASE_UNITS;
  const capMNY = capBaseUnits / BASE_UNITS;
  const remainingGlobalMNY = Math.max(0, capMNY - totalSoldMNY);
  const progressPct = Math.min(100, (totalSoldMNY / capMNY) * 100);

  const purchasedBaseUnits = buyerStats?.totalPurchasedBaseUnits ?? 0;
  const walletCapMNY = walletCapBaseUnits / BASE_UNITS;
  const walletUsedMNY = purchasedBaseUnits / BASE_UNITS;
  const walletRemainingMNY = Math.max(0, walletCapMNY - walletUsedMNY);

  const amountNum = parseInt(amount, 10);
  const isValidAmount = !isNaN(amountNum) && amountNum > 0;
  const costLamports = isValidAmount ? amountNum * priceLamports : 0;
  const costSOL = lamportsToSol(costLamports);

  // --- Validation ---
  type ValidationError =
    | 'no_wallet'
    | 'zero_amount'
    | 'exceeds_wallet_cap'
    | 'exceeds_global_supply'
    | null;

  function getValidationError(): ValidationError {
    if (!user) return 'no_wallet';
    if (!isValidAmount || amountNum <= 0) return 'zero_amount';
    if (amountNum > walletRemainingMNY) return 'exceeds_wallet_cap';
    if (amountNum > remainingGlobalMNY) return 'exceeds_global_supply';
    return null;
  }
  const validationError = getValidationError();
  const canBuy = validationError === null;

  // --- Handler ---
  async function handleBuy() {
    if (!canBuy || !user?.address) return;
    setIsPurchasing(true);
    try {
      const tprAmountBaseUnits = amountNum * BASE_UNITS;
      const solAmountLamports = amountNum * priceLamports;
      const saleId = `sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const success = await setTprPrimarySales(saleId, {
        buyer: Address.publicKey(user.address),
        tprAmountBaseUnits,
        solAmountLamports,
        ts: Time.Now,
      });
      if (success) {
        toast.success(`Purchased ${amountNum.toLocaleString()} MNY! Welcome to the community.`);
        setAmount('');
      } else {
        toast.error('Purchase failed — wallet may have denied or cap exceeded.');
      }
    } catch {
      toast.error('Purchase failed — wallet may have denied or cap exceeded.');
    } finally {
      setIsPurchasing(false);
    }
  }

  const priceSOLDisplay = lamportsToSol(priceLamports);

  return (
    <Card
      className="relative overflow-hidden border border-border/60 backdrop-blur-sm"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--card) / 0.9) 0%, hsl(var(--card) / 0.7) 100%)',
        boxShadow: '0 0 60px hsl(var(--primary) / 0.12), 0 0 0 1px hsl(var(--primary) / 0.08)',
      }}
    >
      {/* Glow accent top edge */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(var(--primary)), hsl(var(--accent)), transparent)',
        }}
      />

      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'hsl(var(--primary) / 0.15)',
                border: '1px solid hsl(var(--primary) / 0.3)',
                boxShadow: '0 0 20px hsl(var(--primary) / 0.2)',
              }}
            >
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2
                className="text-sm font-black tracking-widest text-foreground"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                BUY MNY
              </h2>
              <p className="text-[10px] text-muted-foreground tracking-wider">PRIMARY SALE</p>
            </div>
          </div>
          {/* Price badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
            style={{
              background: 'hsl(var(--accent) / 0.1)',
              borderColor: 'hsl(var(--accent) / 0.3)',
            }}
          >
            <TrendingUp className="h-3 w-3 text-accent" />
            <span
              className="text-xs font-black text-accent tracking-wider"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              {priceSOLDisplay} SOL/MNY
            </span>
          </div>
        </div>

        {/* Global Supply Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-semibold">
              Drop Remaining
            </span>
            <span
              className="text-xs font-black"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                color: remainingGlobalMNY < 10000 ? '#f59e0b' : 'hsl(var(--foreground))',
              }}
            >
              {remainingGlobalMNY.toLocaleString()} / {capMNY.toLocaleString()} MNY
            </span>
          </div>
          {/* Progress bar */}
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: 'hsl(var(--border))' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: progressPct > 80
                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
                boxShadow: `0 0 8px ${progressPct > 80 ? '#f59e0b' : 'hsl(var(--primary))'}`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{progressPct.toFixed(1)}% SOLD</span>
            <span>100K MNY TOTAL</span>
          </div>
        </div>

        {/* Per-wallet cap */}
        <div
          className="flex items-start justify-between p-3 rounded-xl border"
          style={{
            background: 'hsl(var(--background) / 0.6)',
            borderColor: 'hsl(var(--border) / 0.8)',
          }}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] text-muted-foreground tracking-wider uppercase font-semibold">
                Your wallet cap remaining
              </div>
              {!user ? (
                <div className="text-xs text-muted-foreground italic mt-0.5">
                  Connect wallet to see your cap
                </div>
              ) : (
                <div
                  className="text-sm font-black mt-0.5"
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    color: walletRemainingMNY === 0 ? '#ef4444' : 'hsl(var(--foreground))',
                  }}
                >
                  {walletRemainingMNY.toLocaleString()} MNY
                </div>
              )}
            </div>
          </div>
          {/* Anti-whale badge */}
          <div
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black tracking-widest border flex-shrink-0"
            style={{
              color: '#f59e0b',
              borderColor: '#f59e0b40',
              backgroundColor: '#f59e0b15',
              fontFamily: "'Orbitron', sans-serif",
            }}
          >
            <ShieldAlert className="h-2.5 w-2.5" />
            ANTI-WHALE
          </div>
        </div>

        {/* Amount input */}
        <div className="space-y-2">
          <label
            className="text-[10px] text-muted-foreground tracking-widest uppercase font-semibold"
            htmlFor="mny-amount"
          >
            Amount to buy (MNY)
          </label>
          <div className="relative">
            <input
              id="mny-amount"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPurchasing || !user}
              className="w-full h-12 px-4 pr-20 rounded-xl border bg-background/60 text-foreground text-sm font-bold tracking-wider placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all disabled:opacity-50"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                borderColor: 'hsl(var(--border))',
              }}
            />
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black tracking-widest text-muted-foreground"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              MNY
            </div>
          </div>

          {/* Cost preview */}
          {isValidAmount && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-muted-foreground tracking-wider">Cost</span>
              <span
                className="text-xs font-black text-primary"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                {costSOL} SOL
              </span>
            </div>
          )}

          {/* Validation errors */}
          {amount !== '' && validationError === 'exceeds_wallet_cap' && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              <span>Exceeds your per-wallet cap ({walletRemainingMNY.toLocaleString()} MNY remaining)</span>
            </div>
          )}
          {amount !== '' && validationError === 'exceeds_global_supply' && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-400">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              <span>Only {remainingGlobalMNY.toLocaleString()} MNY remaining in this drop</span>
            </div>
          )}
        </div>

        {/* Buy button */}
        {!user ? (
          <div
            className="w-full h-12 rounded-2xl border flex items-center justify-center text-xs font-bold tracking-widest text-muted-foreground"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              borderColor: 'hsl(var(--border))',
              background: 'hsl(var(--background) / 0.4)',
            }}
          >
            CONNECT WALLET TO BUY
          </div>
        ) : (
          <Button
            onClick={handleBuy}
            disabled={!canBuy || isPurchasing}
            className="w-full h-12 font-black tracking-widest rounded-2xl gap-2 transition-all active:scale-[0.98]"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              boxShadow: canBuy ? '0 0 30px hsl(var(--primary) / 0.4)' : 'none',
            }}
          >
            {isPurchasing ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                PROCESSING...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                BUY {isValidAmount ? `${amountNum.toLocaleString()} MNY` : 'MNY'}
              </>
            )}
          </Button>
        )}

        {/* Sale terms note */}
        <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
          Primary sale · Max 5,000 MNY per wallet · All sales final
        </p>
      </CardContent>
    </Card>
  );
};

export default BuyMNYPanel;
