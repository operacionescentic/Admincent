"use client";
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Search,
  Users,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatCOP } from "@/lib/nomina/payment";
import {
  CANAL_LABEL,
  type CanalGestion,
  type VentaEnriquecida,
} from "@/lib/cartera/types";
import {
  construirSemanaInfo,
  fechaHoyBogota,
  obtenerTareasCobro,
  type TareaCobro,
} from "@/lib/cartera/tareas";
import GestionesModal from "./GestionesModal";
import AbonosModal from "./AbonosModal";
import VentaModal from "./VentaModal";

type TabTipo = "semana" | "hoy" | "vencidas" | "lista";

const CANAL_ICON: Record<CanalGestion, typeof Phone> = {
  llamada: Phone,
  whatsapp: MessageSquare,
  correo: Mail,
  presencial: Users,
  otro: CalendarClock,
};

export default function TareasSemanaModal({
  ventas,
  onClose,
  onChanged,
  initialTab = "semana",
}: {
  ventas: VentaEnriquecida[];
  onClose: () => void;
  onChanged: () => void;
  initialTab?: TabTipo;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [tab, setTab] = useState<TabTipo>(initialTab);
  const [busqueda, setBusqueda] = useState("");
  const [vendedorFiltro, setVendedorFiltro] = useState("");

  // Sub-modales para acciones directas sobre una tarea
  const [gestionVenta, setGestionVenta] = useState<VentaEnriquecida | null>(null);
  const [abonoVenta, setAbonoVenta] = useState<VentaEnriquecida | null>(null);
  const [editarVenta, setEditarVenta] = useState<VentaEnriquecida | null>(null);

  const hoyIso = fechaHoyBogota();

  // 1. Obtener todas las tareas de cobranza a partir de las ventas con saldo
  const todasLasTareas = useMemo(
    () => obtenerTareasCobro(ventas, hoyIso),
    [ventas, hoyIso],
  );

  // 2. Construir la información de la semana según el offset actual
  const semana = useMemo(
    () => construirSemanaInfo(todasLasTareas, hoyIso, weekOffset),
    [todasLasTareas, hoyIso, weekOffset],
  );

  // 3. Vendedores únicos para el selector de filtro
  const vendedores = useMemo(() => {
    const set = new Set<string>();
    for (const t of todasLasTareas) {
      if (t.venta.vendedorNorm) set.add(t.venta.vendedorNorm);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [todasLasTareas]);

  // 4. Filtrar tareas por búsqueda y vendedor
  const filtrarTarea = useCallback(
    (t: TareaCobro) => {
      if (vendedorFiltro && t.venta.vendedorNorm !== vendedorFiltro) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const match =
          t.venta.cliente.toLowerCase().includes(q) ||
          (t.venta.servicio && t.venta.servicio.toLowerCase().includes(q)) ||
          (t.venta.vendedorNorm && t.venta.vendedorNorm.toLowerCase().includes(q)) ||
          t.detalle.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    },
    [busqueda, vendedorFiltro],
  );

  // Listas filtradas para cada sección
  const tareasHoy = useMemo(
    () => todasLasTareas.filter((t) => t.esHoy && filtrarTarea(t)),
    [todasLasTareas, filtrarTarea],
  );

  const tareasVencidas = useMemo(
    () => todasLasTareas.filter((t) => t.esVencida && filtrarTarea(t)),
    [todasLasTareas, filtrarTarea],
  );

  const tareasSemanaFiltradas = useMemo(
    () => semana.todasLasTareas.filter(filtrarTarea),
    [semana.todasLasTareas, filtrarTarea],
  );

  const totalMontoHoy = tareasHoy.reduce((acc, t) => acc + t.venta.saldo, 0);
  const totalMontoVencidas = tareasVencidas.reduce((acc, t) => acc + t.venta.saldo, 0);
  const totalMontoSemana = tareasSemanaFiltradas.reduce((acc, t) => acc + t.venta.saldo, 0);

  const hayFiltrosActivos = Boolean(busqueda.trim() || vendedorFiltro);

  return (
    <>
      <Modal open onClose={onClose} size="2xl" zIndex={50}>
        <div className="space-y-6">
          {/* Header principal */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <h2 className="text-2xl font-bold tracking-tight">
                  Tareas y Cobros de la Semana
                </h2>
              </div>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Seguimiento de cobros programados para hoy, compromisos acordados y agenda semanal
              </p>
            </div>

            {/* Navegador de Semanas */}
            <div className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
              <button
                type="button"
                onClick={() => setWeekOffset((o) => o - 1)}
                className="rounded-lg p-1.5 text-neutral-300 transition hover:bg-[var(--color-surface)] hover:text-white"
                title="Semana anterior"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <span className="px-3 text-xs font-medium text-neutral-200">
                {semana.label}
              </span>

              {weekOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="rounded-lg bg-[var(--color-accent)]/20 px-2 py-1 text-xs font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)]/30"
                >
                  Hoy
                </button>
              )}

              <button
                type="button"
                onClick={() => setWeekOffset((o) => o + 1)}
                className="rounded-lg p-1.5 text-neutral-300 transition hover:bg-[var(--color-surface)] hover:text-white"
                title="Semana siguiente"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tarjetas KPI de resumen */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* KPI Hoy */}
            <div
              onClick={() => setTab("hoy")}
              className={`cursor-pointer rounded-xl border p-3.5 transition ${
                tab === "hoy"
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]"
                  : tareasHoy.length > 0
                    ? "border-amber-500/40 bg-amber-950/20 hover:border-amber-500/70"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-neutral-500"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                  <Bell className="h-3.5 w-3.5" /> Cobros Para Hoy
                </span>
                {tareasHoy.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
                    {tareasHoy.length}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xl font-bold text-white">
                {formatCOP(totalMontoHoy)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                {tareasHoy.length === 0
                  ? "Sin cobros para hoy"
                  : `${tareasHoy.length} ${tareasHoy.length === 1 ? "cobro programado" : "cobros programados"}`}
              </p>
            </div>

            {/* KPI Esta Semana */}
            <div
              onClick={() => setTab("semana")}
              className={`cursor-pointer rounded-xl border p-3.5 transition ${
                tab === "semana"
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-neutral-500"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-400">
                  <Calendar className="h-3.5 w-3.5" /> En Esta Semana
                </span>
                <span className="inline-flex items-center rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-bold text-sky-300">
                  {tareasSemanaFiltradas.length}
                </span>
              </div>
              <p className="mt-2 text-xl font-bold text-white">
                {formatCOP(totalMontoSemana)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                {tareasSemanaFiltradas.length} tareas en la semana
              </p>
            </div>

            {/* KPI Vencidas */}
            <div
              onClick={() => setTab("vencidas")}
              className={`cursor-pointer rounded-xl border p-3.5 transition ${
                tab === "vencidas"
                  ? "border-red-500 bg-red-950/25 ring-1 ring-red-500"
                  : tareasVencidas.length > 0
                    ? "border-red-800/40 bg-red-950/15 hover:border-red-500/60"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-neutral-500"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> Vencidas / Atrasadas
                </span>
                {tareasVencidas.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300">
                    {tareasVencidas.length}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xl font-bold text-white">
                {formatCOP(totalMontoVencidas)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                {tareasVencidas.length === 0
                  ? "Sin gestiones atrasadas"
                  : `${tareasVencidas.length} cobros requieren atención`}
              </p>
            </div>
          </div>

          {/* Barra de Filtros y Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
              <button
                type="button"
                onClick={() => setTab("semana")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tab === "semana"
                    ? "bg-[var(--color-accent)] text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Vista Semanal (7 días)
              </button>
              <button
                type="button"
                onClick={() => setTab("hoy")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tab === "hoy"
                    ? "bg-[var(--color-accent)] text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <span>Solo Hoy</span>
                {tareasHoy.length > 0 && (
                  <span className="rounded-full bg-amber-400/30 px-1.5 py-0.2 text-[10px] font-bold text-amber-200">
                    {tareasHoy.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTab("vencidas")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tab === "vencidas"
                    ? "bg-[var(--color-accent)] text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <span>Vencidas</span>
                {tareasVencidas.length > 0 && (
                  <span className="rounded-full bg-red-400/30 px-1.5 py-0.2 text-[10px] font-bold text-red-200">
                    {tareasVencidas.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTab("lista")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tab === "lista"
                    ? "bg-[var(--color-accent)] text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Lista Completa
              </button>
            </div>

            {/* Buscador y Vendedor */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar cliente, servicio…"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {vendedores.length > 1 && (
                <select
                  value={vendedorFiltro}
                  onChange={(e) => setVendedorFiltro(e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="">Todos los vendedores</option>
                  {vendedores.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              )}

              {hayFiltrosActivos && (
                <button
                  type="button"
                  onClick={() => {
                    setBusqueda("");
                    setVendedorFiltro("");
                  }}
                  className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-neutral-400 transition hover:bg-[var(--color-surface-2)] hover:text-white"
                >
                  <X className="h-3 w-3" /> Limpiar
                </button>
              )}
            </div>
          </div>

          {/* CONTENIDO SEGÚN EL TAB ACTIVO */}

          {/* TAB 1: VISTA SEMANAL (7 DÍAS EN GRID) */}
          {tab === "semana" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {semana.dias.map((dia) => {
                  const tareasDia = dia.tareas.filter(filtrarTarea);
                  const montoDia = tareasDia.reduce((acc, t) => acc + t.venta.saldo, 0);

                  return (
                    <div
                      key={dia.fechaIso}
                      className={`flex flex-col rounded-xl border p-2.5 transition ${
                        dia.esHoy
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5 ring-1 ring-[var(--color-accent)]/50"
                          : "border-[var(--color-border)] bg-[var(--color-surface-2)]/60"
                      }`}
                    >
                      {/* Cabecera del día */}
                      <div className="border-b border-[var(--color-border)] pb-2">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold uppercase tracking-wider ${
                              dia.esHoy ? "text-[var(--color-accent)]" : "text-neutral-400"
                            }`}
                          >
                            {dia.diaNombre.slice(0, 3)}
                          </span>
                          {dia.esHoy && (
                            <span className="rounded bg-[var(--color-accent)] px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                              HOY
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm font-semibold text-white">
                          {dia.diaNumero} {dia.mesNombre}
                        </p>
                        {tareasDia.length > 0 ? (
                          <p className="text-[11px] font-medium text-emerald-400">
                            {formatCOP(montoDia)} ({tareasDia.length})
                          </p>
                        ) : (
                          <p className="text-[10px] text-[var(--color-muted)]">
                            0 cobros
                          </p>
                        )}
                      </div>

                      {/* Lista de tareas de ese día */}
                      <div className="mt-2.5 flex-1 space-y-2 overflow-y-auto max-h-[360px] pr-0.5">
                        {tareasDia.length === 0 ? (
                          <p className="py-4 text-center text-[11px] text-[var(--color-muted)]">
                            Sin cobros
                          </p>
                        ) : (
                          tareasDia.map((t) => (
                            <TareaCard
                              key={t.id}
                              tarea={t}
                              compact
                              onGestionar={() => setGestionVenta(t.venta)}
                              onAbonar={() => setAbonoVenta(t.venta)}
                              onEditar={() => setEditarVenta(t.venta)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SOLO HOY */}
          {tab === "hoy" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                    <Bell className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-white">
                      Cobros programados para hoy ({hoyIso})
                    </h3>
                    <p className="text-xs text-amber-300/80">
                      {tareasHoy.length} cliente(s) en espera de cobro o seguimiento
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase text-neutral-400">Total a recaudar</span>
                  <p className="text-lg font-bold text-amber-300">
                    {formatCOP(totalMontoHoy)}
                  </p>
                </div>
              </div>

              {tareasHoy.length === 0 ? (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-10 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
                  <p className="mt-3 text-base font-semibold text-white">
                    ¡No tienes cobros pendientes para hoy!
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Todos los cobros de la fecha están al día o no se registraron acciones para hoy.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {tareasHoy.map((t) => (
                    <TareaCard
                      key={t.id}
                      tarea={t}
                      onGestionar={() => setGestionVenta(t.venta)}
                      onAbonar={() => setAbonoVenta(t.venta)}
                      onEditar={() => setEditarVenta(t.venta)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VENCIDAS / ATRASADAS */}
          {tab === "vencidas" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-red-800/40 bg-red-950/20 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-300">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-white">
                      Cobros con fecha programada vencida
                    </h3>
                    <p className="text-xs text-red-300/80">
                      Clientes cuya próxima acción acordada o fecha de compromiso ya pasó y aún adeudan saldo.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase text-neutral-400">Saldo vencido</span>
                  <p className="text-lg font-bold text-red-400">
                    {formatCOP(totalMontoVencidas)}
                  </p>
                </div>
              </div>

              {tareasVencidas.length === 0 ? (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-10 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
                  <p className="mt-3 text-base font-semibold text-white">
                    ¡No hay gestiones vencidas!
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    No tienes clientes con fechas de cobro atrasadas pendientes.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {tareasVencidas.map((t) => (
                    <TareaCard
                      key={t.id}
                      tarea={t}
                      onGestionar={() => setGestionVenta(t.venta)}
                      onAbonar={() => setAbonoVenta(t.venta)}
                      onEditar={() => setEditarVenta(t.venta)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LISTA COMPLETA */}
          {tab === "lista" && (
            <div className="space-y-3">
              {tareasSemanaFiltradas.length === 0 ? (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-10 text-center">
                  <CalendarClock className="mx-auto h-10 w-10 text-neutral-400" />
                  <p className="mt-3 text-sm text-[var(--color-muted)]">
                    No hay tareas programadas para los filtros seleccionados.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {tareasSemanaFiltradas.map((t) => (
                    <TareaCard
                      key={t.id}
                      tarea={t}
                      onGestionar={() => setGestionVenta(t.venta)}
                      onAbonar={() => setAbonoVenta(t.venta)}
                      onEditar={() => setEditarVenta(t.venta)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Sub-modales interactivos directos */}
      {gestionVenta && (
        <GestionesModal
          key={gestionVenta.id}
          venta={gestionVenta}
          onClose={() => setGestionVenta(null)}
          onChanged={() => {
            onChanged();
            setGestionVenta(null);
          }}
        />
      )}

      {abonoVenta && (
        <AbonosModal
          key={abonoVenta.id}
          venta={abonoVenta}
          onClose={() => setAbonoVenta(null)}
          onChanged={() => {
            onChanged();
            setAbonoVenta(null);
          }}
        />
      )}

      {editarVenta && (
        <VentaModal
          key={editarVenta.id}
          venta={editarVenta}
          onClose={() => setEditarVenta(null)}
          onSaved={() => {
            onChanged();
            setEditarVenta(null);
          }}
        />
      )}
    </>
  );
}

/**
 * Tarjeta individual para mostrar un cobro programado con datos claros y botones de acción rápida.
 */
function TareaCard({
  tarea,
  compact = false,
  onGestionar,
  onAbonar,
  onEditar,
}: {
  tarea: TareaCobro;
  compact?: boolean;
  onGestionar: () => void;
  onAbonar: () => void;
  onEditar: () => void;
}) {
  const IconoCanal = tarea.canal ? CANAL_ICON[tarea.canal] ?? Phone : Phone;

  return (
    <div
      className={`group flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] ${
        compact ? "p-2.5 text-xs" : "p-3 text-sm"
      } text-left transition hover:border-[var(--color-accent)] hover:shadow-md ${
        tarea.esHoy
          ? "border-amber-500/40 bg-amber-950/10"
          : tarea.esVencida
            ? "border-red-900/40 bg-red-950/10"
            : ""
      }`}
    >
      <div>
        {/* Cabecera: Cliente y Saldo */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4
              className="truncate font-semibold text-white hover:text-[var(--color-accent)] cursor-pointer"
              onClick={onEditar}
              title={tarea.venta.cliente}
            >
              {tarea.venta.cliente}
            </h4>
            <p className="truncate text-[11px] text-[var(--color-muted)]">
              {tarea.venta.servicio ?? "Sin servicio"} · {tarea.venta.vendedorNorm}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400 tabular-nums">
            {formatCOP(tarea.venta.saldo)}
          </span>
        </div>

        {/* Detalle del compromiso o gestión */}
        <div className="mt-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-2 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-neutral-300">
            <IconoCanal className="h-3 w-3 shrink-0 text-[var(--color-accent)]" />
            <span className="truncate">
              {tarea.origen === "proxima_accion"
                ? `Próxima acción · ${tarea.canal ? CANAL_LABEL[tarea.canal] : "Llamada"}`
                : "Compromiso de pago"}
            </span>
          </div>

          <p className="mt-1 line-clamp-2 text-[11px] text-neutral-400">
            {tarea.detalle || "Sin nota registrada"}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px] text-[var(--color-muted)]">
            <span className="flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {tarea.fecha}
            </span>
            {tarea.esVencida ? (
              <span className="font-semibold text-red-400">
                {Math.abs(tarea.diasDiferencia)} d atrasado
              </span>
            ) : tarea.esHoy ? (
              <span className="font-semibold text-amber-400">Para hoy</span>
            ) : (
              <span>en {tarea.diasDiferencia} días</span>
            )}
          </div>
        </div>
      </div>

      {/* Botones de acción directa */}
      <div className="mt-3 flex items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={onGestionar}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[var(--color-accent)] px-2 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--color-accent-hover)]"
          title="Registrar llamada o gestión de cobro"
        >
          <Phone className="h-3 w-3" />
          <span>Gestionar</span>
        </button>

        <button
          type="button"
          onClick={onAbonar}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-emerald-950/40 hover:text-emerald-300 hover:border-emerald-700/50"
          title="Registrar pago recibido"
        >
          <DollarSign className="h-3 w-3" />
          <span>Abonar</span>
        </button>

        <button
          type="button"
          onClick={onEditar}
          className="rounded-lg border border-[var(--color-border)] p-1.5 text-neutral-400 transition hover:bg-[var(--color-surface-2)] hover:text-white"
          title="Ver ficha completa de la venta"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
