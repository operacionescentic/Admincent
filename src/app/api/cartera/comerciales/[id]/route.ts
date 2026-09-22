import { NextResponse } from "next/server";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { comercialSchema } from "@/lib/cartera/schemas";

type Ctx = { params: Promise<{ id: string }> };

const parseId = async (ctx: Ctx) => {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Cuántos registros de cartera usan este nombre de comercial. */
async function enUso(nombre: string) {
  const sb = getSupabaseAdmin();
  const { count } = await sb
    .from("cartera_ventas")
    .select("id", { count: "exact", head: true })
    .ilike("vendedor", nombre);
  return count ?? 0;
}

/**
 * `?propagar=1` renombra también el vendedor en los registros de cartera que
 * traían el nombre anterior. Es la vía para unificar "ximena" y "Ximena" sin
 * editar los registros uno por uno.
 */
export async function PUT(req: Request, ctx: Ctx) {
  const { response } = await requireSession();
  if (response) return response;

  const id = await parseId(ctx);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = comercialSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const previo = await sb.from("cartera_comerciales").select("nombre").eq("id", id).maybeSingle();
  if (previo.error) return NextResponse.json({ error: previo.error.message }, { status: 500 });
  if (!previo.data) return NextResponse.json({ error: "Comercial no encontrado" }, { status: 404 });

  const { data, error } = await sb
    .from("cartera_comerciales")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe un comercial con ese nombre" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let propagados = 0;
  const propagar = new URL(req.url).searchParams.get("propagar") === "1";
  if (propagar && previo.data.nombre !== parsed.data.nombre) {
    const { data: tocados, error: errProp } = await sb
      .from("cartera_ventas")
      .update({ vendedor: parsed.data.nombre })
      .ilike("vendedor", previo.data.nombre)
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
  const actual = await sb.from("cartera_comerciales").select("nombre").eq("id", id).maybeSingle();
  if (actual.error) return NextResponse.json({ error: actual.error.message }, { status: 500 });
  if (!actual.data) return NextResponse.json({ error: "Comercial no encontrado" }, { status: 404 });

  // Los registros de cartera guardan el nombre como texto, así que borrar el
  // comercial no los rompe, pero sí deja de ofrecerlo en los desplegables.
  const forzar = new URL(req.url).searchParams.get("forzar") === "1";
  const usos = await enUso(actual.data.nombre);
  if (usos > 0 && !forzar) {
    return NextResponse.json(
      {
        error: `${usos} ${usos === 1 ? "registro usa" : "registros usan"} este comercial. Desactívalo para sacarlo de los desplegables sin perder el historial.`,
        usos,
      },
      { status: 409 },
    );
  }

  const { error } = await sb.from("cartera_comerciales").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
