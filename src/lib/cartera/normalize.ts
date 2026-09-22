/**
 * Normalización de los datos de cartera.
 *
 * Réplica en TypeScript de las columnas auxiliares M–R de la hoja "Ventas" del
 * archivo Dashboard_Cobranzas_Centic_SAS.xlsx. Se mantiene en código (y no como
 * columnas generadas en Postgres) para que las reglas se puedan ajustar sin
 * migrar la base.
 *
 * Diferencia deliberada con el Excel: las fórmulas originales buscaban las
 * palabras clave de gestión ("COMPROMISO", "PROCESO", "LLAMAR") en la columna F
 * ("Estado de cobro"), que en la práctica sólo contiene la modalidad del curso
 * ("Curso y examen" / "M+PO"). El texto de gestión vive en la columna G. Aquí se
 * buscan las palabras clave en ambas, por eso quedan muchos menos registros en
 * "Sin gestionar" que en el Excel.
 */
import type {
  CategoriaServicio,
  EstadoCartera,
  RangoMora,
  VentaEnriquecida,
  CarteraAbono,
  CarteraGestion,
  CarteraVenta,
} from "./types";

/**
 * Convierte a número los montos escritos como texto: "$1.000.000" → 1000000.
 * Réplica de la columna auxiliar M. Descarta los marcadores basura que usa el
 * archivo original ("X", "-", "no", "HASTA 30 MAY").
 */
export function parseMonto(value: unknown): number {
  return parseMontoOpcional(value) ?? 0;
}

/**
 * Igual que parseMonto pero devuelve null cuando la celda no contiene un monto.
 *
 * Sólo acepta cadenas formadas por dígitos y separadores de moneda. Un texto
 * como "HASTA 30 MAY" se descarta entero en vez de quedarse con el 30, igual
 * que hace el VALUE() del Excel (que devuelve error y cae al IFERROR).
 */
