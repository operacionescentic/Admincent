import type { ReactNode } from "react";
import { COLOR_ESTADO } from "@/lib/cartera/aggregate";
import type { EstadoCartera } from "@/lib/cartera/types";

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">{subtitle}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
          : "border-[var(--color-border)] bg-[var(--color-surface)]"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
}

export function EstadoBadge({ estado, manual }: { estado: EstadoCartera; manual?: boolean }) {
  const color = COLOR_ESTADO[estado];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color }}
      title={manual ? "Estado fijado manualmente" : "Estado derivado de las notas de gestión"}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {estado}
      {manual && <span className="opacity-60">·</span>}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="py-10 text-center text-sm text-[var(--color-muted)]">{children}</p>
  );
}
