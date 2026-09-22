/**
 * Agregaciones del dashboard de cartera.
 *
 * Equivalen a los SUMIF/COUNTIF de la hoja "Dashboard" del Excel, pero
 * calculados sobre el saldo (total a pagar menos abonos) en vez del total bruto.
 * Sin abonos registrados el resultado es idéntico al del archivo original.
 */
import { CATEGORIAS_SERVICIO, ESTADOS_CARTERA, RANGOS_MORA } from "./types";
import type { EstadoCartera, VentaEnriquecida } from "./types";

export type Grupo = {
  etiqueta: string;
  cartera: number;
  registros: number;
};

export type Filtros = {
  vendedor?: string;
  estado?: string;
  categoria?: string;
  rango?: string;
  busqueda?: string;
};

export function aplicarFiltros(
  ventas: VentaEnriquecida[],
  filtros: Filtros,
): VentaEnriquecida[] {
  const q = filtros.busqueda?.trim().toLowerCase();

  return ventas.filter((v) => {
    if (filtros.vendedor && v.vendedorNorm !== filtros.vendedor) return false;
    if (filtros.estado && v.estadoCarteraNorm !== filtros.estado) return false;
    if (filtros.categoria && v.categoriaServicio !== filtros.categoria) return false;
    if (filtros.rango && v.rangoMora !== filtros.rango) return false;
    if (q) {
      const heno = [v.cliente, v.vendedorNorm, v.servicio, v.compromiso_pago, v.notas]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!heno.includes(q)) return false;
    }
    return true;
  });
}

export type Kpis = {
  carteraTotal: number;
  registrosConSaldo: number;
  saldoPromedio: number;
  pctAlDia: number;
  pctEnRiesgo: number;
  totalFacturado: number;
  totalRecaudado: number;
  pctRecaudo: number;
  mayorSaldo: VentaEnriquecida | null;
};

export function calcularKpis(ventas: VentaEnriquecida[]): Kpis {
  const conSaldo = ventas.filter((v) => v.saldo > 0);
  const carteraTotal = ventas.reduce((a, v) => a + v.saldo, 0);
  const totalFacturado = ventas.reduce((a, v) => a + v.totalPagar, 0);
  const totalRecaudado = ventas.reduce((a, v) => a + v.abonado, 0);

  const alDia = conSaldo.filter((v) => v.estadoCarteraNorm === "Al día").length;
  const pctAlDia = conSaldo.length === 0 ? 0 : alDia / conSaldo.length;

  const mayorSaldo =
    conSaldo.length === 0
      ? null
      : conSaldo.reduce((max, v) => (v.saldo > max.saldo ? v : max));

  return {
    carteraTotal,
    registrosConSaldo: conSaldo.length,
    saldoPromedio: conSaldo.length === 0 ? 0 : carteraTotal / conSaldo.length,
    pctAlDia,
    pctEnRiesgo: conSaldo.length === 0 ? 0 : 1 - pctAlDia,
    totalFacturado,
    totalRecaudado,
    pctRecaudo: totalFacturado === 0 ? 0 : totalRecaudado / totalFacturado,
    mayorSaldo,
  };
}

function agrupar(
  ventas: VentaEnriquecida[],
  clave: (v: VentaEnriquecida) => string,
  ordenFijo?: readonly string[],
): Grupo[] {
  const mapa = new Map<string, Grupo>();

  for (const v of ventas) {
    const etiqueta = clave(v);
    const actual = mapa.get(etiqueta);
    if (actual) {
      actual.cartera += v.saldo;
      actual.registros += 1;
    } else {
      mapa.set(etiqueta, { etiqueta, cartera: v.saldo, registros: 1 });
    }
  }

  if (ordenFijo) {
    // Respeta el orden del Excel y omite las categorías sin registros.
    const ordenados = ordenFijo
      .map((etiqueta) => mapa.get(etiqueta))
      .filter((g): g is Grupo => g != null);
    // Cualquier etiqueta fuera del orden fijo va al final.
    const extras = [...mapa.values()].filter((g) => !ordenFijo.includes(g.etiqueta));
    return [...ordenados, ...extras];
  }

  return [...mapa.values()].sort((a, b) => b.cartera - a.cartera);
}

/** ① Cartera por estado de gestión. */
export const porEstado = (ventas: VentaEnriquecida[]) =>
  agrupar(ventas, (v) => v.estadoCarteraNorm, ESTADOS_CARTERA);

/** ② Cartera por vendedor, de mayor a menor. */
export const porVendedor = (ventas: VentaEnriquecida[]) =>
  agrupar(ventas, (v) => v.vendedorNorm);

/** ③ Cartera por categoría de servicio. */
export const porCategoria = (ventas: VentaEnriquecida[]) =>
  agrupar(ventas, (v) => v.categoriaServicio, CATEGORIAS_SERVICIO);

/** ④ Antigüedad de mora. */
export const porRangoMora = (ventas: VentaEnriquecida[]) =>
  agrupar(ventas, (v) => v.rangoMora, RANGOS_MORA);

/** ⑤ Top N registros con mayor saldo pendiente. */
export function topSaldos(ventas: VentaEnriquecida[], n = 10): VentaEnriquecida[] {
  return ventas
    .filter((v) => v.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, n);
}

/** Listas de opciones para los selectores de filtro, según los datos cargados. */
export function opcionesFiltro(ventas: VentaEnriquecida[]) {
  const vendedores = [...new Set(ventas.map((v) => v.vendedorNorm))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const categorias = CATEGORIAS_SERVICIO.filter((c) =>
    ventas.some((v) => v.categoriaServicio === c),
  );
  const estados = ESTADOS_CARTERA.filter((e) =>
    ventas.some((v) => v.estadoCarteraNorm === e),
  );
  const rangos = RANGOS_MORA.filter((r) => ventas.some((v) => v.rangoMora === r));

  return { vendedores, categorias, estados, rangos };
}

export const COLOR_ESTADO: Record<EstadoCartera, string> = {
  "Al día": "#22c55e",
  "Pendiente / Compromiso": "#f59e0b",
  "Sin respuesta / Inactivo": "#a855f7",
  "Sin gestionar": "#f44336",
};

/** Registros cuya próxima acción de cobro ya venció o vence hoy. */
export function gestionesVencidas(ventas: VentaEnriquecida[], hoy = new Date()): VentaEnriquecida[] {
  const hoyIso = hoy.toISOString().slice(0, 10);
  return ventas.filter(
    (v) =>
      v.saldo > 0 &&
      v.ultimaGestion?.proxima_accion != null &&
      v.ultimaGestion.proxima_accion <= hoyIso,
  );
}
