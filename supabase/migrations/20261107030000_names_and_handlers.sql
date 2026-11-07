-- Show who did what on each request.
--  * profiles.display_name: set by the administrator (defaults to the email
--    name before the @).
--  * requests.responded_by: source-location user who approved or rejected.
--  * requests.received_by:  destination-location user who confirmed receipt.
-- Staff can now read colleagues' profiles (id, name, location) so names can
-- be shown. Profiles are still not writable by clients.

alter table public.profiles
  add column display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 80);

update public.profiles p
   set display_name = left(split_part(u.email, '@', 1), 80)
  from auth.users u
 where u.id = p.id and p.display_name is null and u.email is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(split_part(coalesce(new.email, ''), '@', 1), 80), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy "Users read their own profile" on public.profiles;
create policy "Users read their own profile and staff read all" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));

alter table public.requests
  add column responded_by uuid references public.profiles (id) on delete restrict,
  add column received_by  uuid references public.profiles (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Transition functions now record who acted. Logic is otherwise unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.approve_request(p_request_id uuid)
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
     set status = 'approved', approved_at = now(), responded_by = auth.uid()
   where id = r.id
  returning * into r;
  return r;
end;
$$;

create or replace function public.reject_request(p_request_id uuid)
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

  update public.requests
     set status = 'rejected', responded_by = auth.uid()
   where id = r.id
  returning * into r;
  return r;
end;
$$;

create or replace function public.complete_request(p_request_id uuid)
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
     set status = 'completed', completed_at = now(), received_by = auth.uid()
   where id = r.id
  returning * into r;
  return r;
end;
$$;

-- Assigning an employee can now also set their display name.
drop function public.admin_assign_employee(text, public.location);

create function public.admin_assign_employee(p_email text, p_location public.location, p_display_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_name    text := nullif(btrim(p_display_name), '');
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  if p_location is null then raise exception 'INVALID_LOCATION'; end if;
  if v_name is not null and char_length(v_name) > 80 then raise exception 'INVALID_NAME'; end if;

  select id into v_user_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_user_id is null then raise exception 'USER_NOT_FOUND'; end if;

  insert into public.profiles (id, location, display_name) values (v_user_id, p_location, v_name)
  on conflict (id) do update
    set location = excluded.location,
        display_name = coalesce(excluded.display_name, public.profiles.display_name);
end;
$$;

revoke execute on function public.admin_assign_employee(text, public.location, text) from public, anon;
grant execute on function public.admin_assign_employee(text, public.location, text) to authenticated;
