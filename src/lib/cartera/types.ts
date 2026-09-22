export const ESTADOS_CARTERA = [
  "Al día",
  "Pendiente / Compromiso",
  "Sin respuesta / Inactivo",
  "Sin gestionar",
] as const;

export type EstadoCartera = (typeof ESTADOS_CARTERA)[number];

export const CATEGORIAS_SERVICIO = [
  "ITIL",
  "ISO 27001",
  "ISO 42001",
  "Otras ISO",
  "SCRUM",
  "BRIDGE",
  "CDS",
  "TOGAF",
  "DPI",
  "DITS",
  "AGILE",
  "Ciberseguridad",
  "Otros",
  "Sin definir",
] as const;

export type CategoriaServicio = (typeof CATEGORIAS_SERVICIO)[number];

export const RANGOS_MORA = [
  "1-3 meses",
  "4-6 meses",
  "+6 meses",
  "Sin dato registrado",
] as const;

export type RangoMora = (typeof RANGOS_MORA)[number];

export const CANALES_GESTION = [
  "llamada",
  "whatsapp",
  "correo",
  "presencial",
  "otro",
] as const;

export type CanalGestion = (typeof CANALES_GESTION)[number];

export const RESULTADOS_GESTION = [
  "contactado",
  "sin_respuesta",
  "compromiso_pago",
  "pago_parcial",
  "pago_total",
  "renuente",
  "otro",
] as const;

export type ResultadoGestion = (typeof RESULTADOS_GESTION)[number];

export const RESULTADO_LABEL: Record<ResultadoGestion, string> = {
  contactado: "Contactado",
  sin_respuesta: "Sin respuesta",
  compromiso_pago: "Compromiso de pago",
  pago_parcial: "Pago parcial",
  pago_total: "Pago total",
  renuente: "Renuente",
  otro: "Otro",
};

export const CANAL_LABEL: Record<CanalGestion, string> = {
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  correo: "Correo",
  presencial: "Presencial",
  otro: "Otro",
};

export type CarteraComercial = {
  id: number;
  nombre: string;
  activo: boolean;
  created_at: string;
};

export type CarteraServicio = {
  id: number;
  nombre: string;
  categoria: CategoriaServicio | null;
  activo: boolean;
  created_at: string;
};

/** Fila tal como vive en la tabla `cartera_ventas`. */
export type CarteraVenta = {
  id: number;
  cliente: string;
  fecha_contacto: string | null;
  vendedor: string | null;
  servicio: string | null;
  modalidad: string | null;
  nota_gestion: string | null;
  valor_mora: number | string | null;
  total_pagar: number | string;
  compromiso_pago: string | null;
  meses_mora: number | null;
  estado_cobro: string | null;
  estado_cartera: EstadoCartera | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

export type CarteraAbono = {
  id: number;
  venta_id: number;
  fecha: string;
  valor: number | string;
  nota: string | null;
  created_at: string;
};

export type CarteraGestion = {
  id: number;
  venta_id: number;
  fecha: string;
  canal: CanalGestion;
  resultado: ResultadoGestion;
  proxima_accion: string | null;
  nota: string | null;
  created_at: string;
};

/** Venta enriquecida con los campos derivados que consume el dashboard. */
export type VentaEnriquecida = CarteraVenta & {
  totalPagar: number;
  abonado: number;
  saldo: number;
  vendedorNorm: string;
  estadoCarteraNorm: EstadoCartera;
  /** true cuando el estado viene de `estado_cartera` y no de la derivación. */
  estadoManual: boolean;
  categoriaServicio: CategoriaServicio;
  rangoMora: RangoMora;
  ultimaGestion: CarteraGestion | null;
};
