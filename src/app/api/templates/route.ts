import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  detectKind,
  extractDocxKeys,
  getPdfPageSizes,
  pdfHasAcroForm,
  validateDocxTemplate,
} from "@/lib/cert";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo");

  const sb = getSupabaseAdmin();
  let query = sb
    .from("templates")
    .select("id, name, kind, storage_path, fields, page_sizes, has_acroform, created_at, tipo")
    .eq("owner_id", session.user.id)
    .order("created_at", { ascending: false });
  if (tipo) query = query.eq("tipo", tipo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Lazy-migrate: DOCX templates with no detected fields → extract now and persist.
  const templates = await Promise.all(
    (data ?? []).map(async (tpl) => {
      if (tpl.kind !== "docx" || (Array.isArray(tpl.fields) && tpl.fields.length > 0)) {
        return tpl;
      }
      const dl = await sb.storage.from("templates").download(tpl.storage_path);
      if (dl.error || !dl.data) return tpl;
      const bytes = new Uint8Array(await dl.data.arrayBuffer());
      const fields = extractDocxKeys(bytes).map((key) => ({ key }));
      if (fields.length > 0) {
        await sb.from("templates").update({ fields }).eq("id", tpl.id);
        return { ...tpl, fields };
      }
      return tpl;
    }),
  );

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const name = String(form.get("name") ?? "");
  if (!(file instanceof File) || !name) {
    return NextResponse.json({ error: "missing file or name" }, { status: 400 });
  }
  const kind = detectKind(file.name);
  if (!kind) return NextResponse.json({ error: "unsupported file type" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (kind === "docx") {
    const validation = validateDocxTemplate(bytes);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error, issues: validation.issues },
        { status: validation.status },
      );
    }
  }

  const sb = getSupabaseAdmin();
  const path = `${session.user.id}/${crypto.randomUUID()}-${file.name}`;
  const up = await sb.storage.from("templates").upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  let pageSizes: Array<{ width: number; height: number }> | null = null;
  let hasAcro = false;
  let fields: { key: string }[] = [];
  if (kind === "pdf") {
    pageSizes = await getPdfPageSizes(bytes);
    hasAcro = await pdfHasAcroForm(bytes);
  } else if (kind === "docx") {
    fields = extractDocxKeys(bytes).map((key) => ({ key }));
  }

  const ins = await sb
    .from("templates")
    .insert({
      owner_id: session.user.id,
      name,
      kind,
      storage_path: path,
      fields,
      page_sizes: pageSizes,
      has_acroform: hasAcro,
    })
    .select()
    .single();
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ template: ins.data });
}

const fieldSchema = z.object({
  key: z.string().min(1),
  page: z.number().int().min(0).optional(),
  x: z.number(),
  y: z.number(),
  size: z.number().positive().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  fields: z.array(fieldSchema),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const upd = await sb
    .from("templates")
    .update({ fields: parsed.data.fields })
    .eq("id", parsed.data.id)
    .eq("owner_id", session.user.id)
    .select()
    .single();
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
  return NextResponse.json({ template: upd.data });
}
