"use client";

/**
 * Desplegable alimentado por un catálogo.
 *
 * Los registros que vienen del Excel traen nombres que no están en el catálogo.
 * Para no perderlos al editar, el valor actual se añade como opción extra
 * marcada "fuera del catálogo": se puede conservar o cambiar por una entrada
 * válida, pero no se puede teclear texto nuevo.
 */
export default function CatalogoSelect({
  value,
  opciones,
  onChange,
  placeholder = "Sin asignar",
  className = "",
}: {
  value: string;
  /** Nombres del catálogo, ya filtrados a los activos. */
  opciones: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const normaliza = (s: string) => s.trim().toLowerCase();
  const fueraDeCatalogo =
    value.trim() !== "" && !opciones.some((o) => normaliza(o) === normaliza(value));

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      data-fuera-catalogo={fueraDeCatalogo || undefined}
    >
      <option value="">{placeholder}</option>
      {fueraDeCatalogo && <option value={value}>{value} — fuera del catálogo</option>}
      {opciones.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
