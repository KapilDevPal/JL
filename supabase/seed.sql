-- TEST DATA ONLY. Do not run on a live store.
-- Run this in Supabase > SQL Editor AFTER all four migrations.
-- Safe to run more than once: existing users/products are left alone.
--
-- Creates 5 test logins (all use the password: Test@12345)
--   admin@example.com        Administrator (also Main Store)
--   warehouse1@example.com   Warehouse  - Ravi Kumar
--   warehouse2@example.com   Warehouse  - Neha Singh
--   store1@example.com       Main Store - Priya Sharma
--   store2@example.com       Main Store - Arjun Mehta
-- plus 12 sample products with stock and 2 pending requests.

do $$
declare
  u        record;
  v_id     uuid;
begin
  for u in
    select * from (values
      ('admin@example.com',      'Admin',        'main_store'::public.location, true),
      ('warehouse1@example.com', 'Ravi Kumar',   'warehouse'::public.location,  false),
      ('warehouse2@example.com', 'Neha Singh',   'warehouse'::public.location,  false),
      ('store1@example.com',     'Priya Sharma', 'main_store'::public.location, false),
      ('store2@example.com',     'Arjun Mehta',  'main_store'::public.location, false)
    ) as t(email, display_name, location, is_admin)
  loop
    select id into v_id from auth.users where email = u.email;

    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', u.email,
        extensions.crypt('Test@12345', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(),
        '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (
        gen_random_uuid(), v_id, v_id::text,
        jsonb_build_object('sub', v_id::text, 'email', u.email, 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;

    -- The sign-up trigger creates the profile; set location, name and admin flag.
    insert into public.profiles (id, location, is_admin, display_name)
    values (v_id, u.location, u.is_admin, u.display_name)
    on conflict (id) do update
      set location = excluded.location, is_admin = excluded.is_admin, display_name = excluded.display_name;
  end loop;
end;
$$;

-- Sample products and stock (skipped if a product with the same name exists).
with items(name, main_store, warehouse) as (
  values
    ('Pearl Drop Earrings',   12, 40),
    ('Gold Hoop Earrings',     6, 25),
    ('Silver Stud Earrings',  20, 60),
    ('Rose Gold Bracelet',     4, 18),
    ('Charm Bracelet',         0, 30),
    ('Diamond Solitaire Ring', 2,  5),
    ('Silver Band Ring',      15, 45),
    ('Gold Chain Necklace',    3, 12),
    ('Layered Pendant',        8, 20),
    ('Crystal Hair Clip',     10,  0),
    ('Leather Watch Strap',    5, 15),
    ('Velvet Gift Box',       30, 100)
),
new_products as (
  insert into public.products (name)
  select i.name from items i
  where not exists (select 1 from public.products p where lower(p.name) = lower(i.name))
  returning id, name
)
insert into public.inventory (product_id, location, quantity)
select np.id, l.location, case l.location when 'main_store' then i.main_store else i.warehouse end
from new_products np
join items i on i.name = np.name
cross join (values ('main_store'::public.location), ('warehouse'::public.location)) as l(location);

-- Two pending requests to try approve/reject with (no stock moves until approved).
insert into public.requests (product_id, quantity, from_location, to_location, created_by)
select p.id, 10, 'warehouse', 'main_store', (select id from auth.users where email = 'store1@example.com')
from public.products p
where p.name = 'Pearl Drop Earrings'
  and not exists (select 1 from public.requests r where r.product_id = p.id and r.status = 'pending');

insert into public.requests (product_id, quantity, from_location, to_location, created_by)
select p.id, 5, 'main_store', 'warehouse', (select id from auth.users where email = 'warehouse1@example.com')
from public.products p
where p.name = 'Crystal Hair Clip'
  and not exists (select 1 from public.requests r where r.product_id = p.id and r.status = 'pending');

-- Check the result
select u.email, p.display_name, p.location, p.is_admin
from auth.users u join public.profiles p on p.id = u.id
where u.email like '%@example.com'
order by p.is_admin desc, p.location, u.email;
