export type TemplateErrorResult = {
  error: string;
  status: number;
  issues?: TemplateErrorIssue[];
};

export type TemplateErrorIssue = {
  message: string;
  context?: string;
  file?: string;
  offset?: number;
};

const DOCX_ISSUE_BY_ID: Record<string, string> = {
  unopened_tag: "Llave de cierre `}}` sin su `{{` correspondiente",
  unclosed_tag: "Llave de apertura `{{` sin su `}}` correspondiente",
  duplicate_open_tag: "Llave `{{` duplicada",
  duplicate_close_tag: "Llave `}}` duplicada",
  unbalanced_loop_tag: "Bucle `{#…}{/…}` mal balanceado",
  malformed_xml: "XML del documento malformado",
  no_xml_file: "Archivo XML faltante en el DOCX",
};

type DocxtemplaterError = {
  properties?: {
    errors?: Array<{
      properties?: {
        id?: string;
        xtag?: string;
        context?: string;
        offset?: number;
        file?: string;
        explanation?: string;
      };
    }>;
  };
  message?: string;
};

function isDocxtemplaterError(err: unknown): err is DocxtemplaterError {
  return (
    typeof err === "object" &&
    err !== null &&
    "properties" in err &&
    typeof (err as DocxtemplaterError).properties === "object"
  );
}

export function formatTemplateError(err: unknown, kind: "docx" | "pdf"): TemplateErrorResult {
  if (kind === "docx" && isDocxtemplaterError(err)) {
    const errors = err.properties?.errors ?? [];
    const issues: TemplateErrorIssue[] = errors.map((er) => {
      const p = er.properties ?? {};
      const base = (p.id && DOCX_ISSUE_BY_ID[p.id]) ?? p.explanation ?? "Tag malformado";
      const ctx = p.xtag || p.context;
      return {
        message: ctx ? `${base} cerca de "${ctx}"` : base,
        context: ctx,
        file: p.file,
        offset: p.offset,
      };
    });
    if (issues.length > 0) {
      const detail = issues.map((i) => `• ${i.message}`).join("\n");
      return {
        error: `Revisa la plantilla: contiene tags malformados.\n${detail}`,
        status: 400,
        issues,
      };
    }
  }

  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("pdf") ||
    lower.includes("acroform") ||
    lower.includes("field") ||
    lower.includes("encrypted")
  ) {
    return {
      error: `Revisa la plantilla: no se pudo procesar el PDF. ${msg}`,
      status: 400,
    };
  }
  return {
    error: `Revisa la plantilla: ${msg}`,
    status: 400,
  };
}
