"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { ArrowLeft, Check, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { CATEGORIAS_SERVICIO } from "@/lib/cartera/types";
import type {
  CarteraComercial,
  CarteraServicio,
  CategoriaServicio,
} from "@/lib/cartera/types";
import { Card } from "@/components/cartera/ui";

type Catalogos = { comerciales: CarteraComercial[]; servicios: CarteraServicio[] };

export default function CatalogosClient() {
  const [datos, setDatos] = useState<Catalogos>({ comerciales: [], servicios: [] });
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  const cargar = useCallback(() => {
    fetch("/api/cartera/catalogos")
      .then((r) => r.json())
      .then((d) => {
        if (d?.comerciales) setDatos(d);
        else toast.error(d?.error ?? "No se pudieron cargar los catálogos");
      })
      .catch(() => toast.error("Error de red"))
      .finally(() => setCargando(false));
  }, []);

  useEffect(cargar, [cargar]);

  async function sincronizar() {
    setSincronizando(true);
    try {
      const res = await fetch("/api/cartera/catalogos", { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j?.error ?? "No se pudo sincronizar");
        return;
      }
      const total = j.comercialesCreados + j.serviciosCreados;
      toast.success(
        total === 0
          ? "Los catálogos ya estaban al día"
          : `${j.comercialesCreados} comerciales y ${j.serviciosCreados} servicios agregados`,
      );
      cargar();
    } catch {
      toast.error("Error de red");
    } finally {
      setSincronizando(false);
    }
  }

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
          <h1 className="text-3xl font-semibold tracking-tight">Catálogos</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Comerciales y servicios que alimentan los desplegables del formulario de registro.
          </p>
        </div>
        <button
          type="button"
          onClick={sincronizar}
          disabled={sincronizando}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-2)] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${sincronizando ? "animate-spin" : ""}`} />
          Sincronizar desde los registros
        </button>
      </header>

      <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-xs leading-relaxed text-[var(--color-muted)]">
        «Sincronizar desde los registros» recorre la cartera ya cargada y da de alta los
        comerciales y servicios que falten, unificando las variantes por mayúsculas y tildes
        («ximena» y «Ximena» quedan como uno solo). No pisa nada de lo que ya exista. Al
        renombrar una entrada puedes propagar el cambio a los registros que la usaban, y
        desactivar una la saca de los desplegables sin tocar el historial.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListaComerciales
          items={datos.comerciales}
          cargando={cargando}
          onChange={cargar}
        />
        <ListaServicios items={datos.servicios} cargando={cargando} onChange={cargar} />
      </div>
    </div>
  );
}

/* ---------------------------------- Comerciales --------------------------------- */

function ListaComerciales({
  items,
  cargando,
  onChange,
}: {
  items: CarteraComercial[];
  cargando: boolean;
  onChange: () => void;
}) {
  const [nuevo, setNuevo] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo.trim()) return;

    setOcupado(true);
    try {
      const res = await fetch("/api/cartera/comerciales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: nuevo, activo: true }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j?.error ?? "No se pudo crear");
        return;
      }
      toast.success("Comercial agregado");
      setNuevo("");
      onChange();
    } catch {
      toast.error("Error de red");
    } finally {
      setOcupado(false);
    }
  }

  async function guardar(id: number) {
    if (!editNombre.trim()) return;

    const propagar = confirm(
      "¿Actualizar también los registros de cartera que usaban el nombre anterior?\n\nAceptar: renombra el comercial y los registros.\nCancelar: renombra sólo el catálogo.",
    );

    setOcupado(true);
    try {
      const res = await fetch(
        `/api/cartera/comerciales/${id}${propagar ? "?propagar=1" : ""}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ nombre: editNombre, activo: true }),
        },
      );
      const j = await res.json();
      if (!res.ok) {
        toast.error(j?.error ?? "No se pudo guardar");
        return;
      }
      toast.success(
        j.propagados > 0 ? `Actualizado · ${j.propagados} registros renombrados` : "Actualizado",
      );
      setEditId(null);
      onChange();
    } catch {
      toast.error("Error de red");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card
      title="Comerciales"
      subtitle={`${items.filter((i) => i.activo).length} activos de ${items.length}`}
    >
      <form onSubmit={crear} className="mb-4 flex gap-2">
        <input
          type="text"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder="Nombre del comercial"
          className={INPUT}
        />
        <button
          type="submit"
          disabled={ocupado || !nuevo.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Agregar
        </button>
      </form>

      <Filas
        vacio={cargando ? "Cargando…" : "Sin comerciales. Usa «Sincronizar desde los registros»."}
        items={items}
      >
        {(c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-2.5 last:border-b-0"
          >
            {editId === c.id ? (
              <>
                <input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  autoFocus
                  className={INPUT}
                />
                <BotonesEdicion
                  ocupado={ocupado}
                  onGuardar={() => guardar(c.id)}
                  onCancelar={() => setEditId(null)}
                />
              </>
            ) : (
              <>
                <span className={c.activo ? "" : "text-[var(--color-muted)] line-through"}>
                  {c.nombre}
                </span>
                <Acciones
                  activo={c.activo}
                  onEditar={() => {
                    setEditId(c.id);
                    setEditNombre(c.nombre);
                  }}
                  onToggle={async () => {
                    await fetch(`/api/cartera/comerciales/${c.id}`, {
                      method: "PUT",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ nombre: c.nombre, activo: !c.activo }),
                    });
                    onChange();
                  }}
                  onEliminar={() => eliminar("comerciales", c.id, c.nombre, onChange)}
                />
              </>
            )}
          </li>
        )}
      </Filas>
    </Card>
  );
}

