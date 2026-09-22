import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cargarCartera } from "@/lib/cartera/db";
import CarteraDashboard from "./CarteraDashboard";
import type { VentaEnriquecida } from "@/lib/cartera/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cartera — Nominapp",
};

export default async function CarteraPage() {
  let ventas: VentaEnriquecida[] = [];
  let error: string | null = null;

  try {
    ventas = await cargarCartera();
  } catch (e) {
    error = e instanceof Error ? e.message : "No se pudo cargar la cartera";
  }

  if (error) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Cartera</h1>
        </header>
        <div className="flex items-start gap-3 rounded-2xl border border-red-800/40 bg-red-950/30 p-5 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">No se pudo cargar la cartera.</p>
            <p className="mt-1 text-red-300/80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (ventas.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Cartera</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Control de cartera por cobrar · Cursos y certificaciones
          </p>
        </header>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            Todavía no hay registros de cartera.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/cartera/importar"
              className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)]"
            >
              Importar desde Excel
            </Link>
            <Link
              href="/cartera/registros"
              className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-2)]"
            >
              Crear el primero a mano
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <CarteraDashboard ventas={ventas} />;
}
