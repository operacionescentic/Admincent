import {
  fillDocx,
  fillDocxAsPdf,
  fillPdfByPlacements,
  fillPdfForm,
  type PdfFieldDef,
} from "./index";
import { formatTemplateError } from "./errors";

export type CertificateTemplate = {
  kind: "pdf" | "docx";
  fields: unknown;
  has_acroform: boolean;
};

export type RenderedCertificate = {
  bytes: Uint8Array;
  mime: string;
  ext: "pdf" | "docx";
};

export type RenderError = { error: string; status: number; issues?: unknown };

export async function renderCertificate(
  templateBytes: Uint8Array,
  template: CertificateTemplate,
  values: Record<string, string | number | boolean>,
): Promise<RenderedCertificate | RenderError> {
  if (template.kind === "pdf") {
    const stringValues: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) stringValues[k] = String(v);

    const fields = (template.fields ?? []) as PdfFieldDef[];
    if (fields.length === 0 && !template.has_acroform) {
      return {
        error: "Revisa la plantilla: el PDF no tiene campos colocados ni formulario AcroForm.",
        status: 400,
      };
    }
    try {
      const bytes =
        fields.length > 0
          ? await fillPdfByPlacements(templateBytes, fields, stringValues)
          : await fillPdfForm(templateBytes, stringValues);
      return { bytes, mime: "application/pdf", ext: "pdf" };
    } catch (err) {
      return formatTemplateError(err, "pdf");
    }
  }

  try {
    const pdfBytes = await fillDocxAsPdf(templateBytes, values);
    if (pdfBytes) return { bytes: pdfBytes, mime: "application/pdf", ext: "pdf" };
    return {
      bytes: fillDocx(templateBytes, values),
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ext: "docx",
    };
  } catch (err) {
    return formatTemplateError(err, "docx");
  }
}
