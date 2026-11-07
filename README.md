# Stock

A minimal inventory app for two locations, **Main Store** and **Warehouse**. Staff can see stock at both locations and request items from each other. The other location approves or rejects each request, and the requesting location confirms when the items arrive.

Built with Expo (SDK 58), Expo Router, TypeScript and Supabase (Postgres, Auth, Storage, Realtime). There is no custom backend.

**Features**
- **Products:** search, a list or grid view, up to 8 photos per product (the first is the cover) and stock at both locations.
- **Requests:** Incoming, Outgoing and History tabs, with approve, reject and receive. Each request shows who requested, sent and received it.
- **QR handover:** scan the QR code on the other person's phone to open a request with its action ready.
- **Admin tools:** add or edit products, bulk import from CSV or Excel, and assign employees to a location with a display name.
- **Live updates:** changes appear on other phones straight away. When offline, a banner shows and stock-changing buttons are disabled.

Step-by-step setup is in [SETUP.md](SETUP.md).

## How it works

| Step | Who | What happens |
| --- | --- | --- |
| Request | Destination staff | Creates a `pending` request. No stock moves. |
| Approve | Source staff | Stock is deducted from the source and the request becomes `approved` (shown as **In transit**). |
| Reject | Source staff | The request becomes `rejected`. No stock moves. |
| Received | Destination staff | Stock is added to the destination and the request becomes `completed`. |

Requests work in both directions. Partial transfers aren't supported.

**Stock safety.** Phones can't write to `inventory`, `products` or `profiles`, and they can't change a request's status. The only direct write allowed is inserting a `pending` request for your own location. Every stock change goes through a Postgres function (`approve_request`, `reject_request`, `complete_request`, `admin_save_product`). Each function locks the rows it touches, checks permissions and status, and moves the stock in a single transaction. That blocks negative stock, duplicate approvals or receipts, and races between two phones. When an administrator edits stock, the save is refused if the stock moved after the form was opened.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Apply all four migrations in [supabase/migrations/](supabase/migrations/), in filename order. Use either method:
   - **SQL Editor**: paste each whole file and run it, in this order: `20261107000000_inventory.sql`, `20261107010000_multiple_images.sql`, `20261107020000_bulk_import.sql`, `20261107030000_names_and_handlers.sql`.
   - **CLI**: run `npx supabase link --project-ref <ref>`, then `npx supabase db push`.

The first migration creates the tables, constraints, indexes, Row Level Security policies, functions, a private `product-images` storage bucket and the Realtime publication entries. The second replaces the single `image_path` with an ordered `image_paths` list of up to 8 photos, where the first is the cover.

The third adds `admin_import_products`, which bulk imports products in a single all-or-nothing transaction. Rows are matched to existing products by name, ignoring case: a match sets that product's stock, and any other name creates a new product.

**Changes from the original spec, made later at the owner's request:**
- Multiple images per product. The spec asked for one.
- Bulk import from CSV or Excel. The app reads the first sheet with SheetJS, which is installed from the official SheetJS CDN because the npm copy is outdated. The import screen previews every row and blocks the import until the file has no errors. [templates/products-import-template.csv](templates/products-import-template.csv) shows the format.
- Names on requests: `profiles.display_name` (set by the admin when assigning, defaulting to the email name), plus `requests.responded_by` and `requests.received_by`, which the transition functions record. Staff can read colleagues' profiles so names can be shown. Profiles stay read-only for clients.
- QR handover. The spec listed barcode scanning under "do not build". A request shows a QR code (`stockreq:<id>`) to whoever is not taking the next step, and the person who is scans it from the Requests tab to open the request. The QR only opens the request; the database still checks who may approve or receive.

## 2. Auth

1. Go to **Authentication → Sign In / Providers**. Keep **Email** enabled and turn **off** "Allow new users to sign up". Only the administrator creates accounts. Accounts that sign up some other way have no location, so they can't see any data.
2. Create the administrator. Go to **Authentication → Users → Add user**, enter an email and password, and tick **Auto Confirm User**. Then run this in the SQL Editor:

   ```sql
   update public.profiles
      set is_admin = true,
          location = null          -- or 'main_store' / 'warehouse' if the admin also handles requests
    where id = (select id from auth.users where email = 'admin@example.com');
   ```

   `is_admin` can only be changed in SQL. The app has no way to grant or remove it.
