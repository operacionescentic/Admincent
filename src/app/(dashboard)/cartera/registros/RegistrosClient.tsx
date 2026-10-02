"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  CalendarDays,
  CirclePlus,
  Download,
  History,
  Pencil,
  Plus,
  Upload,
} from "lucide-react";
import { formatCOP } from "@/lib/nomina/payment";
import { aplicarFiltros, opcionesFiltro, type Filtros } from "@/lib/cartera/aggregate";
import type { VentaEnriquecida } from "@/lib/cartera/types";
import { EstadoBadge } from "@/components/cartera/ui";
import VentaModal from "@/components/cartera/VentaModal";
import AbonosModal from "@/components/cartera/AbonosModal";
import GestionesModal from "@/components/cartera/GestionesModal";
import TareasSemanaModal from "@/components/cartera/TareasSemanaModal";
import NotificacionCobrosHoy from "@/components/cartera/NotificacionCobrosHoy";
import {
  construirSemanaInfo,
  fechaHoyBogota,
  obtenerTareasCobro,
} from "@/lib/cartera/tareas";

const PAGE_SIZE = 15;

type Orden = { campo: "cliente" | "saldo" | "vendedor" | "meses"; asc: boolean };

export default function RegistrosClient() {
  const [ventas, setVentas] = useState<VentaEnriquecida[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtros, setFiltros] = useState<Filtros>({});
  const [orden, setOrden] = useState<Orden>({ campo: "saldo", asc: false });
  const [pagina, setPagina] = useState(1);

  const [editar, setEditar] = useState<VentaEnriquecida | null>(null);
  const [creando, setCreando] = useState(false);
  const [abonosDe, setAbonosDe] = useState<VentaEnriquecida | null>(null);
  const [gestionesDe, setGestionesDe] = useState<VentaEnriquecida | null>(null);

  const [tareasModalOpen, setTareasModalOpen] = useState(false);
  const [tareasInitialTab, setTareasInitialTab] = useState<"semana" | "hoy" | "vencidas">("semana");

  const hoyIso = fechaHoyBogota();
  const todasLasTareas = useMemo(() => obtenerTareasCobro(ventas, hoyIso), [ventas, hoyIso]);
  const tareasHoy = useMemo(() => todasLasTareas.filter((t) => t.esHoy), [todasLasTareas]);
  const semanaInfo = useMemo(() => construirSemanaInfo(todasLasTareas, hoyIso, 0), [todasLasTareas, hoyIso]);

  const cargar = useCallback(() => {
    fetch("/api/cartera/ventas")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setVentas(d);
        else toast.error(d?.error ?? "No se pudo cargar la cartera");
      })
      .catch(() => toast.error("Error de red"))
      .finally(() => setCargando(false));
  }, []);

  useEffect(cargar, [cargar]);

  const opciones = useMemo(() => opcionesFiltro(ventas), [ventas]);

  const filtradas = useMemo(() => {
    const base = aplicarFiltros(ventas, filtros);
    const dir = orden.asc ? 1 : -1;
    return [...base].sort((a, b) => {
      switch (orden.campo) {
        case "cliente":
          return a.cliente.localeCompare(b.cliente, "es") * dir;
        case "vendedor":
          return a.vendedorNorm.localeCompare(b.vendedorNorm, "es") * dir;
        case "meses":
          return ((a.meses_mora ?? -1) - (b.meses_mora ?? -1)) * dir;
        default:
          return (a.saldo - b.saldo) * dir;
      }
    });
  }, [ventas, filtros, orden]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

  const totales = useMemo(
    () => ({
      total: filtradas.reduce((a, v) => a + v.totalPagar, 0),
      abonado: filtradas.reduce((a, v) => a + v.abonado, 0),
      saldo: filtradas.reduce((a, v) => a + v.saldo, 0),
    }),
    [filtradas],
  );

  const ordenarPor = (campo: Orden["campo"]) => {
    setOrden((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true }));
    setPagina(1);
  };

  const cambiarFiltro = (parcial: Filtros) => {
    setFiltros((f) => ({ ...f, ...parcial }));
    setPagina(1);
  };

  // El modal de abonos recalcula su propio saldo con la lista que ya recarga;
  // aquí sólo hace falta refrescar la tabla de fondo.
  const refrescar = cargar;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/cartera"
            className="mb-1 inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)] transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al dashboard
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Registros de cartera</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {filtradas.length} de {ventas.length} registros · saldo {formatCOP(totales.saldo)}
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

          <Link
            href="/cartera/importar"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-2)]"
          >
            <Upload className="h-4 w-4" /> Importar
          </Link>
          <a
            href="/api/cartera/export"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-2)]"
          >
            <Download className="h-4 w-4" /> Exportar
          </a>
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)]"
          >
            <Plus className="h-4 w-4" /> Nuevo registro
          </button>
        </div>
      </header>

      {/* Banner / Notificación interactiva de cobros de hoy */}
      <NotificacionCobrosHoy
        ventas={ventas}
        onOpenTareas={(tab = "hoy") => {
          setTareasInitialTab(tab);
          setTareasModalOpen(true);
        }}
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-xs text-[var(--color-muted)]">Buscar</span>
          <input
            type="text"
            value={filtros.busqueda ?? ""}
            onChange={(e) => cambiarFiltro({ busqueda: e.target.value || undefined })}
            placeholder="Cliente, servicio, compromiso…"
            className={INPUT}
          />
        </label>
        <Select
          label="Vendedor"
          value={filtros.vendedor}
          opciones={opciones.vendedores}
          onChange={(v) => cambiarFiltro({ vendedor: v })}
        />
        <Select
          label="Estado"
          value={filtros.estado}
          opciones={opciones.estados}
          onChange={(v) => cambiarFiltro({ estado: v })}
        />
        <Select
          label="Categoría"
          value={filtros.categoria}
          opciones={opciones.categorias}
          onChange={(v) => cambiarFiltro({ categoria: v })}
        />
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <Th onClick={() => ordenarPor("cliente")} activo={orden.campo === "cliente"} asc={orden.asc}>
                  Cliente
                </Th>
                <Th onClick={() => ordenarPor("vendedor")} activo={orden.campo === "vendedor"} asc={orden.asc}>
                  Vendedor
                </Th>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Abonado</th>
                <Th
                  onClick={() => ordenarPor("saldo")}
                  activo={orden.campo === "saldo"}
                  asc={orden.asc}
                  className="text-right"
                >
                  Saldo
                </Th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <Th onClick={() => ordenarPor("meses")} activo={orden.campo === "meses"} asc={orden.asc}>
                  Mora
                </Th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[var(--color-muted)]">
                    Cargando…
                  </td>
                </tr>
              ) : visibles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[var(--color-muted)]">
                    No hay registros que coincidan.
                  </td>
                </tr>
              ) : (
                visibles.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-[var(--color-border)] last:border-b-0 transition hover:bg-[var(--color-surface-2)]/40"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium">{v.cliente}</span>
                      {v.compromiso_pago && (
                        <span className="block truncate text-xs text-[var(--color-muted)]">
                          {v.compromiso_pago}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{v.vendedorNorm}</td>
                    <td className="px-4 py-3">
                      <span className="block truncate">{v.servicio ?? "—"}</span>
                      <span className="text-xs text-[var(--color-muted)]">
                        {v.categoriaServicio}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-muted)]">
                      {formatCOP(v.totalPagar)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-400">
                      {v.abonado > 0 ? formatCOP(v.abonado) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatCOP(v.saldo)}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={v.estadoCarteraNorm} manual={v.estadoManual} />
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {v.meses_mora == null ? "—" : `${v.meses_mora} m`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <IconBtn label="Editar" onClick={() => setEditar(v)}>
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn label="Abonos" onClick={() => setAbonosDe(v)}>
                          <CirclePlus className="h-4 w-4 text-emerald-400" />
                        </IconBtn>
                        <IconBtn label="Bitácora de gestión" onClick={() => setGestionesDe(v)}>
                          <History className="h-4 w-4 text-amber-400" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!cargando && filtradas.length > 0 && (
              <tfoot>
                <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm font-medium">
                  <td className="px-4 py-3" colSpan={3}>
                    Totales ({filtradas.length} registros)
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCOP(totales.total)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-400">
                    {formatCOP(totales.abonado)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCOP(totales.saldo)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-3 text-sm">
            <span className="text-[var(--color-muted)]">
              Página {paginaActual} de {totalPaginas}
            </span>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: totalPaginas }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPagina(i + 1)}
                  className={`min-w-8 rounded-md px-2 py-1 text-xs transition ${
                    paginaActual === i + 1
                      ? "bg-[var(--color-accent)] text-white"
                      : "border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {(creando || editar) && (
        <VentaModal
          key={editar?.id ?? "nuevo"}
          venta={editar}
          onClose={() => {
            setCreando(false);
            setEditar(null);
          }}
          onSaved={cargar}
        />
      )}
      {abonosDe && (
        <AbonosModal
          key={abonosDe.id}
          venta={abonosDe}
          onClose={() => setAbonosDe(null)}
          onChanged={refrescar}
        />
      )}
      {gestionesDe && (
        <GestionesModal
          key={gestionesDe.id}
          venta={gestionesDe}
          onClose={() => setGestionesDe(null)}
          onChanged={cargar}
        />
      )}
      {tareasModalOpen && (
        <TareasSemanaModal
          ventas={ventas}
          initialTab={tareasInitialTab}
          onClose={() => setTareasModalOpen(false)}
          onChanged={cargar}
        />
      )}
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

function Th({
  children,
  onClick,
  activo,
  asc,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  activo: boolean;
  asc: boolean;
  className?: string;
}) {
  return (
    <th className={`px-4 py-3 font-medium ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase transition hover:text-white ${
          activo ? "text-white" : ""
        }`}
      >
        {children}
        {activo && <span className="text-[10px]">{asc ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-md p-1.5 text-neutral-300 transition hover:bg-[var(--color-surface-2)] hover:text-white"
    >
      {children}
    </button>
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
        className={INPUT}
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
