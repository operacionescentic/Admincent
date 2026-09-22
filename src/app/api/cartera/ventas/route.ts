import { NextResponse } from "next/server";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cargarCartera, VENTA_COLUMNS } from "@/lib/cartera/db";
import { ventaSchema } from "@/lib/cartera/schemas";

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  try {
    return NextResponse.json(await cargarCartera());
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error cargando la cartera";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const json = await req.json().catch(() => null);
  const parsed = ventaSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("cartera_ventas")
    .insert(parsed.data)
    .select(VENTA_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
