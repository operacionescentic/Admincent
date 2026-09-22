import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireSession } from "@/lib/nomina/auth";
import { cargarCartera } from "@/lib/cartera/db";
import {
  aplicarFiltros,
  calcularKpis,
  porCategoria,
  porEstado,
  porRangoMora,
  porVendedor,
  topSaldos,
  type Grupo,
} from "@/lib/cartera/aggregate";

const MONEDA = '"$"#,##0';

/** Exporta la cartera filtrada como .xlsx: hoja de registros + hoja de resumen. */
export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const params = new URL(req.url).searchParams;

  let ventas;
  try {
    ventas = aplicarFiltros(await cargarCartera(), {
      vendedor: params.get("vendedor") ?? undefined,
      estado: params.get("estado") ?? undefined,
      categoria: params.get("categoria") ?? undefined,
      rango: params.get("rango") ?? undefined,
      busqueda: params.get("q") ?? undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error cargando la cartera";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Nominapp — Centic SAS";
  wb.created = new Date();

  // --- Hoja 1: registros ---
  const ws = wb.addWorksheet("Cartera");
  ws.columns = [
    { header: "Cliente", key: "cliente", width: 34 },
    { header: "Vendedor", key: "vendedor", width: 14 },
    { header: "Servicio", key: "servicio", width: 24 },
    { header: "Categoría", key: "categoria", width: 14 },
    { header: "Modalidad", key: "modalidad", width: 16 },
    { header: "Total a pagar", key: "total", width: 15, style: { numFmt: MONEDA } },
    { header: "Abonado", key: "abonado", width: 15, style: { numFmt: MONEDA } },
    { header: "Saldo", key: "saldo", width: 15, style: { numFmt: MONEDA } },
    { header: "Estado cartera", key: "estado", width: 24 },
    { header: "Meses en mora", key: "meses", width: 14 },
    { header: "Antigüedad", key: "rango", width: 18 },
    { header: "Compromiso de pago", key: "compromiso", width: 32 },
    { header: "Nota de gestión", key: "nota", width: 28 },
    { header: "Fecha contacto", key: "fecha", width: 14 },
    { header: "Última gestión", key: "ultima", width: 14 },
    { header: "Próxima acción", key: "proxima", width: 14 },
  ];

  for (const v of ventas) {
    ws.addRow({
      cliente: v.cliente,
      vendedor: v.vendedorNorm,
      servicio: v.servicio ?? "",
      categoria: v.categoriaServicio,
      modalidad: v.modalidad ?? "",
      total: v.totalPagar,
      abonado: v.abonado,
      saldo: v.saldo,
      estado: v.estadoCarteraNorm,
      meses: v.meses_mora ?? "",
      rango: v.rangoMora,
      compromiso: v.compromiso_pago ?? "",
      nota: v.nota_gestion ?? "",
      fecha: v.fecha_contacto ?? "",
      ultima: v.ultimaGestion?.fecha ?? "",
      proxima: v.ultimaGestion?.proxima_accion ?? "",
    });
  }

  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF44336" },
  };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columnCount } };

  // --- Hoja 2: resumen ---
  const resumen = wb.addWorksheet("Resumen");
  const kpis = calcularKpis(ventas);

  resumen.columns = [
    { header: "", key: "a", width: 34 },
    { header: "", key: "b", width: 18 },
    { header: "", key: "c", width: 14 },
  ];

  const titulo = (texto: string) => {
    const fila = resumen.addRow({ a: texto });
    fila.font = { bold: true, size: 12 };
    return fila;
  };

  titulo("DASHBOARD DE COBRANZAS — CENTIC SAS");
  resumen.addRow({ a: `Generado: ${new Date().toISOString().slice(0, 10)}` });
  resumen.addRow({});

  const kpi = (label: string, valor: number | string, formato?: string) => {
    const fila = resumen.addRow({ a: label, b: valor });
    if (formato) fila.getCell("b").numFmt = formato;
  };

  kpi("Cartera total pendiente", kpis.carteraTotal, MONEDA);
  kpi("N° de registros con saldo", kpis.registrosConSaldo);
  kpi("Saldo promedio por registro", kpis.saldoPromedio, MONEDA);
  kpi("% cartera al día", kpis.pctAlDia, "0%");
  kpi("% cartera en gestión / riesgo", kpis.pctEnRiesgo, "0%");
  kpi("Total facturado", kpis.totalFacturado, MONEDA);
  kpi("Total recaudado (abonos)", kpis.totalRecaudado, MONEDA);
  kpi("% de recaudo", kpis.pctRecaudo, "0%");

  const tabla = (titulo_: string, grupos: Grupo[]) => {
    resumen.addRow({});
    titulo(titulo_);
    const encabezado = resumen.addRow({ a: "Etiqueta", b: "Cartera ($)", c: "N° registros" });
    encabezado.font = { bold: true };
    for (const g of grupos) {
      const fila = resumen.addRow({ a: g.etiqueta, b: g.cartera, c: g.registros });
      fila.getCell("b").numFmt = MONEDA;
    }
  };

  tabla("① Cartera por estado de gestión", porEstado(ventas));
  tabla("② Cartera por vendedor", porVendedor(ventas));
  tabla("③ Cartera por categoría de servicio", porCategoria(ventas));
  tabla("④ Antigüedad de mora", porRangoMora(ventas));

  resumen.addRow({});
  titulo("⑤ Top 10 registros con mayor saldo");
  const topHeader = resumen.addRow({ a: "Cliente", b: "Saldo ($)", c: "Vendedor" });
  topHeader.font = { bold: true };
  for (const v of topSaldos(ventas)) {
    const fila = resumen.addRow({ a: v.cliente, b: v.saldo, c: v.vendedorNorm });
    fila.getCell("b").numFmt = MONEDA;
  }

  const buffer = await wb.xlsx.writeBuffer();
  const nombre = `Cartera_Centic_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
