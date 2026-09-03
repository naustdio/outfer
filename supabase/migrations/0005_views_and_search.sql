-- 0005_views_and_search: outfit_v (derived estado/nombre_sugerido) + the
-- unified search_all() RPC. Both are `security_invoker`/`security invoker`
-- explicitly -- the Postgres default (definer-style execution) would
-- silently bypass RLS. See design.md "Views must be security_invoker = on".
-- Paired down migration: supabase/migrations_down/0005_views_and_search_down.sql

create view outfit_v with (security_invoker = on) as
select o.*,
       case when agg.n = 0            then 'Sin prendas'
            when agg.todas_en_closet  then 'Disponible'
            else 'Incompleto' end            as estado,
       agg.nombre_sugerido,
       agg.n                                 as prendas_count
from outfit o
left join lateral (
  select count(*)                                        as n,
         coalesce(bool_and(p.estado = 'En closet'), true) as todas_en_closet,
         (select string_agg(t.nombre, ' + ' order by t.orden, t.nombre)
            from (select distinct tp.nombre, tp.orden
                    from outfit_prenda op2
                    join prenda p2      on p2.id = op2.prenda_id
                    join tipo_prenda tp on tp.id = p2.tipo_prenda_id
                   where op2.outfit_id = o.id) t)        as nombre_sugerido
    from outfit_prenda op join prenda p on p.id = op.prenda_id
   where op.outfit_id = o.id
) agg on true;

-- `anon` gets SELECT/EXECUTE too: security_invoker (view) / security invoker
-- (function) means RLS still applies to the anon caller, filtering both down
-- to 0 rows -- the exact footgun task 12.4 exists to prove stays closed.
grant select on outfit_v to authenticated, service_role, anon;

create function search_all(q text)
returns table (tipo text, id uuid, titulo text, subtitulo text)
language sql stable
security invoker            -- explicit: RLS must apply to the caller
set search_path = ''        -- explicit: a mutable search_path on a SECURITY
                             -- INVOKER function is still a hijack vector if
                             -- an attacker can get an unqualified object
                             -- resolved from a schema earlier in the caller's
                             -- path -- schema-qualify every reference below.
as $$
  select 'prenda', p.id, p.nombre, coalesce(p.marca, '') from public.prenda p
    where p.nombre ilike '%' || q || '%' or p.marca ilike '%' || q || '%'
  union all
  select 'outfit', o.id, o.titulo, coalesce(o.notas, '') from public.outfit o
    where o.titulo ilike '%' || q || '%' or o.notas ilike '%' || q || '%'
  union all
  select 'tip', t.id, t.tip, coalesce(t.descripcion, '') from public.tip t
    where t.tip ilike '%' || q || '%' or t.descripcion ilike '%' || q || '%'
  limit 60;
$$;

grant execute on function search_all(text) to authenticated, service_role, anon;