3. Create each employee the same way: **Add user**, then **Auto Confirm User**. Then sign in to the app as the administrator, tap the person icon on the Products tab and assign the employee to Main Store or Warehouse. Employees can't change their own location.

## 3. Storage

You don't need to set anything up. The migration creates the `product-images` bucket. It's private, accepts JPEG only and has a 5 MB limit. Assigned staff can view images, and only administrators can upload, replace or delete them. The app compresses photos to at most 1200 px at JPEG quality 0.7 before uploading, and loads them over the authenticated storage endpoint.

## 4. Realtime

The migration adds `products`, `inventory` and `requests` to the `supabase_realtime` publication. To confirm, check **Database → Publications**. Realtime follows the same RLS policies as normal reads.

## 5. Environment variables

```bash
cp .env.example .env
```

Fill in the values from **Project Settings → API Keys**:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # the legacy anon key also works
```

Never put the secret or service-role key in the app.

## 6. Run

```bash
npm install
npx expo start
```

Open the app in Expo Go or on a simulator. Every native module it uses ships with Expo Go. For store builds, use EAS: `npx eas-cli@latest build`.

```bash
npm run typecheck
npx expo-doctor
```

## Testing the workflow

### Test users and dummy data

After applying all four migrations, run [supabase/seed.sql](supabase/seed.sql) in the SQL Editor. It creates five logins that all use the password `Test@12345`: `admin@example.com` (admin), `warehouse1@` and `warehouse2@example.com`, and `store1@` and `store2@example.com`. It also adds 12 sample products with stock and 2 pending requests. It's safe to re-run. Never run it on a live store, because everyone knows the password. [templates/sample-import-test.csv](templates/sample-import-test.csv) exercises the CSV import: it updates 2 seeded products and adds 3 new ones.

### Database tests

[supabase/tests/](supabase/tests/) runs the whole workflow and the abuse cases against plain Postgres. It covers both directions, duplicate approval or receipt, insufficient stock, wrong-location actions, direct table writes, stale admin edits, storage permissions and anonymous access. A stub file stands in for Supabase's `auth` and `storage` schemas.

```bash
docker run -d --name stock-pg -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:15
export PGPASSWORD=pw; P="psql -h localhost -p 55432 -U postgres"
$P -f supabase/tests/00_supabase_stub.sql
$P -f supabase/migrations/20261107000000_inventory.sql
$P -f supabase/migrations/20261107010000_multiple_images.sql
$P -f supabase/migrations/20261107020000_bulk_import.sql
$P -f supabase/migrations/20261107030000_names_and_handlers.sql
$P -f supabase/tests/10_workflow_test.sql   # each "EXPECT ..." line is followed by that error
docker rm -f stock-pg
```

### On two phones

1. Sign in as a Main Store employee on phone A and a Warehouse employee on phone B.
2. As the administrator, add a product with a photo, 5 at Main Store and 20 at Warehouse.
3. On phone A, tap **Request from Warehouse**, enter 10 and tap **Request**. The request appears under **Incoming** on phone B without a refresh.
4. On phone B, tap **Approve**. Warehouse stock drops to 10 on both phones, and the product shows "10 in transit to Main Store".
5. On phone A, open **Requests → Outgoing** and tap **Received**. Main Store stock rises to 15.
6. Turn on flight mode. The offline banner appears and the stock buttons are disabled. Turn it off, and the data reloads.

## Project layout

```
src/app/              Screens (Expo Router)
  (tabs)/index.tsx    Products
  (tabs)/requests.tsx Requests: Incoming, Outgoing, History
  request-new.tsx     Request modal
  request/[id].tsx    Request details modal
  product/[id].tsx    Product details with photo gallery
  product-form.tsx    Add or edit product and photos (admin)
  assign.tsx          Assign employee to a location (admin)
  import.tsx          Bulk import products from CSV or Excel (admin)
  scan.tsx            Scan a request QR code
  sign-in.tsx, unassigned.tsx
src/lib/              Supabase client, auth, data and Realtime sync, images, errors
src/components/       Small UI pieces and theme
supabase/             Migrations, SQL tests and seed.sql (test data)
templates/            Sample CSV files for import
```
