"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { CalendarClock, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  CANALES_GESTION,
  CANAL_LABEL,
  RESULTADOS_GESTION,
  RESULTADO_LABEL,
} from "@/lib/cartera/types";
import type {
  CanalGestion,
  CarteraGestion,
  ResultadoGestion,
  VentaEnriquecida,
} from "@/lib/cartera/types";

const hoy = () => new Date().toISOString().slice(0, 10);

const COLOR_RESULTADO: Record<ResultadoGestion, string> = {
  contactado: "#3b82f6",
  sin_respuesta: "#a855f7",
  compromiso_pago: "#f59e0b",
  pago_parcial: "#14b8a6",
  pago_total: "#22c55e",
  renuente: "#f44336",
  otro: "#64748b",
};

/** Igual que AbonosModal: el padre lo monta con `key={venta.id}`. */
export default function GestionesModal({
  venta,
  onClose,
  onChanged,
}: {
  venta: VentaEnriquecida;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [gestiones, setGestiones] = useState<CarteraGestion[]>([]);
  const [fecha, setFecha] = useState(hoy);
  const [canal, setCanal] = useState<CanalGestion>("llamada");
  const [resultado, setResultado] = useState<ResultadoGestion>("contactado");
  const [proxima, setProxima] = useState("");
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(false);

  const ventaId = venta.id;

  const cargar = useCallback(() => {
    fetch(`/api/cartera/gestiones?ventaId=${ventaId}`)
      .then((r) => r.json())
      .then((d) => setGestiones(Array.isArray(d) ? d : []))
      .catch(() => toast.error("No se pudo cargar la bitácora"));
  }, [ventaId]);

  useEffect(cargar, [cargar]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    try {
      const res = await fetch("/api/cartera/gestiones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          venta_id: ventaId,
          fecha,
          canal,
          resultado,
          proxima_accion: proxima,
          nota,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "No se pudo registrar la gestión");
        return;
      }
      toast.success("Gestión registrada");
      setNota("");
      setProxima("");
      cargar();
      onChanged();
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar esta gestión?")) return;
    const res = await fetch(`/api/cartera/gestiones/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("No se pudo eliminar");
      return;
    }
    toast.success("Gestión eliminada");
    cargar();
    onChanged();
  }

  return (
    <Modal open onClose={onClose} title={`Bitácora de gestión · ${venta.cliente}`} size="lg" zIndex={60}>
      <form onSubmit={registrar} className="mb-5 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-muted)]">Fecha</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-muted)]">Canal</span>
            <select
              value={canal}
              onChange={(e) => setCanal(e.target.value as CanalGestion)}
              className={INPUT}
            >
              {CANALES_GESTION.map((c) => (
                <option key={c} value={c}>
                  {CANAL_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-muted)]">Resultado</span>
            <select
              value={resultado}
              onChange={(e) => setResultado(e.target.value as ResultadoGestion)}
              className={INPUT}
            >
              {RESULTADOS_GESTION.map((r) => (
                <option key={r} value={r}>
                  {RESULTADO_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-muted)]">Próxima acción</span>
            <input
              type="date"
              value={proxima}
              onChange={(e) => setProxima(e.target.value)}
              className={INPUT}
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-[var(--color-muted)]">Nota</span>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Qué dijo el cliente, qué se acordó…"
              className={INPUT}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            Registrar gestión
          </button>
        </div>
      </form>

      {gestiones.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--color-muted)]">
          Sin gestiones registradas todavía.
        </p>
      ) : (
        <ol className="space-y-3 border-l border-[var(--color-border)] pl-5">
          {gestiones.map((g) => {
            const color = COLOR_RESULTADO[g.resultado];
            return (
              <li key={g.id} className="relative">
                <span
                  className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--color-surface)]"
                  style={{ backgroundColor: color }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium" style={{ color }}>
                        {RESULTADO_LABEL[g.resultado]}
                      </span>
                      <span className="text-xs text-[var(--color-muted)]">
                        · {CANAL_LABEL[g.canal]} · {g.fecha}
                      </span>
                    </p>
                    {g.nota && <p className="mt-0.5 text-sm text-neutral-300">{g.nota}</p>}
                    {g.proxima_accion && (
                      <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-muted)]">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Próxima acción: {g.proxima_accion}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminar(g.id)}
                    className="shrink-0 rounded-md p-1.5 text-neutral-400 transition hover:bg-red-950/40 hover:text-red-300"
                    aria-label="Eliminar gestión"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}

const INPUT =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
