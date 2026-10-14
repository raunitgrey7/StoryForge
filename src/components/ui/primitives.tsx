"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

type Tone = "gold" | "aurora" | "quiet" | "ghost" | "danger" | "paper";

const toneClass: Record<Tone, string> = {
  gold: "bg-gold text-gold-ink hover:brightness-110 shadow-[0_8px_24px_-12px_var(--gold)]",
  aurora: "bg-aurora text-[#052a22] hover:brightness-110",
  quiet: "bg-surface-2 text-ink border border-line hover:border-line-2",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
  danger: "text-ember hover:bg-ember/10",
  paper: "bg-white text-[#221c3d] border border-[#ddd7ee] hover:border-[#b9b0dc]",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: "sm" | "md" | "lg"; icon?: ReactNode; tip?: string }
>(function Button({ tone = "quiet", size = "md", icon, tip, className = "", children, ...rest }, ref) {
  const sz = size === "sm" ? "h-8 px-3 text-[13px] gap-1.5" : size === "lg" ? "h-12 px-6 text-[15px] gap-2" : "h-10 px-4 text-sm gap-2";
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-[10px] font-medium transition-[background,filter,border-color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${sz} ${toneClass[tone]} ${className}`}
      data-tip={tip}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }
>(function IconButton({ label, active, className = "", children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      aria-label={label}
      data-tip={label}
      data-tip-side="bottom"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors ${
        active ? "bg-gold/15 text-gold" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; tip?: string }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-[10px] border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          data-tip={o.tip}
          data-tip-side="bottom"
          className={`rounded-[8px] px-2.5 font-medium transition-colors ${size === "sm" ? "h-7 text-xs" : "h-8 text-sm"} ${
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={`h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-line-2 ${className}`}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = "", ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`w-full resize-none rounded-[10px] border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-3 focus:border-line-2 ${className}`}
      {...rest}
    />
  );
});

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-3">{hint}</span>}
    </label>
  );
}

export function Pill({ children, hue, className = "" }: { children: ReactNode; hue?: number; className?: string }) {
  const style = hue !== undefined ? { background: `oklch(0.9 0.06 ${hue} / 0.35)`, color: `oklch(0.45 0.12 ${hue})` } : undefined;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${hue === undefined ? "bg-surface-2 text-ink-2" : ""} ${className}`} style={style}>
      {children}
    </span>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[12px] border border-dashed border-line-2 p-5">
      <div className="font-display text-lg font-semibold leading-tight text-ink">{title}</div>
      <p className="text-sm leading-relaxed text-ink-2">{body}</p>
      {action}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      aria-hidden
    />
  );
}
