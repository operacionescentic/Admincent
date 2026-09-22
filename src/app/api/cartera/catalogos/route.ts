import { NextResponse } from "next/server";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cargarCatalogos } from "@/lib/cartera/db";
import {
  categoriaServicio,
  claveCatalogo,
  normalizarVendedor,
} from "@/lib/cartera/normalize";

/** Ambos catálogos en una sola petición, para el formulario de registro. */
export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  try {
    return NextResponse.json(await cargarCatalogos());
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error cargando los catálogos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Siembra los catálogos con los valores que ya aparecen en cartera_ventas.
 *
 * Los 65 registros importados del Excel traen 5 variantes de vendedor para 3
 * personas y 21 nombres de servicio; esto los deduplica (sin distinguir
 * mayúsculas ni tildes) y deja el catálogo listo sin teclearlo a mano. Nunca
 * pisa lo que ya existe: sólo añade lo que falta.
 */
export async function POST() {
  const { response } = await requireSession();
  if (response) return response;

  const sb = getSupabaseAdmin();

  const [ventas, comerciales, servicios] = await Promise.all([
    sb.from("cartera_ventas").select("vendedor, servicio"),
    sb.from("cartera_comerciales").select("nombre"),
    sb.from("cartera_servicios").select("nombre"),
  ]);

  if (ventas.error) return NextResponse.json({ error: ventas.error.message }, { status: 500 });
  if (comerciales.error) {
    return NextResponse.json({ error: comerciales.error.message }, { status: 500 });
  }
  if (servicios.error) {
    return NextResponse.json({ error: servicios.error.message }, { status: 500 });
  }

  const yaComercial = new Set((comerciales.data ?? []).map((c) => claveCatalogo(c.nombre)));
  const yaServicio = new Set((servicios.data ?? []).map((s) => claveCatalogo(s.nombre)));

  // Vendedores: se normalizan a Proper, así "ximena" y "Ximena" caen en uno solo.
  const nuevosComerciales = new Map<string, string>();
  const nuevosServicios = new Map<string, string>();

  for (const v of ventas.data ?? []) {
    if (v.vendedor?.trim()) {
      const nombre = normalizarVendedor(v.vendedor);
      const clave = claveCatalogo(nombre);
      if (!yaComercial.has(clave)) nuevosComerciales.set(clave, nombre);
    }

    if (v.servicio?.trim()) {
      // El nombre del servicio se conserva tal cual (sólo se colapsan espacios):
      // "ITIL 4 Fundamentos" no debe convertirse en "Itil 4 Fundamentos".
      const nombre = v.servicio.trim().replace(/\s+/g, " ");
      const clave = claveCatalogo(nombre);
      if (!yaServicio.has(clave)) nuevosServicios.set(clave, nombre);
    }
  }

  let comercialesCreados = 0;
  let serviciosCreados = 0;

  if (nuevosComerciales.size > 0) {
    const { data, error } = await sb
      .from("cartera_comerciales")
      .insert([...nuevosComerciales.values()].map((nombre) => ({ nombre })))
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    comercialesCreados = data?.length ?? 0;
  }

  if (nuevosServicios.size > 0) {
    const { data, error } = await sb
      .from("cartera_servicios")
      .insert(
        [...nuevosServicios.values()].map((nombre) => ({
          nombre,
          // Categoría de arranque por palabras clave; es editable después.
          categoria: categoriaServicio(nombre),
        })),
      )
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    serviciosCreados = data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, comercialesCreados, serviciosCreados });
}