/* ---------------------------------- Servicios ----------------------------------- */

function ListaServicios({
  items,
  cargando,
  onChange,
}: {
  items: CarteraServicio[];
  cargando: boolean;
  onChange: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editCategoria, setEditCategoria] = useState<string>("");
  const [ocupado, setOcupado] = useState(false);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;

    setOcupado(true);
    try {
      const res = await fetch("/api/cartera/servicios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre, categoria, activo: true }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j?.error ?? "No se pudo crear");
        return;
      }
      toast.success("Servicio agregado");
      setNombre("");
      setCategoria("");
      onChange();
    } catch {
      toast.error("Error de red");
    } finally {
      setOcupado(false);
    }
  }

  async function guardar(id: number) {
    if (!editNombre.trim()) return;

    const original = items.find((i) => i.id === id);
    const renombrado = original != null && original.nombre !== editNombre.trim();
    const propagar =
      renombrado &&
      confirm(
        "¿Actualizar también los registros de cartera que usaban el nombre anterior?\n\nAceptar: renombra el servicio y los registros.\nCancelar: renombra sólo el catálogo.",
      );

    setOcupado(true);
    try {
      const res = await fetch(`/api/cartera/servicios/${id}${propagar ? "?propagar=1" : ""}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: editNombre, categoria: editCategoria, activo: true }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j?.error ?? "No se pudo guardar");
        return;
      }
      toast.success(
        j.propagados > 0 ? `Actualizado · ${j.propagados} registros renombrados` : "Actualizado",
      );
      setEditId(null);
      onChange();
    } catch {
      toast.error("Error de red");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card
      title="Servicios y cursos"
      subtitle={`${items.filter((i) => i.activo).length} activos de ${items.length}`}
    >
      <form onSubmit={crear} className="mb-4 space-y-2">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del servicio o curso"
          className={INPUT}
        />
        <div className="flex gap-2">
          <SelectCategoria value={categoria} onChange={setCategoria} />
          <button
            type="submit"
            disabled={ocupado || !nombre.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Agregar
          </button>
        </div>
      </form>

      <Filas
        vacio={cargando ? "Cargando…" : "Sin servicios. Usa «Sincronizar desde los registros»."}
        items={items}
      >
        {(s) => (
          <li
            key={s.id}
            className="border-b border-[var(--color-border)] py-2.5 last:border-b-0"
          >
            {editId === s.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  autoFocus
                  className={INPUT}
                />
                <div className="flex items-center gap-2">
                  <SelectCategoria value={editCategoria} onChange={setEditCategoria} />
                  <BotonesEdicion
                    ocupado={ocupado}
                    onGuardar={() => guardar(s.id)}
                    onCancelar={() => setEditId(null)}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span
                    className={`block truncate ${s.activo ? "" : "text-[var(--color-muted)] line-through"}`}
                  >
                    {s.nombre}
                  </span>
                  <span className="text-xs text-[var(--color-muted)]">
                    {s.categoria ?? "categoría automática"}
                  </span>
                </span>
                <Acciones
                  activo={s.activo}
                  onEditar={() => {
                    setEditId(s.id);
                    setEditNombre(s.nombre);
                    setEditCategoria(s.categoria ?? "");
                  }}
                  onToggle={async () => {
                    await fetch(`/api/cartera/servicios/${s.id}`, {
                      method: "PUT",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        nombre: s.nombre,
                        categoria: s.categoria ?? "",
                        activo: !s.activo,
                      }),
                    });
                    onChange();
                  }}
                  onEliminar={() => eliminar("servicios", s.id, s.nombre, onChange)}
                />
              </div>
            )}
          </li>
        )}
      </Filas>
    </Card>
  );
}

/* ------------------------------------ Compartido -------------------------------- */

const INPUT =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

/**
 * Borra una entrada del catálogo. La API responde 409 cuando algún registro la
 * usa; ahí se ofrece forzar, con el aviso de que los registros conservan el
 * texto pero la entrada desaparece de los desplegables.
 */
async function eliminar(
  recurso: "comerciales" | "servicios",
  id: number,
  nombre: string,
  onChange: () => void,
) {
  if (!confirm(`¿Eliminar «${nombre}» del catálogo?`)) return;

  const res = await fetch(`/api/cartera/${recurso}/${id}`, { method: "DELETE" });
  if (res.ok) {
    toast.success("Eliminado");
    onChange();
    return;
  }

  const j = await res.json().catch(() => ({}));
  if (res.status === 409) {
    if (
      confirm(
        `${j.error}\n\n¿Eliminarlo de todos modos? Los ${j.usos} registros conservan el texto, pero la entrada deja de aparecer en los desplegables.`,
      )
    ) {
      const forzado = await fetch(`/api/cartera/${recurso}/${id}?forzar=1`, { method: "DELETE" });
      if (forzado.ok) {
        toast.success("Eliminado");
        onChange();
      } else {
        toast.error("No se pudo eliminar");
      }
    }
    return;
  }

  toast.error(j?.error ?? "No se pudo eliminar");
}

function SelectCategoria({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT}
      title="Categoría para los gráficos del dashboard"
    >
      <option value="">Categoría automática</option>
      {CATEGORIAS_SERVICIO.map((c: CategoriaServicio) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

function Filas<T extends { id: number }>({
  items,
  vacio,
  children,
}: {
  items: T[];
  vacio: string;
  children: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--color-muted)]">{vacio}</p>;
  }
  return (
    <ul className="max-h-[420px] overflow-y-auto text-sm">{items.map((i) => children(i))}</ul>
  );
}

function BotonesEdicion({
  ocupado,
  onGuardar,
  onCancelar,
}: {
  ocupado: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        onClick={onGuardar}
        disabled={ocupado}
        title="Guardar"
        className="rounded-md p-1.5 text-emerald-400 transition hover:bg-[var(--color-surface-2)] disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onCancelar}
        title="Cancelar"
        className="rounded-md p-1.5 text-neutral-400 transition hover:bg-[var(--color-surface-2)]"
      >
        <X className="h-4 w-4" />
      </button>
    </span>
  );
}

function Acciones({
  activo,
  onEditar,
  onToggle,
  onEliminar,
}: {
  activo: boolean;
  onEditar: () => void;
  onToggle: () => void;
  onEliminar: () => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        title={activo ? "Desactivar" : "Activar"}
        className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
          activo
            ? "bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40"
            : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-white"
        }`}
      >
        {activo ? "Activo" : "Inactivo"}
      </button>
      <button
        type="button"
        onClick={onEditar}
        title="Editar"
        className="rounded-md p-1.5 text-neutral-300 transition hover:bg-[var(--color-surface-2)] hover:text-white"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onEliminar}
        title="Eliminar"
        className="rounded-md p-1.5 text-neutral-400 transition hover:bg-red-950/40 hover:text-red-300"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </span>
  );
}
