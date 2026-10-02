"use client";
import { useCallback, useEffect, useState } from "react";
import { NumericFormat } from "react-number-format";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import CatalogoSelect from "./CatalogoSelect";
import { derivarEstadoCartera } from "@/lib/cartera/normalize";
import { ESTADOS_CARTERA } from "@/lib/cartera/types";
import type {
  CarteraComercial,
  CarteraServicio,
  VentaEnriquecida,
} from "@/lib/cartera/types";

type Form = {
  cliente: string;
  fecha_contacto: string;
  vendedor: string;
  servicio: string;
  modalidad: string;
  nota_gestion: string;
  valor_mora: string;
  total_pagar: string;
  compromiso_pago: string;
  meses_mora: string;
  estado_cobro: string;
  estado_cartera: string;
  notas: string;
};

const VACIO: Form = {
  cliente: "",
  fecha_contacto: "",
  vendedor: "",
  servicio: "",
  modalidad: "",
  nota_gestion: "",
  valor_mora: "",
  total_pagar: "",
  compromiso_pago: "",
  meses_mora: "",
  estado_cobro: "",
  estado_cartera: "",
  notas: "",
};

const desdeVenta = (v: VentaEnriquecida): Form => ({
  cliente: v.cliente,
  fecha_contacto: v.fecha_contacto ?? "",
  vendedor: v.vendedor ?? "",
  servicio: v.servicio ?? "",
  modalidad: v.modalidad ?? "",
  nota_gestion: v.nota_gestion ?? "",
  valor_mora: v.valor_mora == null ? "" : String(v.valor_mora),
  total_pagar: String(v.totalPagar),
  compromiso_pago: v.compromiso_pago ?? "",
  meses_mora: v.meses_mora == null ? "" : String(v.meses_mora),
  estado_cobro: v.estado_cobro ?? "",
  estado_cartera: v.estado_cartera ?? "",
  notas: v.notas ?? "",
});

/**
 * El padre monta este componente sólo mientras el modal está abierto y le pasa
 * una `key` distinta por registro, así el formulario arranca ya inicializado en
 * vez de sincronizarse con un efecto.
 */
