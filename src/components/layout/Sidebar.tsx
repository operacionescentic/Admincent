"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Award,
  BookMarked,
  ChevronDown,
  ChevronRight,
  FileSignature,
  FileText,
  Files,
  History,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  TableProperties,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { signOut } from "next-auth/react";

type NavItem = {
  label: string;
  href?: string;
  icon: typeof LayoutDashboard;
  children?: { label: string; href: string; icon: typeof LayoutDashboard }[];
};

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Desprendibles", href: "/desprendibles", icon: Mail },
  {
    label: "Colaboradores",
    icon: Users,
    children: [
      { label: "Empleados", href: "/colaboradores/empleados", icon: Users },
      { label: "Instructores", href: "/colaboradores/instructores", icon: FileSignature },
      { label: "Proveedores", href: "/colaboradores/proveedores", icon: Files },
    ],
  },
  {
    label: "Cartera",
    icon: Wallet,
    children: [
      { label: "Dashboard", href: "/cartera", icon: LayoutDashboard },
      { label: "Registros", href: "/cartera/registros", icon: TableProperties },
      { label: "Catálogos", href: "/cartera/catalogos", icon: BookMarked },
      { label: "Importar", href: "/cartera/importar", icon: Upload },
    ],
  },
  { label: "Historial", href: "/historial", icon: History },
  { label: "Plantillas", href: "/templates", icon: FileText },
  { label: "Certificados", href: "/certificates", icon: FileSignature },
  {
    label: "Asistencia",
    icon: Award,
    children: [
      { label: "Generar", href: "/asistencia", icon: Award },
      { label: "Plantillas", href: "/asistencia/plantillas", icon: FileText },
    ],
  },
];

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  // Rutas que además son prefijo de sus hijas: sólo coinciden exactamente, para
  // que el hijo "Dashboard" no quede activo al estar en una subpágina.
  if (href === "/dashboard" || href === "/cartera") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const n of NAV) {
      if (n.children?.some((c) => isActive(pathname, c.href))) init[n.label] = true;
    }
    return init;
  });

  const toggle = (key: string) =>
    setExpanded((s) => ({ ...s, [key]: !s[key] }));

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    if (item.children) {
      const open = expanded[item.label];
      const Chevron = open ? ChevronDown : ChevronRight;
      const childActive = item.children.some((c) => isActive(pathname, c.href));
      return (
        <div key={item.label}>
          <button
            type="button"
            onClick={() => toggle(item.label)}
            className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              childActive
                ? "bg-[var(--color-surface-2)] text-white"
                : "text-neutral-300 hover:bg-[var(--color-surface-2)] hover:text-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-4 w-4" />
              {item.label}
            </span>
            <Chevron className="h-4 w-4 opacity-70" />
          </button>
          {open && (
            <div className="ml-4 mt-1 space-y-0.5 border-l border-[var(--color-border)] pl-3">
              {item.children.map((c) => {
                const ChildIcon = c.icon;
                const active = isActive(pathname, c.href);
                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-[var(--color-accent)]/15 text-white"
                        : "text-neutral-400 hover:bg-[var(--color-surface-2)] hover:text-white"
                    }`}
                  >
                    <ChildIcon className="h-4 w-4" />
                    {c.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.label}
        href={item.href!}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          active
            ? "bg-[var(--color-accent)]/15 text-white border-l-2 border-[var(--color-accent)] pl-[10px]"
            : "text-neutral-300 hover:bg-[var(--color-surface-2)] hover:text-white"
        }`}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  };

  const aside = (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between gap-3 px-5 py-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <Image src="/logo.webp" alt="Nominapp" width={32} height={32} className="h-8 w-8 rounded" />
          <span className="text-lg font-semibold tracking-tight">Nominapp</span>
        </div>
        <button
          className="md:hidden text-neutral-400 hover:text-white"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        >
          <PanelLeftClose className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map(renderItem)}
      </nav>

      <div className="border-t border-[var(--color-border)] px-3 py-4 space-y-2">
        {userEmail && (
          <p className="truncate px-2 text-xs text-neutral-400" title={userEmail}>
            {userEmail}
          </p>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-300 transition hover:bg-[var(--color-surface-2)] hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Image src="/logo.webp" alt="Nominapp" width={28} height={28} className="h-7 w-7 rounded" />
          <span className="font-semibold">Nominapp</span>
        </div>
        <button
          className="rounded-md border border-[var(--color-border)] p-2 text-neutral-300 hover:text-white"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop static */}
      <div className="hidden md:flex h-screen sticky top-0">{aside}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0">{aside}</div>
        </div>
      )}
    </>
  );
}
