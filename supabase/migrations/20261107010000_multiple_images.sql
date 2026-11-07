-- Multiple images per product (ordered; the first is the cover image).
-- Replaces products.image_path with products.image_paths and updates
-- admin_save_product to take the full ordered list.

alter table public.products
  add column image_paths text[] not null default '{}'
  check (cardinality(image_paths) <= 8);

update public.products set image_paths = array[image_path] where image_path is not null;

drop function public.admin_save_product(uuid, text, text, integer, integer, integer, integer);
alter table public.products drop column image_path;

create function public.admin_save_product(
  p_product_id          uuid,
  p_name                text,
  p_image_paths         text[],
  p_main_store_qty      integer,
  p_warehouse_qty       integer,
  p_expected_main_store integer default null,
  p_expected_warehouse  integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_current integer;
  v_paths   text[] := coalesce(p_image_paths, '{}');
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  if p_main_store_qty is null or p_warehouse_qty is null
     or p_main_store_qty < 0 or p_warehouse_qty < 0 then
    raise exception 'INVALID_QUANTITY';
  end if;
  if cardinality(v_paths) > 8
     or exists (select 1 from unnest(v_paths) p where p is null or char_length(p) not between 1 and 200)
     or cardinality(v_paths) <> (select count(distinct p) from unnest(v_paths) p) then
    raise exception 'INVALID_IMAGES';
  end if;

  if p_product_id is null then
    insert into public.products (name, image_paths)
    values (btrim(p_name), v_paths)
    returning id into v_id;
  else
    update public.products
       set name = btrim(p_name), image_paths = v_paths
     where id = p_product_id
    returning id into v_id;
    if v_id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;

    select quantity into v_current from public.inventory
     where product_id = v_id and location = 'main_store' for update;
    if coalesce(v_current, 0) is distinct from coalesce(p_expected_main_store, 0) then
      raise exception 'STOCK_CHANGED';
    end if;

    select quantity into v_current from public.inventory
     where product_id = v_id and location = 'warehouse' for update;
    if coalesce(v_current, 0) is distinct from coalesce(p_expected_warehouse, 0) then
      raise exception 'STOCK_CHANGED';
    end if;
  end if;

  insert into public.inventory (product_id, location, quantity)
  values (v_id, 'main_store', p_main_store_qty), (v_id, 'warehouse', p_warehouse_qty)
  on conflict (product_id, location) do update set quantity = excluded.quantity;

  return v_id;
end;
$$;

revoke execute on function public.admin_save_product(uuid, text, text[], integer, integer, integer, integer) from public, anon;
grant execute on function public.admin_save_product(uuid, text, text[], integer, integer, integer, integer) to authenticated;
