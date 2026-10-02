"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Bell, Calendar, ChevronRight, X } from "lucide-react";
import { formatCOP } from "@/lib/nomina/payment";
import type { VentaEnriquecida } from "@/lib/cartera/types";
import { fechaHoyBogota, obtenerTareasCobro } from "@/lib/cartera/tareas";

export default function NotificacionCobrosHoy({
  ventas,
  onOpenTareas,
}: {
  ventas: VentaEnriquecida[];
  onOpenTareas: (tab?: "semana" | "hoy" | "vencidas") => void;
}) {
  const [descartado, setDescartado] = useState(false);
  const hoyIso = fechaHoyBogota();

  const todasLasTareas = useMemo(
    () => obtenerTareasCobro(ventas, hoyIso),
    [ventas, hoyIso],
  );

  const tareasHoy = useMemo(
    () => todasLasTareas.filter((t) => t.esHoy),
    [todasLasTareas],
  );

  const montoHoy = useMemo(
    () => tareasHoy.reduce((acc, t) => acc + t.venta.saldo, 0),
    [tareasHoy],
  );

  // Disparar la notificación con toast al cargar si hay cobros para hoy
  useEffect(() => {
    if (tareasHoy.length === 0) return;

    const storageKey = `centic_cobros_toast_${hoyIso}`;
    const yaNotificado = sessionStorage.getItem(storageKey);

    if (!yaNotificado) {
      sessionStorage.setItem(storageKey, "true");

      const primerCliente = tareasHoy[0].venta.cliente;
      const primerSaldo = formatCOP(tareasHoy[0].venta.saldo);

      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? "animate-in fade-in slide-in-from-top-2" : "animate-out fade-out"
            } pointer-events-auto flex w-full max-w-md rounded-2xl border border-amber-500/50 bg-[var(--color-surface)] p-4 shadow-2xl ring-1 ring-amber-500/30 text-white transition-all`}
          >
            <div className="flex items-start gap-3 w-full">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                <Bell className="h-5 w-5 animate-pulse" />
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Cobros programados para hoy
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  {tareasHoy.length === 1
                    ? `Tienes programado realizar el cobro a ${primerCliente} (${primerSaldo}) hoy.`
                    : `Tienes ${tareasHoy.length} cobros programados para hoy (${formatCOP(montoHoy)}), incluyendo a ${primerCliente}.`}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      toast.dismiss(t.id);
                      onOpenTareas("hoy");
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--color-accent-hover)]"
                  >
                    <span>Ver tareas de hoy</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => toast.dismiss(t.id)}
                    className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-neutral-400 transition hover:bg-[var(--color-surface-2)] hover:text-white"
                  >
                    Descartar
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="rounded-lg p-1 text-neutral-400 transition hover:bg-[var(--color-surface-2)] hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ),
        {
          id: `toast-cobros-hoy-${hoyIso}`,
          duration: 10000,
        },
      );
    }
  }, [tareasHoy, montoHoy, hoyIso, onOpenTareas]);

  // Si no hay cobros para hoy o el usuario descartó el banner visual en la pantalla
  if (tareasHoy.length === 0 || descartado) {
    return null;
  }

  return (
    <div className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-amber-950/20 to-[var(--color-surface)] p-4 text-sm shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
          <Bell className="h-4 w-4" />
        </span>
        <div>
          <p className="font-semibold text-white">
            {tareasHoy.length === 1 ? (
              <>
                Cobro programado para hoy:{" "}
                <span className="text-amber-300">{tareasHoy[0].venta.cliente}</span> (
                {formatCOP(tareasHoy[0].venta.saldo)})
              </>
            ) : (
              <>
                Tienes{" "}
                <span className="text-amber-300">
                  {tareasHoy.length} cobros programados para hoy
                </span>{" "}
                por un total de {formatCOP(montoHoy)}.
              </>
            )}
          </p>
          <p className="text-xs text-amber-200/70">
            Haz clic para ver el detalle de cada cliente, registrar llamadas o asentar abonos.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenTareas("hoy")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-400"
        >
          <Calendar className="h-3.5 w-3.5" />
          Atender cobros de hoy
        </button>

        <button
          type="button"
          onClick={() => setDescartado(true)}
          className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-[var(--color-surface-2)] hover:text-white"
          aria-label="Cerrar banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
