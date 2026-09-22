-- Módulo Cartera (gestión de cobranzas).
-- Single workspace, igual que las tablas de nómina: sin owner_id, todos los
-- usuarios autenticados comparten el mismo dataset.
--
-- Modelado a partir de Dashboard_Cobranzas_Centic_SAS.xlsx (hoja "Ventas").
-- Los nombres de columna del Excel no siempre describen su contenido real; el
-- mapeo queda anotado en cada campo.
--
-- A diferencia de las tablas de nómina, estas tablas van con RLS activado y sin
-- políticas: sólo el service-role (que salta RLS) puede leerlas o escribirlas.
-- El acceso siempre pasa por los route handlers de /api/cartera.

create table if not exists cartera_ventas (
  id bigint generated always as identity primary key,

  cliente text not null,                       -- Excel B  "Nombre completo"
  fecha_contacto date,                         -- Excel C  "Fecha del contacto"
  vendedor text,                               -- Excel D  "Vendedor"
  servicio text,                               -- Excel E  "Servicio"
  modalidad text,                              -- Excel F  "Estado de cobro" (en realidad: Curso y examen / M+PO)
  nota_gestion text,                           -- Excel G  "% interes de mora" (en realidad: texto libre de gestión)
  valor_mora numeric(14, 2),                   -- Excel H  "Valor de interes de mora"
  total_pagar numeric(14, 2) not null default 0, -- Excel I  "Total a pagar"
  compromiso_pago text,                        -- Excel J  "Fecha de compromiso de pago" (texto libre: "ABONO 15 JUN")
  meses_mora integer,                          -- Excel K  "Meses en mora"
  estado_cobro text,                           -- Excel L  "Estado de cobro2"

  -- Override manual del estado normalizado. Cuando es null, la app lo deriva
  -- de nota_gestion / modalidad / estado_cobro / compromiso_pago replicando las
  -- fórmulas auxiliares del Excel (ver src/lib/cartera/normalize.ts).
  estado_cartera text,

  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cartera_ventas_cliente_idx on cartera_ventas (cliente);
create index if not exists cartera_ventas_vendedor_idx on cartera_ventas (vendedor);

-- Abonos / pagos parciales. saldo = total_pagar - sum(abonos).
create table if not exists cartera_abonos (
  id bigint generated always as identity primary key,
  venta_id bigint not null references cartera_ventas(id) on delete cascade,
  fecha date not null default current_date,
  valor numeric(14, 2) not null,
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists cartera_abonos_venta_idx on cartera_abonos (venta_id);

-- Bitácora de gestión de cobro.
create table if not exists cartera_gestiones (
  id bigint generated always as identity primary key,
  venta_id bigint not null references cartera_ventas(id) on delete cascade,
  fecha date not null default current_date,
  canal text not null,
  resultado text not null,
  proxima_accion date,
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists cartera_gestiones_venta_idx on cartera_gestiones (venta_id);
create index if not exists cartera_gestiones_proxima_idx on cartera_gestiones (proxima_accion);

-- Constraints idempotentes (Postgres no soporta ADD CONSTRAINT IF NOT EXISTS).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cartera_ventas_estado_cartera_check') then
    alter table cartera_ventas add constraint cartera_ventas_estado_cartera_check
      check (estado_cartera is null or estado_cartera in (
        'Al día', 'Pendiente / Compromiso', 'Sin respuesta / Inactivo', 'Sin gestionar'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cartera_ventas_total_pagar_check') then
    alter table cartera_ventas add constraint cartera_ventas_total_pagar_check
      check (total_pagar >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cartera_ventas_meses_mora_check') then
    alter table cartera_ventas add constraint cartera_ventas_meses_mora_check
      check (meses_mora is null or meses_mora >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cartera_abonos_valor_check') then
    alter table cartera_abonos add constraint cartera_abonos_valor_check
      check (valor > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cartera_gestiones_canal_check') then
    alter table cartera_gestiones add constraint cartera_gestiones_canal_check
      check (canal in ('llamada', 'whatsapp', 'correo', 'presencial', 'otro'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cartera_gestiones_resultado_check') then
    alter table cartera_gestiones add constraint cartera_gestiones_resultado_check
      check (resultado in (
        'contactado', 'sin_respuesta', 'compromiso_pago',
        'pago_parcial', 'pago_total', 'renuente', 'otro'
      ));
  end if;
end $$;

-- updated_at automático en cartera_ventas.
create or replace function cartera_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cartera_ventas_touch on cartera_ventas;
create trigger cartera_ventas_touch
  before update on cartera_ventas
  for each row execute function cartera_touch_updated_at();

-- Cierre de acceso: sólo service-role. RLS activado y sin políticas hace que
-- anon y authenticated no vean ninguna fila aunque tuvieran el grant.
alter table cartera_ventas enable row level security;
alter table cartera_abonos enable row level security;
alter table cartera_gestiones enable row level security;

revoke all on cartera_ventas from anon, authenticated;
revoke all on cartera_abonos from anon, authenticated;
revoke all on cartera_gestiones from anon, authenticated;
