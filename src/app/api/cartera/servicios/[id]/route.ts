import { NextResponse } from "next/server";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { servicioSchema } from "@/lib/cartera/schemas";

type Ctx = { params: Promise<{ id: string }> };

const parseId = async (ctx: Ctx) => {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** `?propagar=1` renombra el servicio también en los registros de cartera. */
export async function PUT(req: Request, ctx: Ctx) {
  const { response } = await requireSession();
  if (response) return response;

  const id = await parseId(ctx);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = servicioSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const previo = await sb.from("cartera_servicios").select("nombre").eq("id", id).maybeSingle();
  if (previo.error) return NextResponse.json({ error: previo.error.message }, { status: 500 });
  if (!previo.data) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });

  const { data, error } = await sb
    .from("cartera_servicios")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe un servicio con ese nombre" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let propagados = 0;
  const propagar = new URL(req.url).searchParams.get("propagar") === "1";
  if (propagar && previo.data.nombre !== parsed.data.nombre) {
    const { data: tocados, error: errProp } = await sb
      .from("cartera_ventas")
      .update({ servicio: parsed.data.nombre })
      .ilike("servicio", previo.data.nombre)
      .select("id");
    if (errProp) return NextResponse.json({ error: errProp.message }, { status: 500 });
    propagados = tocados?.length ?? 0;
  }

  return NextResponse.json({ ...data, propagados });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { response } = await requireSession();
  if (response) return response;

  const id = await parseId(ctx);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const actual = await sb.from("cartera_servicios").select("nombre").eq("id", id).maybeSingle();
  if (actual.error) return NextResponse.json({ error: actual.error.message }, { status: 500 });
  if (!actual.data) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });

  const forzar = new URL(req.url).searchParams.get("forzar") === "1";
  const { count } = await sb
    .from("cartera_ventas")
    .select("id", { count: "exact", head: true })
    .ilike("servicio", actual.data.nombre);
  const usos = count ?? 0;

  if (usos > 0 && !forzar) {
    return NextResponse.json(
      {
        error: `${usos} ${usos === 1 ? "registro usa" : "registros usan"} este servicio. Desactívalo para sacarlo de los desplegables sin perder el historial.`,
        usos,
      },
      { status: 409 },
    );
  }

  const { error } = await sb.from("cartera_servicios").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
