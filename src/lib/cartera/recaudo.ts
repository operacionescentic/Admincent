/**
 * Lógica para cálculo, agregación y filtrado por semanas del recaudo (abonos) de cartera.
 */
import { parseMonto } from "./normalize";
import {
  fechaHoyBogota,
  obtenerSemana,
  parseDateIso,
  toDateIso,
} from "./tareas";
import type { CarteraAbono, VentaEnriquecida } from "./types";

export type AbonoConVenta = CarteraAbono & {
  cliente: string;
  vendedor: string;
  servicio: string | null;
  totalPagar: number;
  saldo: number;
};

export type DiaRecaudo = {
  fechaIso: string;
  diaNombre: string;
  diaNumero: number;
  mesNombre: string;
  esHoy: boolean;
  total: number;
  cantidad: number;
  abonos: AbonoConVenta[];
};

export type RecaudoSemana = {
  lunesIso: string;
  domingoIso: string;
  diasIso: string[];
  label: string;
  esSemanaActual: boolean;
  totalRecaudado: number;
  cantidadAbonos: number;
  abonos: AbonoConVenta[];
  porDia: DiaRecaudo[];
  porVendedor: {
    vendedor: string;
    total: number;
    cantidad: number;
  }[];
  comparativa?: {
    totalAnterior: number;
    diferencia: number;
    pctCambio: number | null; // e.g. +25.5 or -10.2
  };
};

export type SemanaOpcion = {
  lunesIso: string;
  domingoIso: string;
  label: string;
  esSemanaActual: boolean;
  weekOffset: number;
  totalRecaudado: number;
  cantidadAbonos: number;
};

const DIAS_NOMBRES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const MESES_ABR = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

/**
 * Devuelve el lunes ISO (YYYY-MM-DD) de la semana a la que pertenece la fecha dada.
 */
export function obtenerLunesDeFecha(fechaIso: string): string {
  const ref = parseDateIso(fechaIso);
  const diaSemana = ref.getDay();
  const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(ref);
  lunes.setDate(ref.getDate() + diffLunes);
  return toDateIso(lunes);
}

/**
 * Aplana todos los abonos de las ventas agregando los datos del cliente, vendedor y servicio.
 */
export function extraerTodosLosAbonos(ventas: VentaEnriquecida[]): AbonoConVenta[] {
  const list: AbonoConVenta[] = [];
  for (const v of ventas) {
    if (!v.abonos || v.abonos.length === 0) continue;
    for (const a of v.abonos) {
      list.push({
        ...a,
        cliente: v.cliente,
        vendedor: v.vendedorNorm,
        servicio: v.servicio,
        totalPagar: v.totalPagar,
        saldo: v.saldo,
      });
    }
  }
  return list.sort((a, b) => {
    const d = b.fecha.localeCompare(a.fecha);
    if (d !== 0) return d;
    return parseMonto(b.valor) - parseMonto(a.valor);
  });
}

/**
 * Calcula el recaudo para una semana específica.
 * Puede recibir el `lunesIso` deseado o un `weekOffset` relativo a la fecha actual.
 */
