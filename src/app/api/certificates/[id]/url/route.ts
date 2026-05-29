import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { renderCertificate } from "@/lib/cert";

// Regenerates and streams the certificate on-demand from template + values.
// No storage involved — saves space at the cost of CPU per download.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const sb = getSupabaseAdmin();

  const cert = await sb
    .from("certificates")
    .select("template_id, values, owner_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (cert.error || !cert.data) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (cert.data.owner_id !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const tpl = await sb
    .from("templates")
    .select("kind, storage_path, fields, has_acroform, name")
    .eq("id", cert.data.template_id)
    .maybeSingle();
  if (tpl.error || !tpl.data) {
    return NextResponse.json({ error: "template no longer exists" }, { status: 404 });
  }

  const dl = await sb.storage.from("templates").download(tpl.data.storage_path);
  if (dl.error || !dl.data) {
    return NextResponse.json(
      { error: "Revisa la plantilla: no se pudo descargar desde almacenamiento." },
      { status: 500 },
    );
  }
  const templateBytes = new Uint8Array(await dl.data.arrayBuffer());

  const rendered = await renderCertificate(
    templateBytes,
    { kind: tpl.data.kind, fields: tpl.data.fields, has_acroform: tpl.data.has_acroform },
    (cert.data.values ?? {}) as Record<string, string | number | boolean>,
  );
  if ("error" in rendered) {
    return NextResponse.json({ error: rendered.error }, { status: rendered.status });
  }

  const filename = `${tpl.data.name ?? "certificado"}.${rendered.ext}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(rendered.bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": rendered.mime,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(rendered.bytes.byteLength),
    },
  });
}
