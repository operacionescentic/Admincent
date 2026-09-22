import { NextResponse } from "next/server";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { VENTA_COLUMNS } from "@/lib/cartera/db";
import { enriquecerVenta } from "@/lib/cartera/normalize";
import type { CarteraAbono, CarteraGestion, CarteraVenta } from "@/lib/cartera/types";
import { ventaSchema } from "@/lib/cartera/schemas";

type Ctx = { params: Promise<{ id: string }> };

const parseId = async (ctx: Ctx) => {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export async function GET(_req: Request, ctx: Ctx) {
  const { response } = await requireSession();
  if (response) return response;

  const id = await parseId(ctx);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const [venta, abonos, gestiones] = await Promise.all([
    sb.from("cartera_ventas").select(VENTA_COLUMNS).eq("id", id).maybeSingle(),
    sb.from("cartera_abonos").select("*").eq("venta_id", id).order("fecha", { ascending: false }),
    sb.from("cartera_gestiones").select("*").eq("venta_id", id).order("fecha", { ascending: false }),
  ]);

  if (venta.error) return NextResponse.json({ error: venta.error.message }, { status: 500 });
  if (!venta.data) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  return NextResponse.json({
    ...enriquecerVenta(
      venta.data as CarteraVenta,
      (abonos.data ?? []) as CarteraAbono[],
      (gestiones.data ?? []) as CarteraGestion[],
    ),
    abonos: abonos.data ?? [],
    gestiones: gestiones.data ?? [],
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  const { response } = await requireSession();
  if (response) return response;

  const id = await parseId(ctx);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

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
    .update(parsed.data)
    .eq("id", id)
    .select(VENTA_COLUMNS)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { response } = await requireSession();
  if (response) return response;

  const id = await parseId(ctx);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  // Los abonos y gestiones caen por ON DELETE CASCADE.
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("cartera_ventas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
