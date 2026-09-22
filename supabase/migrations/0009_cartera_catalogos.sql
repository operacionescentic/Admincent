-- Catálogos del módulo de cartera: comerciales y servicios/cursos.
--
-- Existen para que los campos "vendedor" y "servicio" de cartera_ventas se
-- llenen desde una lista cerrada en vez de texto libre. El archivo original
-- traía 5 variantes de vendedor para 3 personas ("Ximena" / "ximena") y 21
-- nombres de servicio para 13 categorías reales.
--
-- cartera_ventas sigue guardando el nombre como texto y no una FK: los 65
-- registros importados del Excel traen valores que no están en el catálogo, y
-- una FK los rechazaría. El catálogo alimenta los desplegables; la columna
-- guarda lo elegido.

create table if not exists cartera_comerciales (
  id bigint generated always as identity primary key,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists cartera_servicios (
  id bigint generated always as identity primary key,
  nombre text not null,
  -- Categoría explícita. Cuando está, gana sobre la derivación por palabras
  -- clave de normalize.ts, que es la que clasifica mal casos como
  -- "ISO42001 27 JUL" (sin espacio no matchea "ISO 42001").
  categoria text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Unicidad sin distinguir mayúsculas ni espacios sobrantes: es lo que impide
-- que "Ximena" y "ximena " convivan como dos comerciales distintos.
create unique index if not exists cartera_comerciales_nombre_key
  on cartera_comerciales (lower(btrim(nombre)));

create unique index if not exists cartera_servicios_nombre_key
  on cartera_servicios (lower(btrim(nombre)));

create index if not exists cartera_comerciales_activo_idx on cartera_comerciales (activo);
create index if not exists cartera_servicios_activo_idx on cartera_servicios (activo);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cartera_comerciales_nombre_check') then
    alter table cartera_comerciales add constraint cartera_comerciales_nombre_check
      check (btrim(nombre) <> '');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cartera_servicios_nombre_check') then
    alter table cartera_servicios add constraint cartera_servicios_nombre_check
      check (btrim(nombre) <> '');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cartera_servicios_categoria_check') then
    alter table cartera_servicios add constraint cartera_servicios_categoria_check
      check (categoria is null or categoria in (
        'ITIL', 'ISO 27001', 'ISO 42001', 'Otras ISO', 'SCRUM', 'BRIDGE', 'CDS',
        'TOGAF', 'DPI', 'DITS', 'AGILE', 'Ciberseguridad', 'Otros', 'Sin definir'
      ));
  end if;
end $$;

-- Mismo cierre que el resto del módulo: sólo service-role.
alter table cartera_comerciales enable row level security;
alter table cartera_servicios enable row level security;

revoke all on cartera_comerciales from anon, authenticated;
revoke all on cartera_servicios from anon, authenticated;
