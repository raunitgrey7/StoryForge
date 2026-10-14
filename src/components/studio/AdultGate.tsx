"use client";

import { saveProfile } from "@/lib/db";
import { Button } from "@/components/ui/primitives";

/**
 * Shown before any mature or explicit output. The writer confirms once; the
 * confirmation lives in their profile and syncs with their account.
 */
export function AdultGate({ open, onClose, onConfirmed }: { open: boolean; onClose: () => void; onConfirmed?: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-bg-deep/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="sf-enter w-full max-w-md rounded-t-[18px] border border-line bg-surface p-6 shadow-2xl sm:rounded-[16px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <h2 className="font-display text-2xl font-medium">Adult content</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          This work is rated for adults. With your confirmation the companion will write sex, desire, kink and violence frankly, at the heat level you set for the work.
        </p>
        <ul className="mt-3 space-y-1 text-xs leading-relaxed text-ink-3">
          <li>Every character in a sexual situation is an adult. That line does not move.</li>
          <li>No sexual content about real, identifiable people.</li>
          <li>You own what you write. Nothing is used to train anything.</li>
        </ul>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button tone="ghost" onClick={onClose}>
            Not now
          </Button>
          <Button
            tone="gold"
            onClick={async () => {
              await saveProfile({ adultVerified: true, adultVerifiedAt: Date.now() });
              onConfirmed?.();
              onClose();
            }}
          >
            I am 18 or older
          </Button>
        </div>
      </div>
    </div>
  );
}
