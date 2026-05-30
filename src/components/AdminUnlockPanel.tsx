import React, { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from "@/hooks/useAuth";;
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { subscribeTokenUnlockStats, TokenUnlockStatsResponse } from '@/lib/collections/tokenUnlockStats';
import { subscribeManyTokenUnlocks, setTokenUnlocks, TokenUnlocksResponse } from '@/lib/collections/tokenUnlocks';
import { ADMIN_ADDRESS, TPR_UNLOCK_AMOUNT_PER_TRANCHE, TPR_INITIAL_SUPPLY } from '@/lib/constants';
import { Address } from '@/lib/db-client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ShieldAlert, Lock, Unlock, AlertTriangle, ChevronRight, CheckCircle2, ChevronDown } from 'lucide-react';

type MilestoneId = 'second-sale' | 'special-prizes-part-2' | 'final-sale';

const MILESTONE_OPTIONS: { id: MilestoneId; label: string }[] = [
  { id: 'second-sale', label: 'Second Sale' },
  { id: 'special-prizes-part-2', label: 'Special Prizes Part 2' },
  { id: 'final-sale', label: 'Final Sale' },
];

// Base-unit amounts parsed from constants
const TRANCHE_BASE = parseInt(TPR_UNLOCK_AMOUNT_PER_TRANCHE, 10); // 200_000_000_000
const TOTAL_SUPPLY_BASE = parseInt(TPR_INITIAL_SUPPLY, 10);         // 1_000_000_000_000
const RESERVE_BASE = TOTAL_SUPPLY_BASE * 0.8;                       // 800_000_000_000
const DECIMALS = 6; // MNY has 6 decimals
const TOTAL_TRANCHES = 4;

/** Convert base units to display MNY (divide by 10^6). */
function toMNY(base: number): string {
  return (base / Math.pow(10, DECIMALS)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export const AdminUnlockPanel: React.FC = () => {
  const { user } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<MilestoneId | null>(null);
  const [milestoneDropdownOpen, setMilestoneDropdownOpen] = useState(false);

  const isAdmin = !!(user && user.address === ADMIN_ADDRESS);

  // Realtime stats — enabled only for admin (avoids unnecessary subscriptions for non-admins)
  const { data: stats } = useRealtimeData<TokenUnlockStatsResponse | null>(
    subscribeTokenUnlockStats,
    isAdmin,
    'main',
  );

  // Recent unlocks — enabled only for admin
  const { data: allUnlocks } = useRealtimeData<TokenUnlocksResponse[]>(
    subscribeManyTokenUnlocks,
    isAdmin,
  );

  // Guard: not admin → render nothing
  if (!isAdmin) return null;

  const totalUnlocked = stats?.totalUnlocked ?? 0;
  const remaining = Math.max(0, RESERVE_BASE - totalUnlocked);
  const tranchesReleased = Math.floor(totalUnlocked / TRANCHE_BASE);
  const nextTranche = tranchesReleased + 1;
  const allReleased = tranchesReleased >= TOTAL_TRANCHES;
  const pctReleased = Math.min(100, (totalUnlocked / RESERVE_BASE) * 100);

  const usedMilestoneIds = new Set(
    (allUnlocks ?? []).map((u) => u.milestoneId).filter(Boolean)
  );

  const selectedMilestone = MILESTONE_OPTIONS.find((m) => m.id === selectedMilestoneId) ?? null;
  const isMilestoneAlreadyUsed = selectedMilestoneId ? usedMilestoneIds.has(selectedMilestoneId) : false;
  const canRelease = !allReleased && !releasing && selectedMilestoneId !== null && !isMilestoneAlreadyUsed;

  const recentUnlocks = [...(allUnlocks ?? [])]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 10);

  async function handleRelease() {
    if (!user || !selectedMilestoneId) return;
    setReleasing(true);
    setConfirmOpen(false);

    const unlockId = `tranche-${nextTranche}-${Date.now()}`;
    try {
      const success = await setTokenUnlocks(unlockId, {
        triggeredBy: Address.publicKey(user.address),
        amount: TRANCHE_BASE,
        tranche: nextTranche,
        ts: Math.floor(Date.now() / 1000),
        milestoneId: selectedMilestoneId,
      });

      if (success) {
        toast.success(`Tranche ${nextTranche} released — ${toMNY(TRANCHE_BASE)} MNY unlocked (${selectedMilestone?.label}).`);
        setSelectedMilestoneId(null);
      } else {
        toast.error('Release was denied by policy. Check admin permissions.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Release failed: ${msg}`);
    } finally {
      setReleasing(false);
    }
  }

  return (
    <>
      {/* Separator */}
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px" style={{ background: 'hsl(var(--destructive) / 0.25)' }} />
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest"
          style={{
            background: 'hsl(var(--destructive) / 0.12)',
            border: '1px solid hsl(var(--destructive) / 0.35)',
            color: 'hsl(var(--destructive))',
            fontFamily: "'Orbitron', sans-serif",
          }}>
          <ShieldAlert className="h-3 w-3" />
          ADMIN ONLY
        </div>
        <div className="flex-1 h-px" style={{ background: 'hsl(var(--destructive) / 0.25)' }} />
      </div>

      {/* Panel */}
      <Card
        className="overflow-hidden"
        style={{
          background: 'hsl(var(--card) / 0.75)',
          border: '1px solid hsl(var(--destructive) / 0.35)',
          boxShadow: '0 0 30px hsl(var(--destructive) / 0.08)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Header */}
        <CardHeader className="p-5 pb-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'hsl(var(--destructive) / 0.12)',
                border: '1px solid hsl(var(--destructive) / 0.3)',
              }}
            >
              <Lock className="h-5 w-5" style={{ color: 'hsl(var(--destructive))' }} />
            </div>
            <div>
              <h2
                className="text-sm font-black tracking-widest"
                style={{ fontFamily: "'Orbitron', sans-serif", color: 'hsl(var(--destructive))' }}
              >
                Admin: Release Locked Reserve
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Transfers MNY from treasury PDA to admin wallet
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: 'Unlocked',
                value: `${toMNY(totalUnlocked)} MNY`,
                sub: `${tranchesReleased} / ${TOTAL_TRANCHES} tranches`,
                color: '#22c55e',
              },
              {
                label: 'Remaining',
                value: `${toMNY(remaining)} MNY`,
                sub: `in treasury`,
                color: '#f59e0b',
              },
              {
                label: 'Progress',
                value: `${pctReleased.toFixed(0)}%`,
                sub: 'of 80% reserve',
                color: 'hsl(var(--primary))',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-3 text-center"
                style={{ background: 'hsl(var(--border) / 0.3)', border: '1px solid hsl(var(--border) / 0.5)' }}
              >
                <div className="text-[10px] text-muted-foreground tracking-widest uppercase mb-1"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}>
                  {s.label}
                </div>
                <div className="text-sm font-black leading-tight" style={{ color: s.color, fontFamily: "'Orbitron', sans-serif" }}>
                  {s.value}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-semibold tracking-wider"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                Reserve Released
              </span>
              <span className="font-bold" style={{ color: '#22c55e' }}>
                Tranche {tranchesReleased} of {TOTAL_TRANCHES}
              </span>
            </div>
            {/* Custom progress bar — Progress component uses bg-primary which we override */}
            <div
              className="relative h-2.5 w-full overflow-hidden rounded-full"
              style={{ background: 'hsl(var(--border) / 0.5)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pctReleased}%`,
                  background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                  boxShadow: pctReleased > 0 ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Milestone selector */}
          {!allReleased && (
            <div className="space-y-2">
              <div
                className="text-[10px] font-black tracking-widest text-muted-foreground uppercase"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                Select Milestone to Trigger
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMilestoneDropdownOpen((o) => !o)}
                  className="w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-colors"
                  style={{
                    background: 'hsl(var(--border) / 0.35)',
                    border: selectedMilestoneId
                      ? '1px solid hsl(var(--destructive) / 0.5)'
                      : '1px solid hsl(var(--border) / 0.5)',
                    color: selectedMilestoneId ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                    fontFamily: "'Orbitron', sans-serif",
                  }}
                >
                  <span>{selectedMilestone?.label ?? 'Choose milestone…'}</span>
                  <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                </button>

                {milestoneDropdownOpen && (
                  <div
                    className="absolute z-50 mt-1.5 w-full rounded-xl overflow-hidden shadow-xl"
                    style={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border) / 0.6)',
                    }}
                  >
                    {MILESTONE_OPTIONS.map((opt) => {
                      const used = usedMilestoneIds.has(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={used}
                          onClick={() => {
                            if (!used) {
                              setSelectedMilestoneId(opt.id);
                              setMilestoneDropdownOpen(false);
                            }
                          }}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors text-left"
                          style={{
                            fontFamily: "'Orbitron', sans-serif",
                            color: used ? 'hsl(var(--muted-foreground) / 0.5)' : 'hsl(var(--foreground))',
                            cursor: used ? 'not-allowed' : 'pointer',
                            background:
                              selectedMilestoneId === opt.id
                                ? 'hsl(var(--destructive) / 0.1)'
                                : 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            if (!used) (e.currentTarget as HTMLButtonElement).style.background = 'hsl(var(--border) / 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background =
                              selectedMilestoneId === opt.id
                                ? 'hsl(var(--destructive) / 0.1)'
                                : 'transparent';
                          }}
                        >
                          <span className="font-bold">{opt.label}</span>
                          {used && (
                            <span
                              className="text-[9px] tracking-wider px-1.5 py-0.5 rounded-md"
                              style={{
                                background: 'rgba(34,197,94,0.12)',
                                color: '#22c55e',
                                border: '1px solid rgba(34,197,94,0.3)',
                              }}
                            >
                              TRIGGERED
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedMilestoneId && isMilestoneAlreadyUsed && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px]"
                  style={{
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    color: '#22c55e',
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>This milestone has already been triggered.</span>
                </div>
              )}

              {selectedMilestoneId && !isMilestoneAlreadyUsed && (
                <div
                  className="rounded-lg px-3 py-2 text-[11px]"
                  style={{
                    background: 'hsl(var(--destructive) / 0.06)',
                    border: '1px solid hsl(var(--destructive) / 0.25)',
                    color: 'hsl(var(--destructive))',
                    fontFamily: "'Orbitron', sans-serif",
                  }}
                >
                  Ready to trigger: <span className="font-black">{selectedMilestone?.label}</span>
                  {' '}— Tranche {nextTranche}, {toMNY(TRANCHE_BASE)} MNY
                </div>
              )}
            </div>
          )}

          {/* Release button */}
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!canRelease}
            className="w-full h-11 font-black tracking-widest rounded-xl shadow-lg active:scale-95 transition-transform"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '11px',
              background: canRelease ? 'hsl(var(--destructive))' : undefined,
              color: canRelease ? 'hsl(var(--destructive-foreground))' : undefined,
            }}
          >
            {releasing ? (
              <span className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                RELEASING…
              </span>
            ) : allReleased ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                ALL 4 TRANCHES RELEASED
              </span>
            ) : !selectedMilestoneId ? (
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                SELECT A MILESTONE FIRST
              </span>
            ) : isMilestoneAlreadyUsed ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                MILESTONE ALREADY TRIGGERED
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Unlock className="h-4 w-4" />
                RELEASE TRANCHE {nextTranche} — {selectedMilestone?.label?.toUpperCase()}
              </span>
            )}
          </Button>

          {/* Recent unlocks */}
          {recentUnlocks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-black tracking-widest text-muted-foreground uppercase"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                Unlock History
              </h3>
              <div className="space-y-1.5">
                {recentUnlocks.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ background: 'hsl(var(--border) / 0.25)', border: '1px solid hsl(var(--border) / 0.4)' }}
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[9px] font-black tracking-wider px-1.5 py-0"
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          color: '#22c55e',
                          borderColor: 'rgba(34,197,94,0.4)',
                          background: 'rgba(34,197,94,0.1)',
                        }}
                      >
                        T{u.tranche}
                      </Badge>
                      <div>
                        <div className="text-[11px] font-bold text-foreground">
                          {toMNY(u.amount)} MNY
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {shortenAddr(u.triggeredBy)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">
                        {formatTs(u.ts)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          className="max-w-sm"
          style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--destructive) / 0.4)',
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'hsl(var(--destructive) / 0.15)', border: '1px solid hsl(var(--destructive) / 0.4)' }}
              >
                <AlertTriangle className="h-5 w-5" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <DialogTitle
                className="text-sm font-black tracking-widest leading-snug"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                Confirm: {selectedMilestone?.label ?? `Tranche ${nextTranche}`}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs leading-relaxed space-y-2 mt-1">
              <div className="rounded-lg p-3 space-y-1.5"
                style={{ background: 'hsl(var(--border) / 0.3)', border: '1px solid hsl(var(--border) / 0.5)' }}>
                {[
                  ['Milestone', selectedMilestone?.label ?? '—'],
                  ['Tranche', `${nextTranche} of ${TOTAL_TRANCHES}`],
                  ['Amount', `200,000 MNY`],
                  ['Destination', shortenAddr(ADMIN_ADDRESS)],
                  ['Source', 'Treasury PDA'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-muted-foreground font-semibold">{k}</span>
                    <span className="font-bold text-foreground">{v}</span>
                  </div>
                ))}
              </div>
              <div
                className="flex items-start gap-2 rounded-lg p-3 text-[11px]"
                style={{
                  background: 'hsl(var(--destructive) / 0.08)',
                  border: '1px solid hsl(var(--destructive) / 0.3)',
                  color: 'hsl(var(--destructive))',
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  This triggers an irreversible onchain transaction. Once confirmed, the tokens cannot be returned to the treasury.
                </span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="flex-1 font-bold tracking-wider text-xs"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              CANCEL
            </Button>
            <Button
              onClick={handleRelease}
              className="flex-1 font-black tracking-wider text-xs"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                background: 'hsl(var(--destructive))',
                color: 'hsl(var(--destructive-foreground))',
              }}
            >
              <ChevronRight className="h-3.5 w-3.5 mr-1" />
              CONFIRM RELEASE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminUnlockPanel;
