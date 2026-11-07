-- Minimal two-location inventory: Main Store <-> Warehouse.
-- Clients may only READ inventory. Every stock change goes through the
-- security definer functions below, which lock rows and validate atomically.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.location as enum ('main_store', 'warehouse');
create type public.request_status as enum ('pending', 'approved', 'completed', 'rejected');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  location  public.location,               -- null until an administrator assigns one
  is_admin  boolean not null default false
);

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  image_path  text check (image_path is null or char_length(image_path) between 1 and 200),
  created_at  timestamptz not null default now()
);

create table public.inventory (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  location    public.location not null,
  quantity    integer not null default 0 check (quantity >= 0),
  unique (product_id, location)
);

create table public.requests (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete restrict,
  quantity       integer not null check (quantity > 0 and quantity <= 100000),
  from_location  public.location not null,   -- source: sends the stock, approves/rejects
  to_location    public.location not null,   -- destination: asked for the stock, marks received
  status         public.request_status not null default 'pending',
  created_by     uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at     timestamptz not null default now(),
  approved_at    timestamptz,
  completed_at   timestamptz,
  check (from_location <> to_location),
  check (
       (status = 'pending'   and approved_at is null     and completed_at is null)
    or (status = 'approved'  and approved_at is not null and completed_at is null)
    or (status = 'completed' and approved_at is not null and completed_at is not null)
    or (status = 'rejected'  and approved_at is null     and completed_at is null)
  )
);

-- ---------------------------------------------------------------------------
-- Indexes (inventory's unique constraint already covers product_id lookups)
-- ---------------------------------------------------------------------------
create index products_name_idx            on public.products (lower(name));
create index requests_product_id_idx      on public.requests (product_id);
create index requests_created_by_idx      on public.requests (created_by);
create index requests_status_created_idx  on public.requests (status, created_at desc);
create index requests_created_at_idx      on public.requests (created_at desc);

-- ---------------------------------------------------------------------------
-- Profiles are created automatically for every auth user (unassigned)
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers used by policies and functions
-- ---------------------------------------------------------------------------
create function public.my_location()
returns public.location
language sql stable security definer set search_path = ''
as $$ select location from public.profiles where id = auth.uid() $$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

-- Staff = signed in AND assigned to a location, or an administrator.
create function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select location is not null or is_admin from public.profiles where id = auth.uid()),
    false)
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security + grants
-- ---------------------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.products  enable row level security;
alter table public.inventory enable row level security;
alter table public.requests  enable row level security;

revoke all on public.profiles, public.products, public.inventory, public.requests from anon, authenticated;

-- Read access
grant select on public.profiles, public.products, public.inventory, public.requests to authenticated;

create policy "Users read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "Staff read products" on public.products
  for select to authenticated using ((select public.is_staff()));

create policy "Staff read inventory" on public.inventory
  for select to authenticated using ((select public.is_staff()));

create policy "Staff read requests" on public.requests
  for select to authenticated using ((select public.is_staff()));

-- The only direct write a client can make: create a pending request for its
-- own location. Column grants stop clients setting status/timestamps/owner.
grant insert (product_id, quantity, from_location, to_location) on public.requests to authenticated;

create policy "Staff request stock for their own location" on public.requests
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and to_location = (select public.my_location())
    and status = 'pending'
  );

-- No UPDATE / DELETE grants or policies on any table: profiles, products,
-- inventory and request status can only change through the functions below.

-- ---------------------------------------------------------------------------
-- Request transitions (atomic: lock request -> validate -> move stock -> status)
-- Lock order is always request row, then inventory row, to avoid deadlocks.
-- ---------------------------------------------------------------------------
create function public.approve_request(p_request_id uuid)
returns public.requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.requests;
begin
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.from_location is distinct from public.my_location() then raise exception 'NOT_ALLOWED'; end if;
  if r.status <> 'pending' then raise exception 'ALREADY_PROCESSED'; end if;

  update public.inventory
     set quantity = quantity - r.quantity
   where product_id = r.product_id
     and location = r.from_location
     and quantity >= r.quantity;
  if not found then raise exception 'INSUFFICIENT_STOCK'; end if;

  update public.requests
     set status = 'approved', approved_at = now()
   where id = r.id
  returning * into r;
  return r;
end;
$$;

create function public.reject_request(p_request_id uuid)
returns public.requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.requests;
begin
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.from_location is distinct from public.my_location() then raise exception 'NOT_ALLOWED'; end if;
  if r.status <> 'pending' then raise exception 'ALREADY_PROCESSED'; end if;

  update public.requests set status = 'rejected' where id = r.id returning * into r;
  return r;
end;
$$;

create function public.complete_request(p_request_id uuid)
returns public.requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.requests;
begin
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.to_location is distinct from public.my_location() then raise exception 'NOT_ALLOWED'; end if;
  if r.status <> 'approved' then raise exception 'ALREADY_PROCESSED'; end if;

  insert into public.inventory (product_id, location, quantity)
  values (r.product_id, r.to_location, r.quantity)
  on conflict (product_id, location)
  do update set quantity = public.inventory.quantity + excluded.quantity;

  update public.requests
     set status = 'completed', completed_at = now()
   where id = r.id
  returning * into r;
  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- Administrator functions
-- ---------------------------------------------------------------------------

-- Create (p_product_id null) or edit a product and set both stock levels.
-- When editing, pass the quantities the admin was looking at; if either has
-- changed since (e.g. a transfer was approved meanwhile) the save is refused
-- so a stale screen can never overwrite real stock movements.
create function public.admin_save_product(
  p_product_id         uuid,
  p_name               text,
  p_image_path         text,
  p_main_store_qty     integer,
  p_warehouse_qty      integer,
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
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  if p_main_store_qty is null or p_warehouse_qty is null
     or p_main_store_qty < 0 or p_warehouse_qty < 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  if p_product_id is null then
    insert into public.products (name, image_path)
    values (btrim(p_name), p_image_path)
    returning id into v_id;
  else
    update public.products
       set name = btrim(p_name), image_path = p_image_path
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

-- Assign an existing account (created in Supabase Auth) to a location.
-- Administrator status is never changed here; it is set only in SQL.
create function public.admin_assign_employee(p_email text, p_location public.location)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  if p_location is null then raise exception 'INVALID_LOCATION'; end if;

  select id into v_user_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_user_id is null then raise exception 'USER_NOT_FOUND'; end if;

  insert into public.profiles (id, location) values (v_user_id, p_location)
  on conflict (id) do update set location = excluded.location;
end;
$$;

-- Functions are callable only by signed-in users; each checks its own rules.
revoke execute on function
  public.handle_new_user(),
  public.my_location(), public.is_admin(), public.is_staff(),
  public.approve_request(uuid), public.reject_request(uuid), public.complete_request(uuid),
  public.admin_save_product(uuid, text, text, integer, integer, integer, integer),
  public.admin_assign_employee(text, public.location)
from public, anon;

grant execute on function
  public.my_location(), public.is_admin(), public.is_staff(),
  public.approve_request(uuid), public.reject_request(uuid), public.complete_request(uuid),
  public.admin_save_product(uuid, text, text, integer, integer, integer, integer),
  public.admin_assign_employee(text, public.location)
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (postgres_changes respects the RLS select policies above)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.products, public.inventory, public.requests;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, staff can view, only administrators can write
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Staff view product images" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_staff()));

create policy "Admins upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "Admins update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

create policy "Admins delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
