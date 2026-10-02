/**
 * Lógica de negocio para tareas de cobranza y agenda semanal.
 * Permite identificar los cobros programados para hoy, para la semana y los vencidos.
 */
import type { CanalGestion, ResultadoGestion, VentaEnriquecida } from "./types";

export type OrigenTarea = "proxima_accion" | "compromiso_pago" | "nota";

export type TareaCobro = {
  id: string;
  venta: VentaEnriquecida;
  fecha: string; // YYYY-MM-DD
  origen: OrigenTarea;
  esHoy: boolean;
  esVencida: boolean;
  esEstaSemana: boolean;
  diasDiferencia: number; // 0 = hoy, < 0 = días vencida, > 0 = días futuros
  detalle: string;
  canal?: CanalGestion;
  resultado?: ResultadoGestion;
};

export type DiaSemana = {
  fechaIso: string; // YYYY-MM-DD
  fechaDate: Date;
  diaNombre: string; // Lunes, Martes, etc.
  diaNumero: number; // 1..31
  mesNombre: string; // Octubre, etc.
  esHoy: boolean;
  tareas: TareaCobro[];
  totalMonto: number;
};

export type SemanaInfo = {
  fechaInicio: string; // Lunes YYYY-MM-DD
  fechaFin: string; // Domingo YYYY-MM-DD
  label: string; // "28 Sep - 4 Oct, 2026"
  esSemanaActual: boolean;
  dias: DiaSemana[];
  todasLasTareas: TareaCobro[];
  totalMonto: number;
};

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

const MESES_MAP: Record<string, number> = {
  ene: 0,
  enero: 0,
  feb: 1,
  febrero: 1,
  mar: 2,
  marzo: 2,
  abr: 3,
  abril: 3,
  may: 4,
  mayo: 4,
  jun: 5,
  junio: 5,
  jul: 6,
  julio: 6,
  ago: 7,
  agosto: 7,
  sep: 8,
  sept: 8,
  septiembre: 8,
  oct: 9,
  octubre: 9,
  nov: 10,
  noviembre: 10,
  dic: 11,
  diciembre: 11,
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

/**
 * Devuelve la fecha actual en formato YYYY-MM-DD en zona horaria Colombia (UTC-5).
 */
export function fechaHoyBogota(): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Parsea un string YYYY-MM-DD en un objeto Date en hora local a las 00:00:00.
 */
export function parseDateIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Convierte un objeto Date a formato ISO YYYY-MM-DD.
 */
export function toDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Extrae posibles fechas de un texto libre (ej. compromisos de pago en Excel:
 * "ABONO 5 MAYO", "15 OCT", "2026-10-01", "01/10/2026", etc.).
 */
export function extraerFechasDeTexto(text: unknown, referenceYear?: number): string[] {
  if (text == null) return [];
  if (text instanceof Date) {
    return [toDateIso(text)];
  }
  const str = String(text).trim();
  if (!str || str === "-" || str.toUpperCase() === "X") return [];

  const anioRef = referenceYear ?? new Date().getFullYear();
  const resultados: string[] = [];

  // 1. Formato ISO YYYY-MM-DD
  const isoMatch = str.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    resultados.push(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
  }

  // 2. Formato DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = str.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, "0");
    const m = dmyMatch[2].padStart(2, "0");
    const y = dmyMatch[3];
    resultados.push(`${y}-${m}-${d}`);
  }

  // 3. Meses nombrados en español: "15 OCT", "10ABRIL", "5 de mayo"
  const regex = /(\d{1,2})\s*(?:de\s*)?([a-záéíóú]+)(?:\s*(?:de\s*)?(\d{4}))?/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(str)) !== null) {
    const day = parseInt(match[1], 10);
    const monthKey = match[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const year = match[3] ? parseInt(match[3], 10) : anioRef;
    if (day >= 1 && day <= 31 && MESES_MAP[monthKey] !== undefined) {
      const m = String(MESES_MAP[monthKey] + 1).padStart(2, "0");
      const d = String(day).padStart(2, "0");
      resultados.push(`${year}-${m}-${d}`);
    }
  }

  return [...new Set(resultados)];
}

/**
 * Calcula la diferencia en días calendario entre dos fechas ISO (a - b).
 */
export function diferenciaDias(fechaIsoA: string, fechaIsoB: string): number {
  const a = parseDateIso(fechaIsoA);
  const b = parseDateIso(fechaIsoB);
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.round((a.getTime() - b.getTime()) / msPorDia);
}

/**
 * Obtiene todas las tareas de cobranza a partir de las ventas con saldo pendiente.
 */
