"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { IconBack } from "@/components/icons";
import { navigate } from "@/lib/paths";
import { statusLabel } from "@/lib/store";
import type { OrderStatus } from "@/lib/types";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "dark" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-accent text-white border-accent",
    outline: "bg-transparent text-accent border-accent",
    dark: "bg-ink text-white border-ink",
    ghost: "bg-transparent text-ink border-transparent",
    danger: "bg-transparent text-danger border-danger",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex h-12 items-center justify-center rounded-full border px-5 text-base font-semibold tracking-tight transition-transform duration-200 enabled:active:scale-95 disabled:opacity-40 ${styles} ${className}`}
    />
  );
}

export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold tracking-wide text-ink">{label}</span>
      <input
        {...props}
        className="h-12 w-full rounded border border-[#d6dbde] bg-white px-3 text-base text-ink outline-none focus:border-accent"
      />
    </label>
  );
}

export function TextArea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold tracking-wide text-ink">{label}</span>
      <textarea
        {...props}
        className="min-h-24 w-full rounded border border-[#d6dbde] bg-white px-3 py-3 text-base text-ink outline-none focus:border-accent"
      />
    </label>
  );
}

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const classes = `rounded-xl bg-white p-4 shadow-[0_0_0.5px_rgba(0,0,0,0.14),0_1px_1px_rgba(0,0,0,0.24)] ${className}`;
  if (!onClick) return <div className={classes}>{children}</div>;
  return (
    <button type="button" onClick={onClick} className={`${classes} w-full text-left active:scale-[0.99]`}>
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone =
    status === "READY_FOR_PICKUP"
      ? "bg-[#faf6ee] text-[#8a6a22]"
      : status === "CANCELLED"
        ? "bg-[#fdecea] text-danger"
        : status === "COMPLETED" || status === "CONFIRMED" || status === "PENDING_BALANCE"
          ? "bg-mint text-green"
          : status === "PREPARING"
            ? "bg-[#fff6d8] text-[#7a5b00]"
            : "bg-ceramic text-ink";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>
      {statusLabel(status)}
    </span>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="px-2 py-16 text-center">
      <h2 className="text-xl font-bold text-green">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-danger">{children}</p>;
}

export function QtyStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(value - 1)}
        className="grid h-10 w-10 place-items-center rounded-full border border-[#d6dbde] text-lg active:scale-95"
      >
        −
      </button>
      <span className="w-6 text-center text-base font-bold">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(10, value + 1))}
        className="grid h-10 w-10 place-items-center rounded-full border border-[#d6dbde] text-lg active:scale-95"
      >
        +
      </button>
    </div>
  );
}

export function DietMark({ veg }: { veg: boolean }) {
  return (
    <span
      className={`inline-grid h-3.5 w-3.5 place-items-center rounded-[2px] border ${veg ? "border-accent" : "border-danger"}`}
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${veg ? "bg-accent" : "bg-danger"}`} />
    </span>
  );
}

export function Screen({
  title,
  eyebrow,
  backHref,
  showTabs = false,
  children,
  footer,
  headerRight,
}: {
  title?: string;
  eyebrow?: string;
  backHref?: string;
  showTabs?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  headerRight?: ReactNode;
}) {
  const bottomPad = showTabs
    ? footer
      ? "pb-44"
      : "pb-28"
    : footer
      ? "pb-28"
      : "pb-8";
  return (
    <div className="min-h-dvh">
      {title || backHref ? (
        <header className="sticky top-0 z-20 border-b border-black/5 bg-canvas/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex h-14 items-center gap-1">
            {backHref ? (
              <button
                type="button"
                aria-label="Back"
                onClick={() => navigate(backHref)}
                className="grid h-11 w-11 place-items-center rounded-full active:scale-95"
              >
                <IconBack />
              </button>
            ) : (
              <span className="w-2" />
            )}
            <div className="min-w-0 flex-1">
              {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{eyebrow}</p> : null}
              {title ? <h1 className="truncate text-xl font-bold text-green">{title}</h1> : null}
            </div>
            {headerRight}
          </div>
        </header>
      ) : null}
      <main className={`px-4 pt-4 ${bottomPad}`}>{children}</main>
      {footer ? (
        <div
          className="pointer-events-none fixed inset-x-0 z-30 mx-auto w-full max-w-[480px]"
          style={{ bottom: showTabs ? "calc(4rem + env(safe-area-inset-bottom))" : "0px" }}
        >
          <div
            className="pointer-events-auto border-t border-black/5 bg-canvas px-4 pt-3"
            style={{ paddingBottom: showTabs ? "0.75rem" : "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-left shadow-[0_0_0.5px_rgba(0,0,0,0.14),0_1px_1px_rgba(0,0,0,0.24)]"
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className={`h-7 w-12 rounded-full p-1 ${checked ? "bg-accent" : "bg-[#d6dbde]"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
