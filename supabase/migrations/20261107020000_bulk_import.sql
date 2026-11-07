-- Bulk product import (CSV / Excel, parsed on the phone).
-- p_rows is a JSON array of {"name", "main_store", "warehouse"}.
-- All-or-nothing: any invalid row aborts the whole import.
-- A name matching an existing product (case-insensitive) sets that product's
-- stock; any other name creates a new product.

create function public.admin_import_products(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r         jsonb;
  i         integer := 0;
  v_name    text;
  v_main    integer;
  v_wh      integer;
  v_id      uuid;
  v_matches integer;
  v_created integer := 0;
  v_updated integer := 0;
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) = 0
     or jsonb_array_length(p_rows) > 1000 then
    raise exception 'INVALID_IMPORT';
  end if;
  if (select count(*) from jsonb_array_elements(p_rows))
     <> (select count(distinct lower(btrim(e->>'name'))) from jsonb_array_elements(p_rows) e) then
    raise exception 'DUPLICATE_NAMES';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1;
    v_name := btrim(r->>'name');
    if v_name is null or char_length(v_name) not between 1 and 120
       or coalesce(r->>'main_store', '') !~ '^\d{1,6}$'
       or coalesce(r->>'warehouse', '') !~ '^\d{1,6}$' then
      raise exception 'INVALID_IMPORT_ROW %', i;
    end if;
    v_main := (r->>'main_store')::integer;
    v_wh   := (r->>'warehouse')::integer;

    select count(*), min(id::text)::uuid into v_matches, v_id
      from public.products where lower(name) = lower(v_name);
    if v_matches > 1 then raise exception 'AMBIGUOUS_NAME %', v_name; end if;

    if v_matches = 0 then
      insert into public.products (name) values (v_name) returning id into v_id;
      v_created := v_created + 1;
    else
      v_updated := v_updated + 1;
    end if;

    insert into public.inventory (product_id, location, quantity)
    values (v_id, 'main_store', v_main), (v_id, 'warehouse', v_wh)
    on conflict (product_id, location) do update set quantity = excluded.quantity;
  end loop;

  return jsonb_build_object('created', v_created, 'updated', v_updated);
end;
$$;

revoke execute on function public.admin_import_products(jsonb) from public, anon;
grant execute on function public.admin_import_products(jsonb) to authenticated;