export function obtenerTareasCobro(
  ventas: VentaEnriquecida[],
  fechaHoy: string = fechaHoyBogota(),
): TareaCobro[] {
  const tareas: TareaCobro[] = [];
  const anioActual = parseDateIso(fechaHoy).getFullYear();

  for (const venta of ventas) {
    // Solo clientes que tengan saldo pendiente de cobro
    if (venta.saldo <= 0) continue;

    let fechaTarea: string | null = null;
    let origen: OrigenTarea = "proxima_accion";
    let detalle = "";
    let canal: CanalGestion | undefined;
    let resultado: ResultadoGestion | undefined;

    // Prioridad 1: Próxima acción definida en la última gestión
    if (venta.ultimaGestion?.proxima_accion) {
      fechaTarea = venta.ultimaGestion.proxima_accion;
      origen = "proxima_accion";
      canal = venta.ultimaGestion.canal;
      resultado = venta.ultimaGestion.resultado;
      detalle =
        venta.ultimaGestion.nota ||
        `Próxima acción vía ${venta.ultimaGestion.canal} acordada`;
    } else {
      // Prioridad 2: Fechas detectadas en compromiso_pago
      const fechasCompromiso = extraerFechasDeTexto(venta.compromiso_pago, anioActual);
      if (fechasCompromiso.length > 0) {
        // Tomamos la fecha más relevante (la primera próxima o la última registrada)
        fechaTarea = fechasCompromiso[0];
        origen = "compromiso_pago";
        detalle = `Compromiso: ${venta.compromiso_pago}`;
      } else {
        // Prioridad 3: Fechas en notas de gestión
        const fechasNota = extraerFechasDeTexto(venta.nota_gestion, anioActual);
        if (fechasNota.length > 0) {
          fechaTarea = fechasNota[0];
          origen = "nota";
          detalle = `Anotación: ${venta.nota_gestion}`;
        }
      }
    }

    if (!fechaTarea) continue;

    const diff = diferenciaDias(fechaTarea, fechaHoy);
    const esHoy = diff === 0;
    const esVencida = diff < 0;

    tareas.push({
      id: `${venta.id}-${fechaTarea}-${origen}`,
      venta,
      fecha: fechaTarea,
      origen,
      esHoy,
      esVencida,
      esEstaSemana: false, // se calcula en la vista de semana
      diasDiferencia: diff,
      detalle,
      canal,
      resultado,
    });
  }

  // Ordenar: primero las de hoy, luego por fecha ascendente
  return tareas.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Obtiene la información de la semana (Lunes a Domingo) para una fecha dada o con un offset de semanas.
 * weekOffset = 0 (semana actual), -1 (semana anterior), +1 (semana siguiente).
 */
export function obtenerSemana(
  fechaReferenciaIso: string = fechaHoyBogota(),
  weekOffset: number = 0,
): {
  lunesIso: string;
  domingoIso: string;
  diasIso: string[];
  label: string;
  esSemanaActual: boolean;
} {
  const ref = parseDateIso(fechaReferenciaIso);
  if (weekOffset !== 0) {
    ref.setDate(ref.getDate() + weekOffset * 7);
  }

  // En JS: Domingo = 0, Lunes = 1, ..., Sábado = 6.
  // Queremos que la semana empiece el Lunes (1).
  const diaSemana = ref.getDay();
  const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

  const lunes = new Date(ref);
  lunes.setDate(ref.getDate() + diffLunes);

  const diasIso: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    diasIso.push(toDateIso(d));
  }

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const lunesIso = toDateIso(lunes);
  const domingoIso = toDateIso(domingo);

  // Formato: "28 Sep - 4 Oct, 2026"
  const lDia = lunes.getDate();
  const lMes = MESES_ABR[lunes.getMonth()];
  const dDia = domingo.getDate();
  const dMes = MESES_ABR[domingo.getMonth()];
  const dAnio = domingo.getFullYear();

  const label =
    lunes.getMonth() === domingo.getMonth()
      ? `${lDia} al ${dDia} de ${dMes}, ${dAnio}`
      : `${lDia} ${lMes} al ${dDia} ${dMes}, ${dAnio}`;

  const hoyIso = fechaHoyBogota();
  const esSemanaActual = diasIso.includes(hoyIso);

  return {
    lunesIso,
    domingoIso,
    diasIso,
    label,
    esSemanaActual,
  };
}

/**
 * Construye la estructura completa de la semana agrupando las tareas por cada uno de los 7 días.
 */
export function construirSemanaInfo(
  tareas: TareaCobro[],
  fechaReferenciaIso: string = fechaHoyBogota(),
  weekOffset: number = 0,
): SemanaInfo {
  const hoyIso = fechaHoyBogota();
  const { lunesIso, domingoIso, diasIso, label, esSemanaActual } = obtenerSemana(
    fechaReferenciaIso,
    weekOffset,
  );

  const tareasPorDia = new Map<string, TareaCobro[]>();
  for (const iso of diasIso) {
    tareasPorDia.set(iso, []);
  }

  const todasLasTareasSemana: TareaCobro[] = [];

  for (const t of tareas) {
    if (diasIso.includes(t.fecha)) {
      t.esEstaSemana = true;
      todasLasTareasSemana.push(t);
      const list = tareasPorDia.get(t.fecha);
      if (list) list.push(t);
    }
  }

  const dias: DiaSemana[] = diasIso.map((iso) => {
    const date = parseDateIso(iso);
    const dayOfWeek = date.getDay(); // 0..6
    const tareasDia = tareasPorDia.get(iso) ?? [];
    const totalMonto = tareasDia.reduce((acc, t) => acc + t.venta.saldo, 0);

    return {
      fechaIso: iso,
      fechaDate: date,
      diaNombre: DIAS_NOMBRES[dayOfWeek],
      diaNumero: date.getDate(),
      mesNombre: MESES_ABR[date.getMonth()],
      esHoy: iso === hoyIso,
      tareas: tareasDia,
      totalMonto,
    };
  });

  const totalMonto = todasLasTareasSemana.reduce((acc, t) => acc + t.venta.saldo, 0);

  return {
    fechaInicio: lunesIso,
    fechaFin: domingoIso,
    label,
    esSemanaActual,
    dias,
    todasLasTareas: todasLasTareasSemana,
    totalMonto,
  };
}
