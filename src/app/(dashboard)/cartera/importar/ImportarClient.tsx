"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { AlertTriangle, ArrowLeft, FileSpreadsheet, Upload } from "lucide-react";
import { formatCOP } from "@/lib/nomina/payment";
import { EstadoBadge } from "@/components/cartera/ui";
import type { EstadoCartera } from "@/lib/cartera/types";

type FilaPreview = {
  fila: number;
  cliente: string;
  fecha_contacto: string | null;
  vendedor: string | null;
  servicio: string | null;
  modalidad: string | null;
  nota_gestion: string | null;
  valor_mora: number | null;
  total_pagar: number;
  compromiso_pago: string | null;
  meses_mora: number | null;
  estado_cobro: string | null;
  vendedorNorm: string;
  estadoCarteraNorm: EstadoCartera;
  categoriaServicio: string;
  rangoMora: string;
};

type Preview = {
  hoja: string;
  filas: FilaPreview[];
  descartadas: { fila: number; motivo: string }[];
};

export default function ImportarClient() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reemplazar, setReemplazar] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [importando, setImportando] = useState(false);

  async function analizar(file: File) {
    setArchivo(file);
    setPreview(null);
    setSubiendo(true);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/cartera/import", { method: "POST", body });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json?.error ?? "No se pudo leer el archivo");
        return;
      }
      setPreview(json);
      toast.success(`${json.filas.length} filas leídas de la hoja "${json.hoja}"`);
    } catch {
      toast.error("Error de red");
    } finally {
      setSubiendo(false);
    }
  }

  async function confirmar() {
    if (!preview) return;
    if (
      reemplazar &&
      !confirm(
        "Se eliminarán TODOS los registros de cartera existentes, junto con sus abonos y gestiones, antes de importar. Esta acción no se puede deshacer. ¿Continuar?",
      )
    ) {
      return;
    }

    setImportando(true);
    try {
      // `fila`, `vendedorNorm` y los derivados son sólo para el preview: no van a la tabla.
      const filas = preview.filas.map((f) => ({
        cliente: f.cliente,
        fecha_contacto: f.fecha_contacto,
        vendedor: f.vendedor,
        servicio: f.servicio,
        modalidad: f.modalidad,
        nota_gestion: f.nota_gestion,
        valor_mora: f.valor_mora,
        total_pagar: f.total_pagar,
        compromiso_pago: f.compromiso_pago,
        meses_mora: f.meses_mora,
        estado_cobro: f.estado_cobro,
      }));

      const res = await fetch("/api/cartera/import", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filas, reemplazar }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json?.error ?? "No se pudo importar");
        return;
      }

      toast.success(`${json.insertadas} registros importados`);
      router.push("/cartera");
      router.refresh();
    } catch {
      toast.error("Error de red");
    } finally {
      setImportando(false);
    }
  }

  const total = preview?.filas.reduce((a, f) => a + f.total_pagar, 0) ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/cartera"
          className="mb-1 inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)] transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Importar cartera</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Sube el Excel de cobranzas. Se lee la hoja «Ventas» y se muestra cómo quedó cada campo
          antes de guardar nada.
        </p>
      </header>

      {/* Zona de carga */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) analizar(file);
        }}
        className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center transition hover:border-[var(--color-accent)]/50"
      >
        <FileSpreadsheet className="mx-auto h-10 w-10 text-[var(--color-muted)]" />
        <p className="mt-3 text-sm">
          {archivo ? (
            <span className="font-medium">{archivo.name}</span>
          ) : (
            "Arrastra el archivo .xlsx aquí"
          )}
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {subiendo ? "Leyendo…" : archivo ? "Elegir otro archivo" : "Seleccionar archivo"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) analizar(file);
            e.target.value = "";
          }}
        />
      </div>

      {preview && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Resumen label="Filas a importar" valor={String(preview.filas.length)} />
            <Resumen label="Total a pagar" valor={formatCOP(total)} />
            <Resumen
              label="Filas descartadas"
              valor={String(preview.descartadas.length)}
            />
          </div>

          {preview.descartadas.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-800/40 bg-amber-950/20 p-4 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">
                  {preview.descartadas.length} filas no se importarán
                </p>
                <ul className="mt-1 text-xs text-amber-300/80">
                  {preview.descartadas.slice(0, 5).map((d) => (
                    <li key={d.fila}>
                      Fila {d.fila}: {d.motivo}
                    </li>
                  ))}
                  {preview.descartadas.length > 5 && (
                    <li>…y {preview.descartadas.length - 5} más</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                    <th className="px-3 py-3 font-medium">Fila</th>
                    <th className="px-3 py-3 font-medium">Cliente</th>
                    <th className="px-3 py-3 font-medium">Vendedor</th>
                    <th className="px-3 py-3 font-medium">Categoría</th>
                    <th className="px-3 py-3 text-right font-medium">Total</th>
                    <th className="px-3 py-3 font-medium">Estado derivado</th>
                    <th className="px-3 py-3 font-medium">Mora</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.filas.map((f) => (
                    <tr
                      key={f.fila}
                      className="border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <td className="px-3 py-2.5 tabular-nums text-[var(--color-muted)]">
                        {f.fila}
                      </td>
                      <td className="px-3 py-2.5 font-medium">{f.cliente}</td>
                      <td className="px-3 py-2.5 text-[var(--color-muted)]">{f.vendedorNorm}</td>
                      <td className="px-3 py-2.5">
                        <span className="block truncate">{f.servicio ?? "—"}</span>
                        <span className="text-xs text-[var(--color-muted)]">
                          {f.categoriaServicio}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {f.total_pagar > 0 ? formatCOP(f.total_pagar) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <EstadoBadge estado={f.estadoCarteraNorm} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[var(--color-muted)]">
                        {f.rangoMora}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={reemplazar}
                onChange={(e) => setReemplazar(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              />
              <span>
                Reemplazar la cartera existente
                <span className="block text-xs text-[var(--color-muted)]">
                  Borra todos los registros actuales con sus abonos y gestiones antes de importar.
                  Sin marcar, las filas se añaden a lo que ya hay.
                </span>
              </span>
            </label>

            <button
              type="button"
              onClick={confirmar}
              disabled={importando || preview.filas.length === 0}
              className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {importando ? "Importando…" : `Importar ${preview.filas.length} registros`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Resumen({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