export default function VentaModal({
  venta,
  onClose,
  onSaved,
}: {
  /** null = crear un registro nuevo. */
  venta: VentaEnriquecida | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Form>(() => (venta ? desdeVenta(venta) : VACIO));
  const [loading, setLoading] = useState(false);
  const [catalogos, setCatalogos] = useState<{
    comerciales: CarteraComercial[];
    servicios: CarteraServicio[];
  } | null>(null);

  const cargarCatalogos = useCallback(() => {
    fetch("/api/cartera/catalogos")
      .then((r) => r.json())
      .then((d) => {
        if (d?.comerciales) setCatalogos(d);
      })
      .catch(() => toast.error("No se pudieron cargar los catálogos"));
  }, []);

  useEffect(cargarCatalogos, [cargarCatalogos]);

  // Sólo los activos entran al desplegable; los inactivos siguen visibles en los
  // registros que ya los usaban, vía la opción "fuera del catálogo".
  const comerciales = (catalogos?.comerciales ?? [])
    .filter((c) => c.activo)
    .map((c) => c.nombre);
  const servicios = (catalogos?.servicios ?? []).filter((s) => s.activo).map((s) => s.nombre);
  const catalogoVacio =
    catalogos != null && comerciales.length === 0 && servicios.length === 0;

  const set = <K extends keyof Form>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Vista previa del estado que se calcularía si no se fija uno a mano.
  const estadoDerivado = derivarEstadoCartera({
    modalidad: form.modalidad,
    nota_gestion: form.nota_gestion,
    estado_cobro: form.estado_cobro,
    compromiso_pago: form.compromiso_pago,
  });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }

    setLoading(true);
    try {
      const url = venta ? `/api/cartera/ventas/${venta.id}` : "/api/cartera/ventas";
      const res = await fetch(url, {
        method: venta ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, total_pagar: form.total_pagar || 0 }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "No se pudo guardar");
        return;
      }

      toast.success(venta ? "Registro actualizado" : "Registro creado");
      onSaved();
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function eliminar() {
    if (!venta) return;
    if (
      !confirm(
        `¿Eliminar el registro de ${venta.cliente}? También se borrarán sus abonos y gestiones.`,
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/cartera/ventas/${venta.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "No se pudo eliminar");
        return;
      }
      toast.success("Registro eliminado");
      onSaved();
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={venta ? "Editar registro" : "Nuevo registro de cartera"}
      size="lg"
      zIndex={60}
    >
      <form onSubmit={guardar} className="space-y-4">
        {catalogoVacio && (
          <p className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
            Los catálogos de comerciales y servicios están vacíos.{" "}
            <Link href="/cartera/catalogos" className="underline">
              Ábrelos para darlos de alta
            </Link>{" "}
            y así los desplegables dejan de estar en blanco.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Cliente" requerido className="sm:col-span-2">
            <input
              type="text"
              value={form.cliente}
              onChange={(e) => set("cliente", e.target.value)}
              required
              className={INPUT}
            />
          </Campo>

          <Campo label="Comercial">
            <CatalogoSelect
              value={form.vendedor}
              opciones={comerciales}
              onChange={(v) => set("vendedor", v)}
              className={INPUT}
            />
          </Campo>

          <Campo label="Fecha de contacto">
            <input
              type="date"
              value={form.fecha_contacto}
              onChange={(e) => set("fecha_contacto", e.target.value)}
              className={INPUT}
            />
          </Campo>

          <Campo label="Servicio o curso">
            <CatalogoSelect
              value={form.servicio}
              opciones={servicios}
              onChange={(v) => set("servicio", v)}
              className={INPUT}
            />
          </Campo>

          <Campo label="Modalidad">
            <input
              type="text"
              value={form.modalidad}
              onChange={(e) => set("modalidad", e.target.value)}
              placeholder="Curso y examen"
              className={INPUT}
            />
          </Campo>

          <Campo label="Total a pagar" requerido>
            <NumericFormat
              value={form.total_pagar}
              onValueChange={(v) => set("total_pagar", v.value)}
              thousandSeparator="."
              decimalSeparator=","
              prefix="$ "
              allowNegative={false}
              decimalScale={0}
              className={INPUT}
            />
          </Campo>

          <Campo label="Valor interés de mora">
            <NumericFormat
              value={form.valor_mora}
              onValueChange={(v) => set("valor_mora", v.value)}
              thousandSeparator="."
              decimalSeparator=","
              prefix="$ "
              allowNegative={false}
              decimalScale={0}
              className={INPUT}
            />
          </Campo>

          <Campo label="Meses en mora">
            <input
              type="number"
              min={0}
              value={form.meses_mora}
              onChange={(e) => set("meses_mora", e.target.value)}
              className={INPUT}
            />
          </Campo>

          <Campo label="Estado de cobro" ayuda="Texto libre: PAGO AL DIA, Pendiente, QUIETO…">
            <input
              type="text"
              value={form.estado_cobro}
              onChange={(e) => set("estado_cobro", e.target.value)}
              className={INPUT}
            />
          </Campo>

          <Campo
            label="Nota de gestión"
            ayuda="COMPROMISO DE PAGO, PROCESO, llamar…"
            className="sm:col-span-2"
          >
            <input
              type="text"
              value={form.nota_gestion}
              onChange={(e) => set("nota_gestion", e.target.value)}
              className={INPUT}
            />
          </Campo>

          <Campo label="Compromiso de pago" className="sm:col-span-2">
            <input
              type="text"
              value={form.compromiso_pago}
              onChange={(e) => set("compromiso_pago", e.target.value)}
              placeholder="ABONO 15 JUN"
              className={INPUT}
            />
          </Campo>

          <Campo
            label="Estado de cartera"
            ayuda={`Automático: ${estadoDerivado}`}
            className="sm:col-span-2"
          >
            <select
              value={form.estado_cartera}
              onChange={(e) => set("estado_cartera", e.target.value)}
              className={INPUT}
            >
              <option value="">Automático ({estadoDerivado})</option>
              {ESTADOS_CARTERA.map((e) => (
                <option key={e} value={e}>
                  Fijar en: {e}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Notas internas" className="sm:col-span-2">
            <textarea
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
              rows={3}
              className={`${INPUT} resize-y`}
            />
          </Campo>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          {venta && (
            <button
              type="button"
              onClick={eliminar}
              disabled={loading}
              className="mr-auto rounded-lg border border-red-700/40 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-900/40 disabled:opacity-50"
            >
              Eliminar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-2)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {loading ? "Guardando…" : venta ? "Guardar cambios" : "Crear registro"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const INPUT =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

function Campo({
  label,
  ayuda,
  requerido,
  className = "",
  children,
}: {
  label: string;
  ayuda?: string;
  requerido?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-[var(--color-muted)]">
        {label}
        {requerido && <span className="ml-1 text-[var(--color-accent)]">*</span>}
      </span>
      {children}
      {ayuda && <span className="text-[11px] text-[var(--color-muted)]">{ayuda}</span>}
    </label>
  );
}
