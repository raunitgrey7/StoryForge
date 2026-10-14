"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff, LogOut, RefreshCw, UserRound } from "lucide-react";
import { cloudEnabled } from "@/lib/cloud/supabase";
import { signInWithEmail, signInWithGoogle, signOut, startCloud, syncNow, useCloud } from "@/lib/cloud/sync";
import { Button, Input, Spinner } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";

/**
 * Sign in, sync status, sign out. Lives in the rail footer on desktop and the
 * Works drawer on mobile. Without cloud configuration it explains the local mode.
 */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const cloud = useCloud();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    startCloud();
  }, []);

  const enabled = cloudEnabled();

  if (!enabled) {
    return (
      <div className={`flex items-center gap-2 rounded-[10px] px-2 py-2 text-xs text-ink-3 ${compact ? "" : ""}`} title="Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable accounts">
        <CloudOff size={14} /> Local only. Your work stays in this browser.
      </div>
    );
  }

  if (cloud.user) {
    const name = (cloud.user.user_metadata?.full_name as string | undefined) || cloud.user.email || "Signed in";
    return (
      <div className="rounded-[10px] px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aurora/15 text-aurora">
            <UserRound size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-ink">{name}</div>
            <div className="text-[10px] text-ink-3">
              {cloud.syncing ? "Syncing…" : cloud.error ? `Sync failed: ${cloud.error}` : cloud.lastSyncedAt ? `Synced ${new Date(cloud.lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Synced"}
            </div>
          </div>
          <button onClick={() => syncNow().then(() => toast("Synced"))} className="rounded p-1 text-ink-3 hover:text-ink" title="Sync now" aria-label="Sync now">
            {cloud.syncing ? <Spinner /> : <RefreshCw size={14} />}
          </button>
          <button onClick={() => signOut().then(() => toast("Signed out", "Your work stays on this device."))} className="rounded p-1 text-ink-3 hover:text-ember" title="Sign out" aria-label="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-left text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
        <Cloud size={15} /> Sign in to sync across devices
      </button>
      {open && (
        <div className="sf-enter space-y-2 px-2 pb-2">
          <Button
            className="w-full"
            size="sm"
            onClick={async () => {
              try {
                await signInWithGoogle();
              } catch (e) {
                toast("Sign-in failed", (e as Error).message, "error");
              }
            }}
          >
            Continue with Google
          </Button>
          {sent ? (
            <p className="text-[11px] text-aurora">Check your email for the sign-in link.</p>
          ) : (
            <form
              className="flex gap-1"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!email.trim()) return;
                setBusy(true);
                try {
                  await signInWithEmail(email.trim());
                  setSent(true);
                } catch (err) {
                  toast("Could not send the link", (err as Error).message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-8 text-xs" />
              <Button size="sm" type="submit" disabled={busy} icon={busy ? <Spinner /> : undefined}>
                Email link
              </Button>
            </form>
          )}
          <p className="text-[10px] leading-snug text-ink-3">No password. Your writing syncs privately to your account and stays available offline.</p>
        </div>
      )}
    </div>
  );
}
