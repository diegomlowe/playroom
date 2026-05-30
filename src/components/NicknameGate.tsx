import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from "@/hooks/useAuth";;
import { toast } from 'sonner';
import { Address, Time } from '@/lib/db-client';
import { getUsers, setUsers } from '@/lib/collections/users';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

/**
 * NicknameGate — mounts globally and opens a non-dismissible modal the first
 * time a wallet connects without an existing users record. Re-triggers if the
 * user disconnects and a different (unconfigured) wallet connects.
 */
export const NicknameGate: React.FC = () => {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Track the last address we checked so we re-check on address change
  const checkedAddress = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.address) {
      // No wallet — reset so next connect triggers a fresh check
      checkedAddress.current = null;
      return;
    }

    // Same address already handled
    if (checkedAddress.current === user.address) return;

    checkedAddress.current = user.address;

    let cancelled = false;

    async function checkProfile() {
      try {
        const existing = await getUsers(user!.address);
        if (!cancelled && !existing) {
          setNickname('');
          setError('');
          setOpen(true);
        }
      } catch {
        // Silently ignore — if we can't check, don't block the user
      }
    }

    checkProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.address]);

  async function handleSave() {
    const trimmed = nickname.trim();

    if (trimmed.length < 2) {
      setError('Nickname must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 20) {
      setError('Nickname must be 20 characters or fewer.');
      return;
    }

    if (!user?.address) return;

    setSaving(true);
    setError('');

    try {
      const success = await setUsers(user.address, {
        nickname: trimmed,
        address: Address.publicKey(user.address),
        createdAt: Time.Now,
      });

      if (success) {
        setOpen(false);
      } else {
        toast.error('Failed to save nickname. Please try again.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !saving) {
      handleSave();
    }
  }

  return (
    <Dialog
      open={open}
      // onOpenChange intentionally omitted — modal cannot be closed by the user
    >
      <DialogContent
        className="sm:max-w-sm"
        // Prevent closing on backdrop click or Escape
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Hide the built-in X close button */}
        <style>{`[data-radix-dialog-close] { display: none !important; }`}</style>

        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/20 border border-primary/40">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle
              className="text-lg font-black tracking-wide"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              Choose a Name
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Pick a display name. This is how other players will see you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Input
              placeholder="Choose a display name"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={handleKeyDown}
              maxLength={20}
              disabled={saving}
              className="h-11 font-medium"
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive mt-1.5">{error}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1.5 text-right">
              {nickname.trim().length}/20
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || nickname.trim().length === 0}
            className="w-full h-11 font-black tracking-widest"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            {saving ? (
              <span className="animate-pulse">SAVING...</span>
            ) : (
              'SAVE'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NicknameGate;
