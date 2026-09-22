import { NextResponse } from "next/server";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { servicioSchema } from "@/lib/cartera/schemas";

export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const soloActivos = new URL(req.url).searchParams.get("activos") === "1";
  const sb = getSupabaseAdmin();

  let query = sb.from("cartera_servicios").select("*").order("nombre", { ascending: true });
  if (soloActivos) query = query.eq("activo", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const json = await req.json().catch(() => null);
  const parsed = servicioSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("cartera_servicios").insert(parsed.data).select().single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe un servicio con ese nombre" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
