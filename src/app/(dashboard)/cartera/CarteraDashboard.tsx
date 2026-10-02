"use client";
import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Crown,
  Download,
  ListFilter,
  Phone,
  TableProperties,
  X,
} from "lucide-react";
import { formatCOP } from "@/lib/nomina/payment";
import {
  COLOR_ESTADO,
  aplicarFiltros,
  calcularKpis,
  gestionesVencidas,
  opcionesFiltro,
  porCategoria,
  porEstado,
  porRangoMora,
  porVendedor,
  topSaldos,
  type Filtros,
} from "@/lib/cartera/aggregate";
import type { VentaEnriquecida } from "@/lib/cartera/types";
import { BarList, Donut, ProgressBar } from "@/components/cartera/Charts";
import { Card, EmptyState, EstadoBadge, StatCard } from "@/components/cartera/ui";
import TareasSemanaModal from "@/components/cartera/TareasSemanaModal";
import NotificacionCobrosHoy from "@/components/cartera/NotificacionCobrosHoy";
import {
  construirSemanaInfo,
  fechaHoyBogota,
  obtenerTareasCobro,
} from "@/lib/cartera/tareas";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function CarteraDashboard({ ventas }: { ventas: VentaEnriquecida[] }) {
  const [ventasOverride, setVentasOverride] = useState<VentaEnriquecida[] | null>(null);
  const ventasState = ventasOverride ?? ventas;
  const [filtros, setFiltros] = useState<Filtros>({});
  const [tareasModalOpen, setTareasModalOpen] = useState(false);
  const [tareasInitialTab, setTareasInitialTab] = useState<"semana" | "hoy" | "vencidas">("semana");

  const refrescar = useCallback(() => {
    fetch("/api/cartera/ventas")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setVentasOverride(d);
      })
      .catch(() => {});
  }, []);

  const hoyIso = fechaHoyBogota();
  const todasLasTareas = useMemo(
    () => obtenerTareasCobro(ventasState, hoyIso),
    [ventasState, hoyIso],
  );
  const tareasHoy = useMemo(
    () => todasLasTareas.filter((t) => t.esHoy),
    [todasLasTareas],
  );
  const tareasVencidas = useMemo(
    () => todasLasTareas.filter((t) => t.esVencida),
    [todasLasTareas],
  );
  const semanaInfo = useMemo(
    () => construirSemanaInfo(todasLasTareas, hoyIso, 0),
    [todasLasTareas, hoyIso],
  );

  const opciones = useMemo(() => opcionesFiltro(ventasState), [ventasState]);
  const filtradas = useMemo(() => aplicarFiltros(ventasState, filtros), [ventasState, filtros]);

  const kpis = useMemo(() => calcularKpis(filtradas), [filtradas]);
  const estados = useMemo(() => porEstado(filtradas), [filtradas]);
  const vendedores = useMemo(() => porVendedor(filtradas), [filtradas]);
  const categorias = useMemo(() => porCategoria(filtradas), [filtradas]);
  const rangos = useMemo(() => porRangoMora(filtradas), [filtradas]);
  const top10 = useMemo(() => topSaldos(filtradas), [filtradas]);
  const vencidas = useMemo(() => gestionesVencidas(filtradas), [filtradas]);

  const activos = Object.entries(filtros).filter(([, v]) => v);

  /** Alterna un filtro: volver a hacer clic en la misma barra lo quita. */
  const alternar = (clave: keyof Filtros, valor: string) =>
    setFiltros((f) => ({ ...f, [clave]: f[clave] === valor ? undefined : valor }));

  const exportUrl = (() => {
    const p = new URLSearchParams();
    if (filtros.vendedor) p.set("vendedor", filtros.vendedor);
    if (filtros.estado) p.set("estado", filtros.estado);
    if (filtros.categoria) p.set("categoria", filtros.categoria);
    if (filtros.rango) p.set("rango", filtros.rango);
    if (filtros.busqueda) p.set("q", filtros.busqueda);
    const qs = p.toString();
    return `/api/cartera/export${qs ? `?${qs}` : ""}`;
  })();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard de cobranzas</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Control de cartera por cobrar · Cursos y certificaciones
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Botón interactivo de Tareas de la semana con badge dinámico */}
          <button
            type="button"
            onClick={() => {
              setTareasInitialTab(tareasHoy.length > 0 ? "hoy" : "semana");
              setTareasModalOpen(true);
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              tareasHoy.length > 0
                ? "bg-amber-500 text-black hover:bg-amber-400 font-semibold shadow-lg shadow-amber-500/20"
                : "border border-[var(--color-border)] bg-[var(--color-surface-2)] text-white hover:border-neutral-500"
            }`}
          >
            {tareasHoy.length > 0 ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-600 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600"></span>
              </span>
            ) : (
              <CalendarDays className="h-4 w-4 text-[var(--color-accent)]" />
            )}
            <span>Tareas de la semana</span>
            {tareasHoy.length > 0 ? (
              <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs font-extrabold text-black">
                {tareasHoy.length} hoy
              </span>
            ) : semanaInfo.todasLasTareas.length > 0 ? (
              <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs text-neutral-300">
                {semanaInfo.todasLasTareas.length} esta sem.
              </span>
            ) : null}
          </button>

          <a
            href={exportUrl}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-2)]"
          >
            <Download className="h-4 w-4" /> Exportar
          </a>
          <Link
            href="/cartera/registros"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)]"
          >
            <TableProperties className="h-4 w-4" /> Gestionar registros
          </Link>
        </div>
      </header>

      {/* Banner / Notificación interactiva de cobros de hoy */}
      <NotificacionCobrosHoy
        ventas={ventasState}
        onOpenTareas={(tab = "hoy") => {
          setTareasInitialTab(tab);
          setTareasModalOpen(true);
        }}
      />

      {/* Filtros */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="text-xs text-[var(--color-muted)]">Buscar</span>
            <input
              type="text"
              value={filtros.busqueda ?? ""}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, busqueda: e.target.value || undefined }))
              }
              placeholder="Cliente, servicio, compromiso…"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </label>

          <Select
            label="Vendedor"
            value={filtros.vendedor}
            opciones={opciones.vendedores}
            onChange={(v) => setFiltros((f) => ({ ...f, vendedor: v }))}
          />
          <Select
            label="Estado"
            value={filtros.estado}
            opciones={opciones.estados}
            onChange={(v) => setFiltros((f) => ({ ...f, estado: v }))}
          />
          <Select
            label="Categoría"
            value={filtros.categoria}
            opciones={opciones.categorias}
            onChange={(v) => setFiltros((f) => ({ ...f, categoria: v }))}
          />
          <Select
            label="Antigüedad"
            value={filtros.rango}
            opciones={opciones.rangos}
            onChange={(v) => setFiltros((f) => ({ ...f, rango: v }))}
          />

          {activos.length > 0 && (
            <button
              type="button"
              onClick={() => setFiltros({})}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-white"
            >
              <X className="h-4 w-4" /> Limpiar
            </button>
          )}
        </div>

        {activos.length > 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <ListFilter className="h-3.5 w-3.5" />
            Mostrando {filtradas.length} de {ventas.length} registros
          </p>
        )}
      </div>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Cartera total pendiente"
          value={formatCOP(kpis.carteraTotal)}
          hint={`de ${formatCOP(kpis.totalFacturado)} facturados`}
          accent
        />
        <StatCard
          label="Registros con saldo"
          value={kpis.registrosConSaldo}
          hint={`${filtradas.length} registros en total`}
        />
        <StatCard label="Saldo promedio" value={formatCOP(kpis.saldoPromedio)} />
        <StatCard
          label='Cartera "al día"'
          value={pct(kpis.pctAlDia)}
          hint="sobre registros con saldo"
        />
        <StatCard
          label="Cartera en gestión / riesgo"
          value={pct(kpis.pctEnRiesgo)}
          hint="todo lo que no está al día"
        />
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Recaudado (abonos)
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatCOP(kpis.totalRecaudado)}
          </p>
          <div className="mt-3">
            <ProgressBar valor={kpis.pctRecaudo} />
            <p className="mt-1.5 text-xs text-[var(--color-muted)]">
              {pct(kpis.pctRecaudo)} de lo facturado
            </p>
          </div>
        </div>
      </section>

      {/* Mayor saldo */}
      {kpis.mayorSaldo && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 px-5 py-4 text-sm">
          <Crown className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
          <span className="text-[var(--color-muted)]">Mayor saldo individual:</span>
          <span className="font-medium">{kpis.mayorSaldo.cliente}</span>
          <span className="tabular-nums font-semibold text-[var(--color-accent)]">
            {formatCOP(kpis.mayorSaldo.saldo)}
          </span>
          <span className="text-[var(--color-muted)]">
            · Vendedor: {kpis.mayorSaldo.vendedorNorm}
          </span>
        </div>
      )}

      {/* Próximas acciones vencidas / Agenda rápida */}
      {(tareasHoy.length > 0 || vencidas.length > 0 || semanaInfo.todasLasTareas.length > 0) && (
        <Card
          title={
            tareasHoy.length > 0
              ? `${tareasHoy.length} ${tareasHoy.length === 1 ? "cobro para hoy" : "cobros para hoy"}`
              : `${semanaInfo.todasLasTareas.length} cobros en la agenda semanal`
          }
          subtitle="Cobros programados con fecha acordada para hoy o próximas acciones"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2 text-xs">
              <span className="text-[var(--color-muted)]">
                {tareasHoy.length > 0
                  ? `Hoy vence la fecha para realizar ${tareasHoy.length} cobro(s)`
                  : `Total en la semana: ${semanaInfo.todasLasTareas.length} cobros programados`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setTareasInitialTab(tareasHoy.length > 0 ? "hoy" : "semana");
                  setTareasModalOpen(true);
                }}
                className="inline-flex items-center gap-1 font-medium text-[var(--color-accent)] hover:underline"
              >
                <span>Ver agenda de la semana completa</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <ul className="divide-y divide-[var(--color-border)] text-sm">
              {(tareasHoy.length > 0 ? tareasHoy : todasLasTareas.slice(0, 5)).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{t.venta.cliente}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {t.venta.servicio ?? "Curso"} · {t.venta.vendedorNorm}
                      {t.detalle ? ` · ${t.detalle}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-neutral-400">
                      {t.esHoy ? (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">
                          Hoy
                        </span>
                      ) : t.esVencida ? (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-300">
                          Vencida ({t.fecha})
                        </span>
                      ) : (
                        <span>{t.fecha}</span>
                      )}
                    </span>
                    <span className="tabular-nums font-bold text-emerald-400">
                      {formatCOP(t.venta.saldo)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTareasInitialTab(t.esHoy ? "hoy" : t.esVencida ? "vencidas" : "semana");
                        setTareasModalOpen(true);
                      }}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-xs text-neutral-300 hover:text-white"
                    >
                      Gestionar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* ① y ② */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="① Cartera por estado de gestión"
          subtitle="Clic en un estado para filtrar el dashboard"
        >
          <Donut
            grupos={estados}
            colores={COLOR_ESTADO}
            centroLabel="pendiente"
            centroValor={formatCOP(kpis.carteraTotal)}
          />
          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <BarList
              grupos={estados}
              colores={COLOR_ESTADO}
              onSelect={(e) => alternar("estado", e)}
              seleccion={filtros.estado}
            />
          </div>
        </Card>

        <Card title="② Cartera por vendedor" subtitle="Clic para filtrar">
          <BarList
            grupos={vendedores}
            onSelect={(v) => alternar("vendedor", v)}
            seleccion={filtros.vendedor}
          />
        </Card>
      </div>

      {/* ③ y ④ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="③ Cartera por categoría de servicio" subtitle="Clic para filtrar">
          <BarList
            grupos={categorias}
            onSelect={(c) => alternar("categoria", c)}
            seleccion={filtros.categoria}
          />
        </Card>

        <Card title="④ Antigüedad de mora" subtitle="Según la columna «meses en mora»">
          <BarList
            grupos={rangos}
            onSelect={(r) => alternar("rango", r)}
            seleccion={filtros.rango}
          />
        </Card>
      </div>

      {/* ⑤ */}
      <Card title="⑤ Top 10 registros con mayor saldo pendiente">
        {top10.length === 0 ? (
          <EmptyState>Sin registros con saldo.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <th className="px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Cliente</th>
                  <th className="px-3 py-2.5 text-right font-medium">Saldo</th>
                  <th className="px-3 py-2.5 font-medium">Vendedor</th>
                  <th className="px-3 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((v, i) => (
                  <tr
                    key={v.id}
                    className="border-b border-[var(--color-border)] last:border-b-0 transition hover:bg-[var(--color-surface-2)]/40"
                  >
                    <td className="px-3 py-2.5 tabular-nums text-[var(--color-muted)]">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium">{v.cliente}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCOP(v.saldo)}</td>
                    <td className="px-3 py-2.5 text-[var(--color-muted)]">{v.vendedorNorm}</td>
                    <td className="px-3 py-2.5">
                      <EstadoBadge estado={v.estadoCarteraNorm} manual={v.estadoManual} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Notas metodológicas">
        <ul className="space-y-2 text-xs leading-relaxed text-[var(--color-muted)]">
          <li>
            • La <strong>cartera pendiente</strong> es el total a pagar menos los abonos
            registrados. Sin abonos, coincide con el «Total a pagar» del archivo original.
          </li>
          <li>
            • El <strong>estado de cartera</strong> se deriva por palabras clave (AL DIA,
            PENDIENTE, COMPROMISO, PROCESO, LLAMAR, QUIETO, ESPERANDO, ABONO) sobre las notas de
            gestión, el estado de cobro y el compromiso de pago. Se puede fijar a mano en cada
            registro; cuando está fijado, el badge lleva un punto al final.
          </li>
          <li>
            • A diferencia del Excel, las palabras clave también se buscan en la columna
            «% interés de mora», que es donde realmente se escribe la gestión. Por eso hay menos
            registros en «Sin gestionar».
          </li>
          <li>
            • La <strong>antigüedad de mora</strong> usa la columna «meses en mora», que en el
            archivo original sólo tiene dato numérico en unos pocos registros; el resto queda en
            «Sin dato registrado».
          </li>
          <li>
            • El <strong>Top 10</strong> es por registro individual: un mismo cliente puede
            aparecer más de una vez si tomó varios cursos.
          </li>
        </ul>
      </Card>

      {tareasModalOpen && (
        <TareasSemanaModal
          ventas={ventasState}
          initialTab={tareasInitialTab}
          onClose={() => setTareasModalOpen(false)}
          onChanged={refrescar}
        />
      )}
    </div>
  );
}

function Select({
  label,
  value,
  opciones,
  onChange,
}: {
  label: string;
  value?: string;
  opciones: readonly string[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      >
        <option value="">Todos</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
