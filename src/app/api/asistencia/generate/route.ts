import { NextResponse } from "next/server";
import { z } from "zod";
import JSZip from "jszip";
import { auth } from "@/lib/auth/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  renderAsistenciaPdf,
  type AcroformFieldMapping,
  type AsistenciaFieldDef,
  type LogoPosition,
} from "@/lib/asistencia/render";
import { formatTemplateError } from "@/lib/cert";

const participanteSchema = z.object({
  nombre: z.string().min(1),
  cedula: z.string().optional(),
});

const bodySchema = z.object({
  templateId: z.string().uuid(),
  curso: z.string().min(1),
  instructor: z.string().optional(),
  horas: z.string().optional(),
  dia: z.number().int().min(1).max(31).optional(),
  dia_inicio: z.number().int().min(1).max(31).optional(),
  dia_fin: z.number().int().min(1).max(31).optional(),
  mes: z.number().int().min(1).max(12).optional(),
  anio: z.number().int().min(1900).max(3000).optional(),
  dia_expedicion: z.number().int().min(1).max(31).optional(),
  mes_expedicion: z.number().int().min(1).max(12).optional(),
  anio_expedicion: z.number().int().min(1900).max(3000).optional(),
  adicional: z.string().optional(),
  participantes: z.array(participanteSchema).min(1),
  logoBase64: z.string().nullable().optional(),
  logoMime: z.enum(["image/png", "image/jpeg"]).nullable().optional(),
});

function safeName(s: string) {
  return s.replace(/[^a-zA-Z0-9]+/g, "_");
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  const sb = getSupabaseAdmin();
  const tpl = await sb
    .from("templates")
    .select(
      "storage_path, fields, logo_position, has_acroform, acroform_field_map, owner_id, tipo",
    )
    .eq("id", data.templateId)
    .maybeSingle();
  if (tpl.error || !tpl.data) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  if (tpl.data.owner_id !== session.user.id || tpl.data.tipo !== "asistencia") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const dl = await sb.storage.from("templates").download(tpl.data.storage_path);
  if (dl.error || !dl.data) {
    return NextResponse.json({ error: "No se pudo cargar la plantilla" }, { status: 500 });
  }
  const templateBytes = new Uint8Array(await dl.data.arrayBuffer());

  const fields = (tpl.data.fields ?? []) as AsistenciaFieldDef[];
  const logoPosition = (tpl.data.logo_position ?? null) as LogoPosition | null;
  const acroformMap = (tpl.data.acroform_field_map ?? null) as AcroformFieldMapping[] | null;
  const useAcroform = !!tpl.data.has_acroform && !!acroformMap && acroformMap.length > 0;

  let logoBytes: Uint8Array | null = null;
  let logoMime: string | null = null;
  if (data.logoBase64 && data.logoMime && logoPosition) {
    logoBytes = new Uint8Array(Buffer.from(data.logoBase64, "base64"));
    logoMime = data.logoMime;
  }

  const renders: { nombre: string; cedula: string; pdf: Uint8Array }[] = [];
  try {
    for (const p of data.participantes) {
      const pdf = await renderAsistenciaPdf({
        templateBytes,
        fields,
        values: {
          nombre: p.nombre,
          cedula: p.cedula,
          curso: data.curso,
          instructor: data.instructor,
          horas: data.horas,
          dia: data.dia,
          dia_inicio: data.dia_inicio,
          dia_fin: data.dia_fin,
          mes: data.mes,
          anio: data.anio,
          dia_expedicion: data.dia_expedicion,
          mes_expedicion: data.mes_expedicion,
          anio_expedicion: data.anio_expedicion,
          adicional: data.adicional,
        },
        logoPosition,
        logoBytes,
        logoMime,
        acroformMap,
        useAcroform,
      });
      renders.push({ nombre: p.nombre, cedula: p.cedula ?? "", pdf });
    }
  } catch (err) {
    const formatted = formatTemplateError(err, "pdf");
    return NextResponse.json(
      { error: formatted.error, issues: formatted.issues },
      { status: formatted.status },
    );
  }

  if (renders.length === 1) {
    const r = renders[0];
    return NextResponse.json({
      kind: "pdf",
      filename: `asistencia_${safeName(r.nombre)}_${safeName(data.curso)}.pdf`,
      base64: Buffer.from(r.pdf).toString("base64"),
    });
  }

  const zip = new JSZip();
  for (const r of renders) {
    zip.file(`${safeName(r.nombre)}_${safeName(r.cedula)}.pdf`, r.pdf);
  }
  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  return NextResponse.json({
    kind: "zip",
    filename: `asistencia_${safeName(data.curso)}_${renders.length}.zip`,
    base64: Buffer.from(zipBytes).toString("base64"),
  });
}
