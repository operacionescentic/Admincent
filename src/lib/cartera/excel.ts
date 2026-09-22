/**
 * Lectura del Excel de cobranzas (hoja "Ventas") para el importador.
 * Server-only: exceljs no debe entrar al bundle del cliente.
 */
import ExcelJS from "exceljs";
import { parseEntero, parseMonto, parseMontoOpcional } from "./normalize";

export type FilaImportada = {
  fila: number;
  cliente: string;
  fecha_contacto: string | null;
  vendedor: string | null;
  servicio: string | null;
  modalidad: string | null;
  nota_gestion: string | null;
  valor_mora: number | null;
  total_pagar: number;
  compromiso_pago: string | null;
  meses_mora: number | null;
  estado_cobro: string | null;
};

export type ResultadoParseo = {
  hoja: string;
  filas: FilaImportada[];
  /** Filas descartadas y el motivo, para mostrarlas en el preview. */
  descartadas: { fila: number; motivo: string }[];
};

/** Desenvuelve el valor de una celda: fórmulas, texto enriquecido, hipervínculos. */
function valorCelda(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v == null) return null;
  if (typeof v !== "object") return v;
  if (v instanceof Date) return v;
  if ("formula" in v) return (v as ExcelJS.CellFormulaValue).result ?? null;
  if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
  if ("text" in v) return (v as ExcelJS.CellHyperlinkValue).text;
  if ("error" in v) return null;
  return null;
}

const texto = (v: unknown): string | null => {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return null;
  // Marcadores que el archivo original usa como "sin dato".
  if (s === "-" || s.toUpperCase() === "X") return null;
  return s;
};

function fecha(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Serial de Excel: días desde 1899-12-30 en UTC.
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Alias de encabezado → campo. Se compara por "incluye" sobre el texto
 * normalizado, así que tolera los espacios sobrantes del archivo original
 * ("Nombre completo ", "Fecha de compromiso de pago ").
 */
const ALIAS: { campo: keyof FilaImportada; patrones: string[] }[] = [
  { campo: "cliente", patrones: ["nombre completo", "cliente", "nombre"] },
  { campo: "fecha_contacto", patrones: ["fecha del contacto", "fecha contacto"] },
  { campo: "vendedor", patrones: ["vendedor", "asesor"] },
  { campo: "servicio", patrones: ["servicio", "curso"] },
  // "Estado de cobro2" va antes que "Estado de cobro" para que la variante con
  // sufijo no se la lleve la modalidad, que comparte prefijo.
  { campo: "estado_cobro", patrones: ["estado de cobro2", "estado de cobro 2"] },
  { campo: "modalidad", patrones: ["estado de cobro", "modalidad"] },
  { campo: "nota_gestion", patrones: ["% interes de mora", "interes de mora", "gestion"] },
  { campo: "valor_mora", patrones: ["valor de interes de mora", "valor mora"] },
  { campo: "total_pagar", patrones: ["total a pagar", "total", "valor"] },
  { campo: "compromiso_pago", patrones: ["compromiso de pago", "compromiso"] },
  { campo: "meses_mora", patrones: ["meses en mora", "meses mora"] },
];

/**
 * Localiza la fila de encabezados y devuelve el índice de columna de cada campo.
 * El archivo original tiene los encabezados en la fila 1 y columnas auxiliares
 * (M–R) marcadas "AYUDA PARA DASHBOARD", que se ignoran.
 */
function mapearColumnas(ws: ExcelJS.Worksheet) {
  let filaEncabezado = 0;
  let encabezados: string[] = [];

  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const fila = ws.getRow(r);
    const celdas: string[] = [];
    for (let c = 1; c <= Math.max(ws.columnCount, 20); c++) {
      celdas[c] = sinTildes(String(valorCelda(fila.getCell(c)) ?? ""));
    }
    if (celdas.some((h) => h?.includes("nombre completo") || h === "cliente")) {
      filaEncabezado = r;
      encabezados = celdas;
      break;
    }
  }

  if (!filaEncabezado) return null;

  const mapa: Partial<Record<keyof FilaImportada, number>> = {};
  const usadas = new Set<number>();

  for (const { campo, patrones } of ALIAS) {
    for (const patron of patrones) {
      const idx = encabezados.findIndex(
        (h, i) =>
          h &&
          !usadas.has(i) &&
          !h.includes("ayuda para dashboard") &&
          h.includes(patron),
      );
      if (idx > 0) {
        mapa[campo] = idx;
        usadas.add(idx);
        break;
      }
    }
  }

  return { filaEncabezado, mapa };
}

export function parseCarteraWorkbook(wb: ExcelJS.Workbook): ResultadoParseo {
  const ws =
    wb.getWorksheet("Ventas") ??
    wb.worksheets.find((w) => w.state === "visible" && mapearColumnas(w)) ??
    wb.worksheets[0];

  if (!ws) throw new Error("El archivo no tiene hojas legibles.");

  const mapeo = mapearColumnas(ws);
  if (!mapeo) {
    throw new Error(
      `No se encontró la fila de encabezados en la hoja "${ws.name}". Debe existir una columna "Nombre completo" o "Cliente".`,
    );
  }

  const { filaEncabezado, mapa } = mapeo;
  const filas: FilaImportada[] = [];
  const descartadas: { fila: number; motivo: string }[] = [];

  const leer = (fila: ExcelJS.Row, campo: keyof FilaImportada) => {
    const col = mapa[campo];
    return col ? valorCelda(fila.getCell(col)) : null;
  };

  for (let r = filaEncabezado + 1; r <= ws.rowCount; r++) {
    const fila = ws.getRow(r);
    const cliente = texto(leer(fila, "cliente"));

    if (!cliente) {
      // Fila vacía: se ignora en silencio. Sólo se reporta si tiene algún dato.
      const tieneAlgo = (["total_pagar", "vendedor", "servicio"] as const).some(
        (c) => texto(leer(fila, c)) != null,
      );
      if (tieneAlgo) descartadas.push({ fila: r, motivo: "Sin nombre de cliente" });
      continue;
    }

    // Segunda fila de encabezados del archivo original ("Total depurado ($)"…).
    if (sinTildes(cliente).includes("nombre completo")) continue;

    filas.push({
      fila: r,
      cliente,
      fecha_contacto: fecha(leer(fila, "fecha_contacto")),
      vendedor: texto(leer(fila, "vendedor")),
      servicio: texto(leer(fila, "servicio")),
      modalidad: texto(leer(fila, "modalidad")),
      nota_gestion: texto(leer(fila, "nota_gestion")),
      valor_mora: parseMontoOpcional(leer(fila, "valor_mora")),
      total_pagar: parseMonto(leer(fila, "total_pagar")),
      compromiso_pago: texto(leer(fila, "compromiso_pago")),
      meses_mora: parseEntero(leer(fila, "meses_mora")),
      estado_cobro: texto(leer(fila, "estado_cobro")),
    });
  }

  return { hoja: ws.name, filas, descartadas };
}

export async function parseCarteraBuffer(buffer: ArrayBuffer): Promise<ResultadoParseo> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return parseCarteraWorkbook(wb);
}
