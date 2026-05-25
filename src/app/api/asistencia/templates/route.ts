import { NextResponse } from "next/server";
import { z } from "zod";
import { PDFDocument, PDFTextField } from "pdf-lib";
import { auth } from "@/lib/auth/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getPdfPageSizes } from "@/lib/cert";

const FIELD_KEYS = [
  "nombre",
  "cedula",
  "curso",
  "horas",
  "instructor",
  "dia",
  "dia_inicio",
  "dia_fin",
  "mes",
  "anio",
  "dia_expedicion",
  "mes_expedicion",
  "anio_expedicion",
  "adicional",
] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

async function detectAcroformTextFields(bytes: Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(bytes);
  try {
    const form = pdf.getForm();
    return form
      .getFields()
      .filter((f) => f instanceof PDFTextField)
      .map((f) => f.getName());
  } catch {
    return [];
  }
}

function autoMap(fields: string[]): Array<{ pdfField: string; key: FieldKey }> {
  const out: Array<{ pdfField: string; key: FieldKey }> = [];
  for (const name of fields) {
    const norm = name.trim().toLowerCase().replace(/\s+/g, "_");
    const stripped = norm.replace(/[^a-z_]/g, "");
    const match = FIELD_KEYS.find((k) => k === norm || k === stripped);
    if (match) out.push({ pdfField: name, key: match });
  }
  return out;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("templates")
    .select(
      "id, name, storage_path, fields, page_sizes, logo_position, has_acroform, acroform_fields, acroform_field_map, created_at",
    )
    .eq("owner_id", session.user.id)
    .eq("tipo", "asistencia")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
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
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Solo PDF soportado" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const path = `${session.user.id}/asistencia/${crypto.randomUUID()}-${file.name}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const up = await sb.storage.from("templates").upload(path, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const pageSizes = await getPdfPageSizes(bytes);
  const acroformFields = await detectAcroformTextFields(bytes);
  const hasAcroform = acroformFields.length > 0;
  const acroformFieldMap = hasAcroform ? autoMap(acroformFields) : null;

  const ins = await sb
    .from("templates")
    .insert({
      owner_id: session.user.id,
      name,
      kind: "pdf",
      tipo: "asistencia",
      storage_path: path,
      fields: [],
      page_sizes: pageSizes,
      has_acroform: hasAcroform,
      acroform_fields: hasAcroform ? acroformFields : null,
      acroform_field_map: acroformFieldMap,
    })
    .select()
    .single();
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ template: ins.data });
}

const fieldSchema = z.object({
  key: z.enum(FIELD_KEYS),
  page: z.number().int().min(0).optional(),
  x: z.number(),
  y: z.number(),
  size: z.number().positive().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  maxWidth: z.number().positive().optional(),
  autoShrink: z.boolean().optional(),
  monthFormat: z.enum(["numeric", "text"]).optional(),
});

const logoSchema = z
  .object({
    page: z.number().int().min(0).optional(),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .nullable();

const acroformMapSchema = z
  .array(
    z.object({
      pdfField: z.string().min(1),
      key: z.enum(FIELD_KEYS),
      monthFormat: z.enum(["numeric", "text"]).optional(),
    }),
  )
  .nullable();

const patchSchema = z.object({
  id: z.string().uuid(),
  fields: z.array(fieldSchema).optional(),
  logo_position: logoSchema.optional(),
  acroform_field_map: acroformMapSchema.optional(),
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
  const update: Record<string, unknown> = {};
  if (parsed.data.fields !== undefined) update.fields = parsed.data.fields;
  if (parsed.data.logo_position !== undefined) update.logo_position = parsed.data.logo_position;
  if (parsed.data.acroform_field_map !== undefined)
    update.acroform_field_map = parsed.data.acroform_field_map;
  const upd = await sb
    .from("templates")
    .update(update)
    .eq("id", parsed.data.id)
    .eq("owner_id", session.user.id)
    .eq("tipo", "asistencia")
    .select()
    .single();
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
  return NextResponse.json({ template: upd.data });
}
