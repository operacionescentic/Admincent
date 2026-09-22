import { NextResponse } from "next/server";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { abonoSchema } from "@/lib/cartera/schemas";

export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const ventaId = new URL(req.url).searchParams.get("ventaId");
  const sb = getSupabaseAdmin();

  let query = sb.from("cartera_abonos").select("*").order("fecha", { ascending: false });
  if (ventaId) {
    const n = Number(ventaId);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json({ error: "ventaId inválido" }, { status: 400 });
    }
    query = query.eq("venta_id", n);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const json = await req.json().catch(() => null);
  const parsed = abonoSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("cartera_abonos").insert(parsed.data).select().single();

  if (error) {
    // FK violation: la venta no existe.
    if (error.code === "23503") {
      return NextResponse.json({ error: "El registro de cartera no existe" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
