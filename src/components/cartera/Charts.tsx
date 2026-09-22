"use client";
import { formatCOP } from "@/lib/nomina/payment";
import type { Grupo } from "@/lib/cartera/aggregate";
import { EmptyState } from "./ui";

/**
 * Gráficas en SVG/CSS puro. No se añade una librería de charts para no
 * arrastrar una dependencia nueva ni romper la paleta de la app.
 */

const PALETA = [
  "#f44336",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#14b8a6",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#06b6d4",
  "#8b5cf6",
  "#eab308",
  "#64748b",
  "#94a3b8",
];

export const colorPorIndice = (i: number) => PALETA[i % PALETA.length];

/** Barras horizontales con etiqueta, valor y número de registros. */
export function BarList({
  grupos,
  colores,
  onSelect,
  seleccion,
}: {
  grupos: Grupo[];
  colores?: Record<string, string>;
  onSelect?: (etiqueta: string) => void;
  seleccion?: string;
}) {
  if (grupos.length === 0) return <EmptyState>Sin datos para mostrar.</EmptyState>;

  const max = Math.max(...grupos.map((g) => g.cartera), 1);

  return (
    <ul className="space-y-3">
      {grupos.map((g, i) => {
        const color = colores?.[g.etiqueta] ?? colorPorIndice(i);
        const pct = (g.cartera / max) * 100;
        const activo = seleccion === g.etiqueta;

        const contenido = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate" title={g.etiqueta}>
                {g.etiqueta}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatCOP(g.cartera)}
                <span className="ml-2 text-xs text-[var(--color-muted)]">
                  {g.registros} {g.registros === 1 ? "reg." : "regs."}
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(pct, 1.5)}%`, backgroundColor: color }}
              />
            </div>
          </>
        );

        return (
          <li key={g.etiqueta}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(g.etiqueta)}
                className={`w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--color-surface-2)] ${
                  activo ? "bg-[var(--color-surface-2)] ring-1 ring-[var(--color-accent)]/50" : ""
                }`}
                aria-pressed={activo}
              >
                {contenido}
              </button>
            ) : (
              <div className="px-2 py-1.5">{contenido}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Dona con leyenda. Cada segmento es un arco de un círculo SVG. */
export function Donut({
  grupos,
  colores,
  centroLabel,
  centroValor,
}: {
  grupos: Grupo[];
  colores?: Record<string, string>;
  centroLabel?: string;
  centroValor?: string;
}) {
  const total = grupos.reduce((a, g) => a + g.cartera, 0);

  if (total <= 0) return <EmptyState>Sin datos para mostrar.</EmptyState>;

  const radio = 70;
  const circunferencia = 2 * Math.PI * radio;

  const fracciones = grupos.map((g) => g.cartera / total);

  const segmentos = grupos.map((g, i) => {
    // Desplazamiento del arco: la suma de todos los segmentos anteriores.
    const previo = fracciones.slice(0, i).reduce((a, f) => a + f, 0);
    return {
      etiqueta: g.etiqueta,
      color: colores?.[g.etiqueta] ?? colorPorIndice(i),
      dash: fracciones[i] * circunferencia,
      offset: -previo * circunferencia,
      pct: fracciones[i],
      cartera: g.cartera,
      registros: g.registros,
    };
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0 -rotate-90">
        <circle
          cx="90"
          cy="90"
          r={radio}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth="22"
        />
        {segmentos.map((s) => (
          <circle
            key={s.etiqueta}
            cx="90"
            cy="90"
            r={radio}
            fill="none"
            stroke={s.color}
            strokeWidth="22"
            strokeDasharray={`${s.dash} ${circunferencia - s.dash}`}
            strokeDashoffset={s.offset}
          >
            <title>{`${s.etiqueta}: ${formatCOP(s.cartera)} (${Math.round(s.pct * 100)}%)`}</title>
          </circle>
        ))}
        {centroValor && (
          <g className="rotate-90" style={{ transformOrigin: "90px 90px" }}>
            <text
              x="90"
              y="86"
              textAnchor="middle"
              className="fill-[var(--color-foreground)] text-[15px] font-semibold"
            >
              {centroValor}
            </text>
            {centroLabel && (
              <text
                x="90"
                y="103"
                textAnchor="middle"
                className="fill-[var(--color-muted)] text-[9px] uppercase tracking-wide"
              >
                {centroLabel}
              </text>
            )}
          </g>
        )}
      </svg>

      <ul className="w-full space-y-2 text-sm">
        {segmentos.map((s) => (
          <li key={s.etiqueta} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate" title={s.etiqueta}>
                {s.etiqueta}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-[var(--color-muted)]">
              {Math.round(s.pct * 100)}% · {s.registros}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barra de progreso simple para el porcentaje de recaudo. */
export function ProgressBar({ valor, color = "#22c55e" }: { valor: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, valor * 100));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
