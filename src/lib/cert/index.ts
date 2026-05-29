export * from "./pdf";
export * from "./docx";
export * from "./render";
export * from "./errors";

export type TemplateKind = "pdf" | "docx";

export function detectKind(filename: string): TemplateKind | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  return null;
}

export type PdfFieldDefStored = {
  key: string;
  page?: number;
  x: number;
  y: number;
  size?: number;
  align?: "left" | "center" | "right";
};
