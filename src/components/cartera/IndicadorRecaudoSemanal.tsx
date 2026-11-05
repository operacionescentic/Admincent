"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  Filter,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatCOP } from "@/lib/nomina/payment";
import {
  calcularRecaudoSemana,
  obtenerLunesDeFecha,
  obtenerSemanasConRecaudo,
  type RecaudoSemana,
} from "@/lib/cartera/recaudo";
import { fechaHoyBogota, parseDateIso, toDateIso } from "@/lib/cartera/tareas";
import type { VentaEnriquecida } from "@/lib/cartera/types";

export default function IndicadorRecaudoSemanal({
  ventas,
  semanaFiltrada,
  onFiltrarSemana,
}: {
  ventas: VentaEnriquecida[];
  semanaFiltrada?: string;
  onFiltrarSemana?: (lunesIso: string | undefined) => void;
}) {
  const hoyIso = useMemo(() => fechaHoyBogota(), []);
  const lunesActualIso = useMemo(() => obtenerLunesDeFecha(hoyIso), [hoyIso]);

  // Semana actualmente seleccionada en el widget (por defecto: lunes de la semana actual)
  const [lunesSeleccionado, setLunesSeleccionado] = useState<string>(() => {
    return semanaFiltrada || lunesActualIso;
  });

  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [tabDetalle, setTabDetalle] = useState<"pagos" | "dias" | "vendedores">("pagos");

  // Lista de semanas históricas que tienen registros + semana actual
  const semanasDisponibles = useMemo(
    () => obtenerSemanasConRecaudo(ventas, hoyIso),
    [ventas, hoyIso],
  );

  // Datos calculados para la semana seleccionada
  const recaudo: RecaudoSemana = useMemo(
    () => calcularRecaudoSemana(ventas, { lunesIso: lunesSeleccionado, fechaReferencia: hoyIso }),
    [ventas, lunesSeleccionado, hoyIso],
  );

  // Navegación: semana anterior (-7 días)
  const irSemanaAnterior = () => {
    const d = parseDateIso(lunesSeleccionado);
    d.setDate(d.getDate() - 7);
    const nuevoLunes = toDateIso(d);
    setLunesSeleccionado(nuevoLunes);
  };

  // Navegación: semana siguiente (+7 días)
  const irSemanaSiguiente = () => {
    const d = parseDateIso(lunesSeleccionado);
    d.setDate(d.getDate() + 7);
    const nuevoLunes = toDateIso(d);
    setLunesSeleccionado(nuevoLunes);
  };

  // Ir a semana actual
  const irSemanaActual = () => {
    setLunesSeleccionado(lunesActualIso);
  };

  // Cambio directo desde el selector
  const handleSelectSemana = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val) setLunesSeleccionado(val);
  };

  // Cambio vía input date
  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      setLunesSeleccionado(obtenerLunesDeFecha(val));
    }
  };

  const estaFiltrandoEstaSemana = semanaFiltrada === lunesSeleccionado;

  const toggleFiltroDashboard = () => {
    if (!onFiltrarSemana) return;
    if (estaFiltrandoEstaSemana) {
      onFiltrarSemana(undefined);
    } else {
      onFiltrarSemana(lunesSeleccionado);
    }
  };

  // Comparativa con la semana anterior
  const comp = recaudo.comparativa;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-950/20 via-[var(--color-surface)] to-[var(--color-surface)] p-5 shadow-lg shadow-emerald-950/10 transition">
      {/* Barra superior: Título, Estado y Controles de filtro por semana */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-400">
            <CircleDollarSign className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-white">
                Recaudo semanal gestionado
              </h2>
              {recaudo.esSemanaActual ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  Semana actual
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-800/80 px-2.5 py-0.5 text-xs text-neutral-300">
                  <CalendarDays className="h-3 w-3 text-neutral-400" />
                  Semana seleccionada
                </span>
              )}

              {estaFiltrandoEstaSemana && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  <Filter className="h-3 w-3" /> Dashboard filtrado
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Semana del <span className="font-medium text-neutral-300">{recaudo.label}</span>
            </p>
          </div>
        </div>

        {/* Controles de cambio de semana */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botones ← y → */}
          <div className="inline-flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5 shadow-sm">
            <button
              type="button"
              onClick={irSemanaAnterior}
              title="Semana anterior"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-300 transition hover:bg-neutral-700/60 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="h-4 w-px bg-[var(--color-border)]" />
            <button
              type="button"
              onClick={irSemanaSiguiente}
              title="Semana siguiente"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-300 transition hover:bg-neutral-700/60 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Botón rápido "Esta semana" si se está viendo otra */}
          {!recaudo.esSemanaActual && (
            <button
              type="button"
              onClick={irSemanaActual}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white"
            >
              Ir a esta semana
            </button>
          )}

          {/* Selector de semanas con actividad */}
          <div className="relative">
            <select
              value={lunesSeleccionado}
              onChange={handleSelectSemana}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] py-1.5 pl-3 pr-8 text-xs font-medium text-white outline-none transition hover:border-neutral-500 focus:border-emerald-500"
            >
              {semanasDisponibles.map((s) => (
                <option key={s.lunesIso} value={s.lunesIso}>
                  {s.esSemanaActual ? "⭐ Esta semana" : s.label}
                  {s.totalRecaudado > 0 ? ` — ${formatCOP(s.totalRecaudado)} (${s.cantidadAbonos})` : " — $0"}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de fecha puntual para saltar a cualquier semana */}
          <label
            title="Seleccionar fecha para ir a su semana"
            className="flex cursor-pointer items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-xs text-neutral-400 transition hover:border-neutral-500 hover:text-white"
          >
            <Calendar className="h-3.5 w-3.5 text-emerald-400" />
            <input
              type="date"
              onChange={handleDateInput}
              value={lunesSeleccionado}
              className="sr-only"
            />
            <span className="hidden sm:inline">Otra fecha</span>
          </label>
        </div>
      </div>

      {/* Cifra Principal y Comparativa */}
      <div className="mt-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
            Total recaudado en la semana
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-white tabular-nums sm:text-4xl">
              {formatCOP(recaudo.totalRecaudado)}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {recaudo.cantidadAbonos === 0 ? (
              <span className="text-neutral-500">Sin pagos registrados en esta semana</span>
            ) : (
              <span>
                <strong className="text-emerald-400">{recaudo.cantidadAbonos}</strong>{" "}
                {recaudo.cantidadAbonos === 1 ? "abono gestionado" : "abonos gestionados"}
              </span>
            )}
          </p>
        </div>

        {/* Comparativa vs semana anterior */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-3.5">
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
            Comparativa semana previa
          </p>
          {comp && comp.totalAnterior > 0 ? (
            <div className="mt-1.5">
              <div className="flex items-center gap-1.5">
                {comp.diferencia >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-amber-400" />
                )}
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    comp.diferencia >= 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {comp.diferencia >= 0 ? "+" : ""}
                  {formatCOP(comp.diferencia)}
                </span>
                {comp.pctCambio !== null && (
                  <span
                    className={`text-xs ${
                      comp.diferencia >= 0 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    ({comp.pctCambio >= 0 ? "+" : ""}
                    {comp.pctCambio}%)
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Semana anterior: {formatCOP(comp.totalAnterior)}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              {recaudo.totalRecaudado > 0
                ? "Sin recaudo en la semana previa"
                : "Semana anterior sin registros"}
            </p>
          )}
        </div>

        {/* Acciones interactivas */}
        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
          {onFiltrarSemana && (
            <button
              type="button"
              onClick={toggleFiltroDashboard}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                estaFiltrandoEstaSemana
                  ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
                  : "border border-[var(--color-border)] bg-[var(--color-surface-2)] text-neutral-200 hover:border-emerald-500/50 hover:text-white"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>
                {estaFiltrandoEstaSemana
                  ? "Quitar filtro de semana"
                  : "Filtrar dashboard con esta semana"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMostrarDetalle((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2 text-xs font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            <span>{mostrarDetalle ? "Ocultar desglose" : "Ver desglose de pagos"}</span>
            {mostrarDetalle ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Sección Expandible: Desglose por Día, Lista de Pagos y Vendedores */}
      {mostrarDetalle && (
        <div className="mt-6 border-t border-[var(--color-border)] pt-5">
          {/* Pestañas internas del desglose */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setTabDetalle("pagos")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tabDetalle === "pagos"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-neutral-400 hover:text-white hover:bg-[var(--color-surface-2)]"
                }`}
              >
                Pagos recibidos ({recaudo.cantidadAbonos})
              </button>
              <button
                type="button"
                onClick={() => setTabDetalle("dias")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tabDetalle === "dias"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-neutral-400 hover:text-white hover:bg-[var(--color-surface-2)]"
                }`}
              >
                Distribución diaria (Lun - Dom)
              </button>
              <button
                type="button"
                onClick={() => setTabDetalle("vendedores")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tabDetalle === "vendedores"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-neutral-400 hover:text-white hover:bg-[var(--color-surface-2)]"
                }`}
              >
                Por comercial ({recaudo.porVendedor.length})
              </button>
            </div>

            <span className="text-xs text-[var(--color-muted)]">
              {recaudo.label}
            </span>
          </div>

          {/* TAB 1: Lista de Pagos / Abonos de la semana */}
          {tabDetalle === "pagos" && (
            <div className="mt-4">
              {recaudo.abonos.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--color-muted)]">
                  No se registraron abonos en la semana del {recaudo.label}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                        <th className="px-3 py-2.5 font-medium">Fecha</th>
                        <th className="px-3 py-2.5 font-medium">Cliente</th>
                        <th className="px-3 py-2.5 font-medium">Servicio</th>
                        <th className="px-3 py-2.5 font-medium">Comercial</th>
                        <th className="px-3 py-2.5 font-medium">Medio / Nota</th>
                        <th className="px-3 py-2.5 text-right font-medium">Valor recibido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {recaudo.abonos.map((a) => (
                        <tr
                          key={a.id}
                          className="transition hover:bg-[var(--color-surface-2)]/60"
                        >
                          <td className="px-3 py-2.5 text-xs font-medium text-neutral-300 tabular-nums">
                            {a.fecha}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-white">
                            {a.cliente}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-[var(--color-muted)]">
                            {a.servicio ?? "Curso"}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-neutral-300">
                            {a.vendedor}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-[var(--color-muted)]">
                            {a.nota ? (
                              <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-300">
                                {a.nota}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-400 tabular-nums">
                            {formatCOP(a.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[var(--color-border)] text-xs font-semibold uppercase text-neutral-200">
                        <td colSpan={5} className="px-3 py-3 text-right">
                          Total gestionado en la semana:
                        </td>
                        <td className="px-3 py-3 text-right text-base font-extrabold text-emerald-400 tabular-nums">
                          {formatCOP(recaudo.totalRecaudado)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Distribución Diaria */}
          {tabDetalle === "dias" && (
            <div className="mt-4">
              <div className="grid gap-2 sm:grid-cols-7">
                {recaudo.porDia.map((d) => {
                  const tieneAbonos = d.total > 0;
                  return (
                    <div
                      key={d.fechaIso}
                      className={`flex flex-col justify-between rounded-xl border p-3 transition ${
                        d.esHoy
                          ? "border-emerald-500/60 bg-emerald-500/10 shadow-sm"
                          : tieneAbonos
                            ? "border-emerald-500/30 bg-[var(--color-surface-2)]/60"
                            : "border-[var(--color-border)] bg-[var(--color-surface-2)]/30 opacity-70"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-neutral-300">
                            {d.diaNombre.slice(0, 3)}
                          </span>
                          <span
                            className={`text-xs tabular-nums ${
                              d.esHoy
                                ? "rounded-full bg-emerald-500 px-1.5 text-black font-extrabold"
                                : "text-neutral-400"
                            }`}
                          >
                            {d.diaNumero}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-bold text-white tabular-nums">
                          {tieneAbonos ? formatCOP(d.total) : "$0"}
                        </p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-[var(--color-border)]/50">
                        <span className="text-[11px] text-[var(--color-muted)]">
                          {d.cantidad === 1 ? "1 abono" : `${d.cantidad} abonos`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Por Comercial */}
          {tabDetalle === "vendedores" && (
            <div className="mt-4">
              {recaudo.porVendedor.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--color-muted)]">
                  Sin recaudo por comerciales en esta semana.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recaudo.porVendedor.map((v) => {
                    const pct =
                      recaudo.totalRecaudado > 0
                        ? Math.round((v.total / recaudo.totalRecaudado) * 100)
                        : 0;
                    return (
                      <div
                        key={v.vendedor}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{v.vendedor}</span>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400">
                            {pct}%
                          </span>
                        </div>
                        <p className="mt-2 text-lg font-bold text-emerald-400 tabular-nums">
                          {formatCOP(v.total)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          {v.cantidad} {v.cantidad === 1 ? "pago recibido" : "pagos recibidos"}
                        </p>
                        {/* Barra de progreso de la cuota del vendedor */}
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                          <div
                            className="h-full bg-emerald-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