export function parseMontoOpcional(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim();
  if (!raw || !/\d/.test(raw)) return null;

  // Cualquier carácter que no sea dígito, separador, signo, espacio o $ invalida
  // la celda: no es un monto sino una anotación.
  if (/[^\d.,\-\s$]/.test(raw)) return null;

  const limpio = raw.replace(/[^\d,.-]/g, "");
  if (!limpio) return null;

  // Formato colombiano: "." separa miles, "," separa decimales.
  const normalizado = limpio.includes(",")
    ? limpio.replace(/\./g, "").replace(",", ".")
    : limpio.replace(/\.(?=\d{3}(\D|$))/g, "");

  const n = Number.parseFloat(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Entero de "meses en mora"; null para "X", "-", "PEAR", "Colvatel", etc. */
export function parseEntero(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
}

/** Réplica de la columna N: PROPER(TRIM(vendedor)). "ximena" → "Ximena". */
export function normalizarVendedor(value: unknown): string {
  const raw = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return "Sin asignar";
  return raw
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const sinTildes = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

const contiene = (haystack: unknown, needle: string) =>
  sinTildes(haystack).includes(needle);

/**
 * Réplica de la columna O: clasifica el estado de cartera por palabras clave.
 * El orden de evaluación importa y es el mismo del Excel.
 */
export function derivarEstadoCartera(venta: {
  modalidad?: string | null;
  nota_gestion?: string | null;
  estado_cobro?: string | null;
  compromiso_pago?: string | null;
}): EstadoCartera {
  const { modalidad, nota_gestion, estado_cobro, compromiso_pago } = venta;
  const campos = [estado_cobro, nota_gestion, modalidad];

  if (campos.some((c) => contiene(c, "AL DIA"))) return "Al día";

  if (campos.some((c) => contiene(c, "QUIETO") || contiene(c, "ESPERANDO"))) {
    return "Sin respuesta / Inactivo";
  }

  const esP = (c: unknown) => sinTildes(c).trim() === "P";
  const gestionado =
    campos.some(
      (c) =>
        contiene(c, "PENDIENTE") ||
        contiene(c, "COMPROMISO") ||
        contiene(c, "PROCESO") ||
        contiene(c, "LLAMAR") ||
        contiene(c, "ABONO"),
    ) ||
    contiene(compromiso_pago, "ABONO") ||
    campos.some(esP);

  return gestionado ? "Pendiente / Compromiso" : "Sin gestionar";
}

const CATEGORIAS: { match: string; categoria: CategoriaServicio }[] = [
  { match: "ITIL", categoria: "ITIL" },
  { match: "ISO 27001", categoria: "ISO 27001" },
  { match: "ISO27001", categoria: "ISO 27001" },
  { match: "ISO 42001", categoria: "ISO 42001" },
  { match: "ISO42001", categoria: "ISO 42001" },
  { match: "ISO", categoria: "Otras ISO" },
  { match: "SCRUM", categoria: "SCRUM" },
  { match: "BRIDGE", categoria: "BRIDGE" },
  { match: "CDS", categoria: "CDS" },
  { match: "TOGAF", categoria: "TOGAF" },
  { match: "DPI", categoria: "DPI" },
  { match: "DITS", categoria: "DITS" },
  { match: "AGILE", categoria: "AGILE" },
  { match: "CIBERSEGURIDAD", categoria: "Ciberseguridad" },
];

/** Clave de comparación de nombres de catálogo: sin tildes, sin caso, sin espacios de más. */
export const claveCatalogo = (nombre: unknown) =>
  sinTildes(nombre).replace(/\s+/g, " ").trim();

/**
 * Réplica de la columna P: agrupa los nombres de servicio en categorías.
 *
 * `override` es el mapa del catálogo de servicios (clave → categoría explícita).
 * Un servicio dado de alta con categoría manda sobre las palabras clave, que es
 * como se corrigen los casos que el Excel clasificaba mal ("ISO42001 27 JUL").
 */
export function categoriaServicio(
  servicio: unknown,
  override?: Map<string, CategoriaServicio>,
): CategoriaServicio {
  const explicita = override?.get(claveCatalogo(servicio));
  if (explicita) return explicita;

  const raw = sinTildes(servicio).trim();
  if (!raw) return "Sin definir";
  for (const { match, categoria } of CATEGORIAS) {
    if (raw.includes(match)) return categoria;
  }
  return "Otros";
}

/** Réplica de la columna Q: agrupa los meses en mora en rangos. */
export function rangoMora(meses: number | null | undefined): RangoMora {
  if (meses == null || !Number.isFinite(meses)) return "Sin dato registrado";
  if (meses <= 3) return "1-3 meses";
  if (meses <= 6) return "4-6 meses";
  return "+6 meses";
}

/**
 * Combina una venta con sus abonos y gestiones y calcula todos los campos
 * derivados que consume el dashboard.
 */
export function enriquecerVenta(
  venta: CarteraVenta,
  abonos: CarteraAbono[] = [],
  gestiones: CarteraGestion[] = [],
  categorias?: Map<string, CategoriaServicio>,
): VentaEnriquecida {
  const totalPagar = parseMonto(venta.total_pagar);
  const abonado = abonos.reduce((acc, a) => acc + parseMonto(a.valor), 0);

  const ultimaGestion =
    gestiones.length === 0
      ? null
      : gestiones.reduce((latest, g) => (g.fecha > latest.fecha ? g : latest));

  return {
    ...venta,
    totalPagar,
    abonado,
    saldo: Math.max(0, totalPagar - abonado),
    vendedorNorm: normalizarVendedor(venta.vendedor),
    estadoCarteraNorm: venta.estado_cartera ?? derivarEstadoCartera(venta),
    estadoManual: venta.estado_cartera != null,
    categoriaServicio: categoriaServicio(venta.servicio, categorias),
    rangoMora: rangoMora(venta.meses_mora),
    ultimaGestion,
  };
}

/** Agrupa abonos y gestiones por venta y enriquece todas las filas de una vez. */
export function enriquecerVentas(
  ventas: CarteraVenta[],
  abonos: CarteraAbono[] = [],
  gestiones: CarteraGestion[] = [],
  categorias?: Map<string, CategoriaServicio>,
): VentaEnriquecida[] {
  const abonosPorVenta = new Map<number, CarteraAbono[]>();
  for (const a of abonos) {
    const lista = abonosPorVenta.get(a.venta_id);
    if (lista) lista.push(a);
    else abonosPorVenta.set(a.venta_id, [a]);
  }

  const gestionesPorVenta = new Map<number, CarteraGestion[]>();
  for (const g of gestiones) {
    const lista = gestionesPorVenta.get(g.venta_id);
    if (lista) lista.push(g);
    else gestionesPorVenta.set(g.venta_id, [g]);
  }

  return ventas.map((v) =>
    enriquecerVenta(
      v,
      abonosPorVenta.get(v.id) ?? [],
      gestionesPorVenta.get(v.id) ?? [],
      categorias,
    ),
  );
}
