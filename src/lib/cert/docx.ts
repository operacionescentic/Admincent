import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { officeToPdf } from "./office-pdf";

export type DocxValues = Record<string, string | number | boolean>;

/**
 * Word splits {{key}} across multiple XML runs due to spell-check/autocorrect.
 * Uses a state machine that carries delimiter state across node boundaries,
 * so splits like `{` | `{key}}` or `{{key` | `}}` are all caught correctly.
 */
function fixSplitTags(content: string): string {
  type TextNode = { textStart: number; textEnd: number; text: string };
  const nodes: TextNode[] = [];
  const re = /(?:<w:t(?:\s[^>]*)?>)([^<]*)(?=<\/w:t>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const textStart = m.index + (m[0].length - m[1].length);
    nodes.push({ textStart, textEnd: textStart + m[1].length, text: m[1] });
  }

  const merges = new Map<number, string>();
  const clears = new Set<number>();

  // State machine states
  const NORMAL = 0, MAYBE_OPEN = 1, IN_TAG = 2, MAYBE_CLOSE = 3;
  let state = NORMAL;
  let groupStart = -1;
  let groupText = "";

  for (let i = 0; i < nodes.length; i++) {
    const { text } = nodes[i];

    for (const ch of text) {
      switch (state) {
        case NORMAL:     if (ch === "{") state = MAYBE_OPEN; break;
        case MAYBE_OPEN: state = ch === "{" ? IN_TAG : NORMAL; break;
        case IN_TAG:     if (ch === "}") state = MAYBE_CLOSE; break;
        case MAYBE_CLOSE: state = ch === "}" ? NORMAL : IN_TAG; break;
      }
    }

    if (state !== NORMAL) {
      // Incomplete tag at node boundary — start or continue merge group
      if (groupStart === -1) {
        groupStart = i;
        groupText = text;
      } else {
        groupText += text;
        clears.add(i);
      }
    } else {
      if (groupStart !== -1) {
        // Tag just closed — absorb this node and commit the merge
        groupText += text;
        clears.add(i);
        merges.set(groupStart, groupText);
        groupStart = -1;
        groupText = "";
      }
    }
  }

  if (merges.size === 0) return content;

  let result = "";
  let lastEnd = 0;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    result += content.slice(lastEnd, node.textStart);
    result += merges.has(i) ? merges.get(i)! : clears.has(i) ? "" : node.text;
    lastEnd = node.textEnd;
  }
  result += content.slice(lastEnd);
  return result;
}

function preprocessZip(zip: PizZip): void {
  // Safety net: if Word splits {{key}} across XML runs (spell-check/autocorrect),
  // merge the runs before docxtemplater parses. Most modern templates don't need this.
  for (const part of [
    "word/document.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/footer1.xml",
    "word/footer2.xml",
  ]) {
    if (!zip.files[part]) continue;
    const original = zip.files[part].asText();
    const fixed = fixSplitTags(original);
    if (fixed !== original) zip.file(part, fixed);
  }
}

export function fillDocx(templateBytes: Uint8Array, values: DocxValues): Uint8Array {
  const zip = new PizZip(Buffer.from(templateBytes));
  preprocessZip(zip);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });
  doc.render(values);
  return doc.getZip().generate({ type: "nodebuffer" });
}

import { formatTemplateError, type TemplateErrorResult } from "./errors";

export type DocxValidationResult = { ok: true } | ({ ok: false } & TemplateErrorResult);

export function validateDocxTemplate(templateBytes: Uint8Array): DocxValidationResult {
  let zip: PizZip;
  try {
    zip = new PizZip(Buffer.from(templateBytes));
  } catch {
    return {
      ok: false,
      error: "Archivo DOCX corrupto o ilegible.",
      status: 400,
    };
  }
  preprocessZip(zip);

  try {
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
      nullGetter: () => "",
      errorLogging: false,
    });
    doc.render({});
    return { ok: true };
  } catch (err) {
    return { ok: false, ...formatTemplateError(err, "docx") };
  }
}

export function extractDocxKeys(bytes: Uint8Array): string[] {
  const zip = new PizZip(Buffer.from(bytes));
  const keys = new Set<string>();
  const re = /\{\{([^{}#/^][^{}]*?)\}\}/g;

  for (const part of [
    "word/document.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/footer1.xml",
    "word/footer2.xml",
  ]) {
    const file = zip.files[part];
    if (!file) continue;
    const clean = file.asText().replace(/<[^>]+>/g, "");
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean)) !== null) {
      const key = m[1].trim();
      if (key) keys.add(key);
    }
  }

  return [...keys];
}

/**
 * Fills a DOCX template and converts to PDF via iLovePDF/LibreOffice.
 * Returns null if no converter is available — caller falls back to DOCX.
 */
export async function fillDocxAsPdf(
  templateBytes: Uint8Array,
  values: DocxValues,
): Promise<Uint8Array | null> {
  const docxBytes = fillDocx(templateBytes, values);
  return officeToPdf(docxBytes, "document.docx");
}
