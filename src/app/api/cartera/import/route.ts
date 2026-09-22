import { NextResponse } from "next/server";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseCarteraBuffer } from "@/lib/cartera/excel";
import { importSchema } from "@/lib/cartera/schemas";
import {
  categoriaServicio,
  derivarEstadoCartera,
  normalizarVendedor,
  rangoMora,
} from "@/lib/cartera/normalize";

const MAX_BYTES = 10 * 1024 * 1024;
const LOTE = 200;

/**
 * Paso 1 — preview: recibe el .xlsx y devuelve las filas parseadas con sus
 * campos derivados, sin escribir nada. El cliente las muestra y confirma.
 */
export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo (campo 'file')" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo supera los 10 MB" }, { status: 413 });
  }
  if (!/\.xlsx?$/i.test(file.name)) {
    return NextResponse.json({ error: "Sólo se aceptan archivos .xlsx" }, { status: 415 });
  }

  try {
    const { hoja, filas, descartadas } = await parseCarteraBuffer(await file.arrayBuffer());

    return NextResponse.json({
      hoja,
      descartadas,
      filas: filas.map((f) => ({
        ...f,
        vendedorNorm: normalizarVendedor(f.vendedor),
        estadoCarteraNorm: derivarEstadoCartera(f),
        categoriaServicio: categoriaServicio(f.servicio),
        rangoMora: rangoMora(f.meses_mora),
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo leer el archivo";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

/**
 * Paso 2 — confirmación: inserta las filas ya validadas.
 * `reemplazar` vacía la tabla primero (arrastra abonos y gestiones por cascade).
 */
export async function PUT(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const json = await req.json().catch(() => null);
  const parsed = importSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { filas, reemplazar } = parsed.data;
  const sb = getSupabaseAdmin();

  if (reemplazar) {
    const { error } = await sb.from("cartera_ventas").delete().gte("id", 0);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Inserción por lotes: un solo insert de cientos de filas puede pasarse del
  // límite de payload de PostgREST.
  let insertadas = 0;
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    const { error, count } = await sb
      .from("cartera_ventas")
      .insert(lote, { count: "exact" });

    if (error) {
      return NextResponse.json(
        { error: error.message, insertadas },
        { status: 500 },
      );
    }
    insertadas += count ?? lote.length;
  }

  return NextResponse.json({ ok: true, insertadas, reemplazado: reemplazar });
}
