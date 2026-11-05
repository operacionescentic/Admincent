import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { History, Mail, Users, FileText, Wallet } from "lucide-react";
import { cargarCartera } from "@/lib/cartera/db";
import IndicadorRecaudoSemanal from "@/components/cartera/IndicadorRecaudoSemanal";
import type { VentaEnriquecida } from "@/lib/cartera/types";

async function getStats() {
  const sb = getSupabaseAdmin();
  const [trab, inst, prov, hist] = await Promise.all([
    sb.from("trabajadores").select("id", { count: "exact", head: true }),
    sb.from("instructores").select("id", { count: "exact", head: true }),
    sb.from("proveedores").select("id", { count: "exact", head: true }),
    sb.from("historial").select("id", { count: "exact", head: true }),
  ]);
  return {
    trabajadores: trab.count ?? 0,
    instructores: inst.count ?? 0,
    proveedores: prov.count ?? 0,
    historial: hist.count ?? 0,
  };
}

const cards = [
  {
    title: "Generar desprendible",
    description: "Crea y envía comprobantes de pago.",
    href: "/desprendibles",
    icon: Mail,
  },
  {
    title: "Colaboradores",
    description: "Empleados, instructores y proveedores.",
    href: "/colaboradores/empleados",
    icon: Users,
  },
  {
    title: "Historial",
    description: "Revisa los desprendibles emitidos.",
    href: "/historial",
    icon: History,
  },
  {
    title: "Plantillas",
    description: "Bases PDF/DOCX para certificados.",
    href: "/templates",
    icon: FileText,
  },
  {
    title: "Cartera y cobranzas",
    description: "Control de cartera por cobrar y abonos.",
    href: "/cartera",
    icon: Wallet,
  },
];

export default async function DashboardPage() {
  const session = await auth();
  const [stats, ventas] = await Promise.all([
    getStats().catch(() => ({
      trabajadores: 0,
      instructores: 0,
      proveedores: 0,
      historial: 0,
    })),
    cargarCartera().catch(() => [] as VentaEnriquecida[]),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Hola{session?.user?.name ? `, ${session.user.name}` : ""} 👋
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Bienvenido a Nominapp. Empieza generando un desprendible o gestionando tu equipo.
        </p>
      </header>

      {/* Indicador de recaudo semanal de Cartera */}
      {ventas.length > 0 && (
        <section>
          <IndicadorRecaudoSemanal ventas={ventas} />
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Empleados" value={stats.trabajadores} />
        <StatCard label="Instructores" value={stats.instructores} />
        <StatCard label="Proveedores" value={stats.proveedores} />
        <StatCard label="Desprendibles emitidos" value={stats.historial} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[var(--color-accent)]/15 p-2 text-[var(--color-accent)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold">{c.title}</h2>
              </div>
              <p className="mt-3 text-sm text-[var(--color-muted)]">{c.description}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
