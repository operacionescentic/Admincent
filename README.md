# Nominapp

Web app de nómina y generación de certificados. Stack: **Next.js 16 + React 19 + TypeScript + Tailwind v4 + Supabase + Vercel**.

## Módulos

- **Desprendibles** — generador de comprobantes de pago (PDF), envío por email (Resend), historial.
- **Colaboradores** — CRUD de empleados, instructores, proveedores. Devengados/deducciones fijos por trabajador.
- **Certificados** — plantillas PDF (con coords o AcroForm) o DOCX (placeholders `{{clave}}`), generación por valores.
- **Certificados de asistencia** — diplomas con campos rellenables vía AcroForm + logo extra opcional.

## Quick start

```bash
cp .env.example .env.local   # rellenar variables (ver SETUP.md)
npm install
npm run dev
```

Abrí http://localhost:3000 → registrate → empezá por `/colaboradores/empleados` y `/desprendibles`.

## Certificados de asistencia

Flujo recomendado: **AcroForm + drag de logo**. La app rellena cada campo del PDF por su nombre, sin coordenadas para el texto. Solo el logo extra usa coordenadas (drag visual).

### 1. Crear plantilla con campos de formulario (PDF24 Tools, gratis)

1. Descargá [PDF24 Creator](https://tools.pdf24.org/es/creator) (Windows, gratis). Alternativa web: [Editar PDF](https://tools.pdf24.org/es/edit-pdf).
2. Abrí tu PDF de diploma en PDF24 Creator.
3. Barra de herramientas → **Formulario** → **Insertar campo de texto**.
4. Dibujá un campo en cada zona donde irá un dato.
5. Clic derecho en cada campo → **Propiedades** → **General** → **Nombre**. Usá uno exacto de la lista de abajo.
6. En **Apariencia** ajustá tamaño de letra, alineación y color.
7. Guardá como PDF.

### 2. Subir y mapear

- Ir a `/asistencia/plantillas` → subir PDF.
- App detecta AcroForm automáticamente. Mapeo auto si los nombres coinciden con los keys soportados; si no, asignás manualmente en la tabla.
- Para `mes` y `mes_expedicion` elegís formato número (`04`) o texto (`abril`).
- Opcional: arrastrar rectángulo en el preview PDF para definir posición del logo extra.

### 3. Generar

- Ir a `/asistencia` → seleccionar plantilla, curso, fechas, lista de participantes (individual o CSV).
- App rellena campos del PDF y, si configuraste logo extra, lo incrusta proporcionalmente en el área arrastrada.
- Salida: PDF único o ZIP con un PDF por participante.

### Keys soportados (nombres exactos del field en el PDF)

| Key | Tipo | Descripción |
|-----|------|-------------|
| `nombre` | texto | Nombre del participante |
| `cedula` | texto | Cédula del participante (opcional) |
| `curso` | texto | Nombre del curso |
| `horas` | texto | Horas del curso |
| `instructor` | texto | Nombre del instructor (firma — se renderiza en cursiva GreatVibes en modo legacy) |
| `dia` | número 2d | Día único (legacy) |
| `dia_inicio` | número 2d | Día de inicio del curso |
| `dia_fin` | número 2d | Día de fin del curso |
| `mes` | número 2d o texto | Mes del curso (formato configurable) |
| `anio` | número 4d | Año del curso |
| `dia_expedicion` | número 2d | Día de expedición del certificado |
| `mes_expedicion` | número 2d o texto | Mes de expedición |
| `anio_expedicion` | número 4d | Año de expedición |
| `adicional` | texto | Texto adicional libre |

Ejemplo: para "con una duración de 20 horas del 19 al 25 de 12 del 2026" usá `horas`, `dia_inicio`, `dia_fin`, `mes`, `anio`. La app deriva los valores de los date pickers en el generador.

### Logo extra

- En el editor de plantilla, arrastrá un rectángulo donde irá el logo.
- Al generar, subís un PNG/JPEG. App lo encaja proporcionalmente dentro del rectángulo.
- Coordenadas se guardan relativas al CropBox (`page.getCropBox()` aplicado en `drawLogoOverlay`), por lo que funcionan también en PDFs con offset de impresión.

### Plantilla sin AcroForm (modo legacy)

Si subís un PDF sin campos de formulario, la app cae al editor click-to-place (`AsistenciaTemplateEditor`). Coords manuales para cada texto + drag para logo. No recomendado para diplomas finales — usar AcroForm + PDF24 da resultado WYSIWYG sin drift de baseline.

## Certificados (módulo general, no asistencia)

- `/templates` — subir PDF o DOCX. PDFs sin AcroForm permiten editor click-to-place. DOCX usa placeholders `{{clave}}`.
- `/certificates` — generar a partir de plantilla + valores.

## Setup

- Schema/buckets/Resend/env vars: ver [SETUP.md](./SETUP.md).
- Arquitectura/convenciones: ver [CLAUDE.md](./CLAUDE.md).

## Scripts

```bash
npm run dev     # dev server
npm run build   # producción
npm run start   # serve build
npm run lint    # eslint
```

## Deploy

Vercel: importar el repo, configurar env vars de `.env.example`. Las rutas API corren en runtime Node (no Edge) por `pdf-lib`, `docxtemplater` y `resend`.