export function calcularRecaudoSemana(
  ventas: VentaEnriquecida[],
  params?: { lunesIso?: string; weekOffset?: number; fechaReferencia?: string },
): RecaudoSemana {
  const hoyIso = params?.fechaReferencia ?? fechaHoyBogota();
  let semana;

  if (params?.lunesIso) {
    semana = obtenerSemana(params.lunesIso, 0);
  } else {
    semana = obtenerSemana(hoyIso, params?.weekOffset ?? 0);
  }

  const { lunesIso, domingoIso, diasIso, label, esSemanaActual } = semana;
  const todosAbonos = extraerTodosLosAbonos(ventas);

  // Filtrar abonos que caen en los días de esta semana
  const abonosSemana = todosAbonos.filter((a) => diasIso.includes(a.fecha));
  const totalRecaudado = abonosSemana.reduce((sum, a) => sum + parseMonto(a.valor), 0);
  const cantidadAbonos = abonosSemana.length;

  // Desglose por cada uno de los 7 días
  const porDia: DiaRecaudo[] = diasIso.map((iso) => {
    const date = parseDateIso(iso);
    const dayOfWeek = date.getDay();
    const abonosDia = abonosSemana.filter((a) => a.fecha === iso);
    const totalDia = abonosDia.reduce((sum, a) => sum + parseMonto(a.valor), 0);

    return {
      fechaIso: iso,
      diaNombre: DIAS_NOMBRES[dayOfWeek],
      diaNumero: date.getDate(),
      mesNombre: MESES_ABR[date.getMonth()],
      esHoy: iso === hoyIso,
      total: totalDia,
      cantidad: abonosDia.length,
      abonos: abonosDia,
    };
  });

  // Desglose por vendedor
  const vendedorMap = new Map<string, { total: number; cantidad: number }>();
  for (const a of abonosSemana) {
    const vend = a.vendedor || "Sin asignar";
    const actual = vendedorMap.get(vend) ?? { total: 0, cantidad: 0 };
    actual.total += parseMonto(a.valor);
    actual.cantidad += 1;
    vendedorMap.set(vend, actual);
  }

  const porVendedor = Array.from(vendedorMap.entries())
    .map(([vendedor, data]) => ({ vendedor, ...data }))
    .sort((a, b) => b.total - a.total);

  // Calcular comparativa con la semana anterior (-1 semana)
  const semanaAnterior = obtenerSemana(lunesIso, -1);
  const abonosAnterior = todosAbonos.filter((a) =>
    semanaAnterior.diasIso.includes(a.fecha),
  );
  const totalAnterior = abonosAnterior.reduce(
    (sum, a) => sum + parseMonto(a.valor),
    0,
  );
  const diferencia = totalRecaudado - totalAnterior;
  const pctCambio =
    totalAnterior > 0
      ? Math.round((diferencia / totalAnterior) * 1000) / 10
      : null;

  return {
    lunesIso,
    domingoIso,
    diasIso,
    label,
    esSemanaActual,
    totalRecaudado,
    cantidadAbonos,
    abonos: abonosSemana,
    porDia,
    porVendedor,
    comparativa: {
      totalAnterior,
      diferencia,
      pctCambio,
    },
  };
}

/**
 * Obtiene la lista de todas las semanas que tienen al menos un abono registrado,
 * asegurando que la semana actual siempre esté disponible para selección.
 */
export function obtenerSemanasConRecaudo(
  ventas: VentaEnriquecida[],
  fechaReferenciaIso: string = fechaHoyBogota(),
): SemanaOpcion[] {
  const todosAbonos = extraerTodosLosAbonos(ventas);
  const lunesActualIso = obtenerLunesDeFecha(fechaReferenciaIso);

  // Agrupar abonos por su semana (representada por su lunesIso)
  const semanasMap = new Map<
    string,
    { total: number; cantidad: number }
  >();

  // Garantizar que la semana actual siempre esté presente en el mapa
  semanasMap.set(lunesActualIso, { total: 0, cantidad: 0 });

  for (const a of todosAbonos) {
    const lunes = obtenerLunesDeFecha(a.fecha);
    const actual = semanasMap.get(lunes) ?? { total: 0, cantidad: 0 };
    actual.total += parseMonto(a.valor);
    actual.cantidad += 1;
    semanasMap.set(lunes, actual);
  }

  const msPorSemana = 1000 * 60 * 60 * 24 * 7;
  const tActual = parseDateIso(lunesActualIso).getTime();

  const opciones: SemanaOpcion[] = Array.from(semanasMap.entries()).map(
    ([lunesIso, datos]) => {
      const info = obtenerSemana(lunesIso, 0);
      const diffMs = parseDateIso(lunesIso).getTime() - tActual;
      const weekOffset = Math.round(diffMs / msPorSemana);

      return {
        lunesIso,
        domingoIso: info.domingoIso,
        label: info.label,
        esSemanaActual: lunesIso === lunesActualIso,
        weekOffset,
        totalRecaudado: datos.total,
        cantidadAbonos: datos.cantidad,
      };
    },
  );

  // Ordenar cronológicamente descendente (las más recientes primero)
  return opciones.sort((a, b) => b.lunesIso.localeCompare(a.lunesIso));
}
