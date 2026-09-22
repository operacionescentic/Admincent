/**
 * Acceso a las tablas de cartera. Server-only: usa la service-role key.
 * Las tablas tienen RLS activado sin políticas, así que ningún otro rol las ve.
 */
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { claveCatalogo, enriquecerVentas } from "./normalize";
import type {
  CarteraAbono,
  CarteraGestion,
  CarteraServicio,
  CarteraVenta,
  CategoriaServicio,
  VentaEnriquecida,
} from "./types";

export const VENTA_COLUMNS =
  "id, cliente, fecha_contacto, vendedor, servicio, modalidad, nota_gestion, valor_mora, total_pagar, compromiso_pago, meses_mora, estado_cobro, estado_cartera, notas, created_at, updated_at";

/**
 * Carga las ventas con sus abonos y gestiones ya combinados.
 *
 * Son tres consultas planas en vez de un join anidado por venta: evita el N+1 y
 * mantiene el cálculo de saldos y estados en `normalize.ts`, que es donde viven
 * las reglas del Excel.
 */
export async function cargarCartera(): Promise<VentaEnriquecida[]> {
  const sb = getSupabaseAdmin();

  const [ventas, abonos, gestiones, servicios] = await Promise.all([
    sb.from("cartera_ventas").select(VENTA_COLUMNS).order("cliente", { ascending: true }),
    sb.from("cartera_abonos").select("*").order("fecha", { ascending: false }),
    sb.from("cartera_gestiones").select("*").order("fecha", { ascending: false }),
    sb.from("cartera_servicios").select("nombre, categoria").not("categoria", "is", null),
  ]);

  if (ventas.error) throw new Error(ventas.error.message);
  if (abonos.error) throw new Error(abonos.error.message);
  if (gestiones.error) throw new Error(gestiones.error.message);
  if (servicios.error) throw new Error(servicios.error.message);

  // Servicios del catálogo con categoría explícita: mandan sobre la
  // clasificación por palabras clave.
  const categorias = new Map<string, CategoriaServicio>(
    (servicios.data ?? []).map((s) => [
      claveCatalogo(s.nombre),
      s.categoria as CategoriaServicio,
    ]),
  );

  return enriquecerVentas(
    (ventas.data ?? []) as CarteraVenta[],
    (abonos.data ?? []) as CarteraAbono[],
    (gestiones.data ?? []) as CarteraGestion[],
    categorias,
  );
}

/** Catálogos para los desplegables del formulario de registro. */
export async function cargarCatalogos() {
  const sb = getSupabaseAdmin();

  const [comerciales, servicios] = await Promise.all([
    sb.from("cartera_comerciales").select("*").order("nombre", { ascending: true }),
    sb.from("cartera_servicios").select("*").order("nombre", { ascending: true }),
  ]);

  if (comerciales.error) throw new Error(comerciales.error.message);
  if (servicios.error) throw new Error(servicios.error.message);

  return {
    comerciales: comerciales.data ?? [],
    servicios: (servicios.data ?? []) as CarteraServicio[],
  };
}
