"use client";
import { useCallback, useEffect, useState } from "react";
import { NumericFormat } from "react-number-format";
import { toast } from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatCOP } from "@/lib/nomina/payment";
import { parseMonto } from "@/lib/cartera/normalize";
import type { CarteraAbono, VentaEnriquecida } from "@/lib/cartera/types";

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * El padre lo monta sólo con un registro seleccionado y con `key={venta.id}`,
 * así el estado del formulario nace limpio en cada apertura.
 */
export default function AbonosModal({
  venta,
  onClose,
  onChanged,
}: {
  venta: VentaEnriquecida;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [abonos, setAbonos] = useState<CarteraAbono[]>([]);
  const [fecha, setFecha] = useState(hoy);
  const [valor, setValor] = useState("");
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(false);

  const ventaId = venta.id;

  const cargar = useCallback(() => {
    fetch(`/api/cartera/abonos?ventaId=${ventaId}`)
      .then((r) => r.json())
      .then((d) => setAbonos(Array.isArray(d) ? d : []))
      .catch(() => toast.error("No se pudieron cargar los abonos"));
  }, [ventaId]);

  useEffect(cargar, [cargar]);

  const abonado = abonos.reduce((a, x) => a + parseMonto(x.valor), 0);
  const saldo = Math.max(0, venta.totalPagar - abonado);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();

    const monto = Number(valor);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error("El abono debe ser mayor que cero");
      return;
    }
    if (monto > saldo) {
      toast.error(`El abono supera el saldo pendiente (${formatCOP(saldo)})`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/cartera/abonos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ venta_id: venta.id, fecha, valor: monto, nota }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "No se pudo registrar el abono");
        return;
      }
      toast.success("Abono registrado");
      setValor("");
      setNota("");
      cargar();
      onChanged();
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este abono?")) return;
    const res = await fetch(`/api/cartera/abonos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("No se pudo eliminar");
      return;
    }
    toast.success("Abono eliminado");
    cargar();
    onChanged();
  }

  return (
    <Modal open onClose={onClose} title={`Abonos · ${venta.cliente}`} size="lg">
      <div className="mb-5 grid grid-cols-3 gap-3 text-center">
        <Resumen label="Total" valor={formatCOP(venta.totalPagar)} />
        <Resumen label="Abonado" valor={formatCOP(abonado)} color="#22c55e" />
        <Resumen label="Saldo" valor={formatCOP(saldo)} color="#f44336" />
      </div>

      <form onSubmit={agregar} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
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
          <span className="text-xs text-[var(--color-muted)]">Valor</span>
          <NumericFormat
            value={valor}
            onValueChange={(v) => setValor(v.value)}
            thousandSeparator="."
            decimalSeparator=","
            prefix="$ "
            allowNegative={false}
            decimalScale={0}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-muted)]">Nota</span>
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Transferencia, efectivo…"
            className={INPUT}
          />
        </label>
        <button
          type="submit"
          disabled={loading || saldo <= 0}
          className="self-end rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {saldo <= 0 ? "Sin saldo" : "Registrar"}
        </button>
      </form>

      {abonos.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--color-muted)]">
          Aún no hay abonos registrados.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] text-sm">
          {abonos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 flex-col">
                <span className="tabular-nums font-medium">{formatCOP(a.valor)}</span>
                {a.nota && (
                  <span className="truncate text-xs text-[var(--color-muted)]">{a.nota}</span>
                )}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-[var(--color-muted)]">{a.fecha}</span>
                <button
                  type="button"
                  onClick={() => eliminar(a.id)}
                  className="rounded-md p-1.5 text-neutral-400 transition hover:bg-red-950/40 hover:text-red-300"
                  aria-label="Eliminar abono"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const INPUT =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

function Resumen({ label, valor, color }: { label: string; valor: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums" style={color ? { color } : undefined}>
        {valor}
      </p>
    </div>
  );
}
