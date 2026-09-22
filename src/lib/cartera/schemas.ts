import { z } from "zod";
import {
  CANALES_GESTION,
  CATEGORIAS_SERVICIO,
  ESTADOS_CARTERA,
  RESULTADOS_GESTION,
} from "./types";

/** Trata "" y undefined como null: los formularios mandan cadenas vacías. */
const opcional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), schema.nullable());

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");

export const ventaSchema = z.object({
  cliente: z.string().trim().min(1, "El nombre del cliente es obligatorio"),
  fecha_contacto: opcional(fechaIso),
  vendedor: opcional(z.string().trim()),
  servicio: opcional(z.string().trim()),
  modalidad: opcional(z.string().trim()),
  nota_gestion: opcional(z.string().trim()),
  valor_mora: opcional(z.coerce.number().nonnegative()),
  total_pagar: z.coerce.number().nonnegative(),
  compromiso_pago: opcional(z.string().trim()),
  meses_mora: opcional(z.coerce.number().int().nonnegative()),
  estado_cobro: opcional(z.string().trim()),
  estado_cartera: opcional(z.enum(ESTADOS_CARTERA)),
  notas: opcional(z.string().trim()),
});

export const abonoSchema = z.object({
  venta_id: z.coerce.number().int().positive(),
  fecha: fechaIso,
  valor: z.coerce.number().positive("El abono debe ser mayor que cero"),
  nota: opcional(z.string().trim()),
});

export const gestionSchema = z.object({
  venta_id: z.coerce.number().int().positive(),
  fecha: fechaIso,
  canal: z.enum(CANALES_GESTION),
  resultado: z.enum(RESULTADOS_GESTION),
  proxima_accion: opcional(fechaIso),
  nota: opcional(z.string().trim()),
});

export const comercialSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  activo: z.boolean().default(true),
});

export const servicioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  categoria: opcional(z.enum(CATEGORIAS_SERVICIO)),
  activo: z.boolean().default(true),
});

/** Fila lista para insertar desde el importador. */
export const filaImportSchema = ventaSchema.omit({ estado_cartera: true, notas: true });

export const importSchema = z.object({
  filas: z.array(filaImportSchema).min(1, "No hay filas para importar"),
  /** Vacía la tabla antes de insertar en vez de añadir a lo existente. */
  reemplazar: z.boolean().default(false),
});

export type ComercialInput = z.infer<typeof comercialSchema>;
export type ServicioInput = z.infer<typeof servicioSchema>;
export type VentaInput = z.infer<typeof ventaSchema>;
export type AbonoInput = z.infer<typeof abonoSchema>;
export type GestionInput = z.infer<typeof gestionSchema>;
