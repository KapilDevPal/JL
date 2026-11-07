\set ON_ERROR_STOP 0
\set VERBOSITY terse
\pset footer off

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@x.com'),
  ('00000000-0000-0000-0000-00000000000b', 'main@x.com'),
  ('00000000-0000-0000-0000-00000000000c', 'wh@x.com'),
  ('00000000-0000-0000-0000-00000000000d', 'new@x.com');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000a';
select 'profiles auto-created' as check, count(*) from public.profiles;

create function pg_temp.as_user(u text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

-- ---------- admin assigns employees ----------
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.admin_assign_employee('MAIN@x.com', 'main_store');
select public.admin_assign_employee('wh@x.com', 'warehouse');
\echo 'EXPECT USER_NOT_FOUND:'
select public.admin_assign_employee('nobody@x.com', 'warehouse');

\echo '---- employee cannot use admin functions or edit profiles'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
\echo 'EXPECT NOT_ALLOWED:'
select public.admin_assign_employee('main@x.com', 'warehouse');
\echo 'EXPECT NOT_ALLOWED:'
select public.admin_save_product(null, 'Hack', null, 1, 1);
\echo 'EXPECT permission denied (profiles update):'
update public.profiles set is_admin = true, location = 'warehouse';
select 'own profile visible' as check, location, is_admin from public.profiles;

\echo '---- admin creates product with stock'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.admin_save_product(null, '  Gold Earrings ', 'a.jpg', 5, 20) is not null as created;
select name, location, quantity from public.products p join public.inventory i on i.product_id = p.id order by location;

\echo '---- unassigned user sees nothing'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select 'unassigned sees products' as check, count(*) from public.products;

\echo '---- Main Store requests 10 from Warehouse'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.requests (product_id, quantity, from_location, to_location)
  select id, 10, 'warehouse', 'main_store' from public.products;
\echo 'EXPECT RLS violation (requesting for the other location):'
insert into public.requests (product_id, quantity, from_location, to_location)
  select id, 1, 'main_store', 'warehouse' from public.products;
\echo 'EXPECT permission denied (setting status directly):'
insert into public.requests (product_id, quantity, from_location, to_location, status)
  select id, 1, 'warehouse', 'main_store', 'approved' from public.products;
\echo 'EXPECT check violation (quantity 0):'
insert into public.requests (product_id, quantity, from_location, to_location)
  select id, 0, 'warehouse', 'main_store' from public.products;
\echo 'EXPECT permission denied (inventory update):'
update public.inventory set quantity = 999;
\echo 'EXPECT permission denied (request update):'
update public.requests set status = 'completed';
\echo 'EXPECT NOT_ALLOWED (destination cannot approve):'
select public.approve_request((select id from public.requests limit 1));

\echo '---- Warehouse approves'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select status, approved_at is not null as has_approved_at from public.approve_request((select id from public.requests limit 1));
\echo 'EXPECT ALREADY_PROCESSED (duplicate approval):'
select public.approve_request((select id from public.requests limit 1));
\echo 'EXPECT ALREADY_PROCESSED (reject after approve):'
select public.reject_request((select id from public.requests limit 1));
\echo 'EXPECT NOT_ALLOWED (source cannot mark received):'
select public.complete_request((select id from public.requests limit 1));
select 'after approve' as check, location, quantity from public.inventory order by location;

\echo '---- Main Store confirms receipt'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select status from public.complete_request((select id from public.requests limit 1));
\echo 'EXPECT ALREADY_PROCESSED (duplicate receipt):'
select public.complete_request((select id from public.requests limit 1));
select 'after receipt' as check, location, quantity from public.inventory order by location;

\echo '---- insufficient stock, then reject'
insert into public.requests (product_id, quantity, from_location, to_location)
  select id, 50, 'warehouse', 'main_store' from public.products;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
\echo 'EXPECT INSUFFICIENT_STOCK:'
select public.approve_request((select id from public.requests where quantity = 50));
select 'still pending' as check, status from public.requests where quantity = 50;
select status from public.reject_request((select id from public.requests where quantity = 50));
select 'unchanged' as check, location, quantity from public.inventory order by location;

\echo '---- reverse direction: Warehouse requests 3 from Main Store'
insert into public.requests (product_id, quantity, from_location, to_location)
  select id, 3, 'main_store', 'warehouse' from public.products;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select status from public.approve_request((select id from public.requests where quantity = 3));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select status from public.complete_request((select id from public.requests where quantity = 3));
select 'after reverse' as check, location, quantity from public.inventory order by location;

\echo '---- admin edit: stale expected stock is refused, current is accepted'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
\echo 'EXPECT STOCK_CHANGED:'
select public.admin_save_product((select id from public.products), 'Gold Earrings', 'b.jpg', 1, 1, 5, 20);
select public.admin_save_product((select id from public.products), 'Gold Hoops', 'b.jpg', 12, 13, 12, 13) is not null as saved;
\echo 'EXPECT INVALID_QUANTITY:'
select public.admin_save_product((select id from public.products), 'Gold Hoops', 'b.jpg', -1, 13, 12, 13);
select name, image_path, location, quantity from public.products p join public.inventory i on i.product_id = p.id order by location;

\echo '---- storage policies'
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
\echo 'EXPECT RLS violation (employee upload):'
insert into storage.objects (bucket_id, name) values ('product-images', 'x.jpg');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into storage.objects (bucket_id, name) values ('product-images', 'x.jpg');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select 'employee can view images' as check, count(*) from storage.objects;

\echo '---- anon has no access'
reset role;
set role anon;
\echo 'EXPECT permission denied:'
select count(*) from public.products;
\echo 'EXPECT permission denied:'
select public.approve_request(gen_random_uuid());
reset role;

select 'publication tables' as check, string_agg(tablename, ', ' order by tablename) from pg_publication_tables where pubname = 'supabase_realtime';
