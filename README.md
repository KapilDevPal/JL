# Stock

A minimal inventory app for two locations, **Main Store** and **Warehouse**. Staff can see stock at both locations and request items from each other. The other location approves or rejects each request, and the requesting location confirms when the items arrive.

Built with Expo (SDK 58), Expo Router, TypeScript and Supabase (Postgres, Auth, Storage, Realtime). There is no custom backend.

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
2. Apply the migration in [supabase/migrations/20261107000000_inventory.sql](supabase/migrations/20261107000000_inventory.sql). Use either method:
   - **SQL Editor**: paste the whole file and run it.
   - **CLI**: run `npx supabase link --project-ref <ref>`, then `npx supabase db push`.

The migration creates the tables, constraints, indexes, Row Level Security policies, functions, a private `product-images` storage bucket and the Realtime publication entries.

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

### Database tests

[supabase/tests/](supabase/tests/) runs the whole workflow and the abuse cases against plain Postgres. It covers both directions, duplicate approval or receipt, insufficient stock, wrong-location actions, direct table writes, stale admin edits, storage permissions and anonymous access. A stub file stands in for Supabase's `auth` and `storage` schemas.

```bash
docker run -d --name stock-pg -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:15
export PGPASSWORD=pw; P="psql -h localhost -p 55432 -U postgres"
$P -f supabase/tests/00_supabase_stub.sql
$P -f supabase/migrations/20261107000000_inventory.sql
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
  product-form.tsx    Add or edit product (admin)
  assign.tsx          Assign employee to a location (admin)
  sign-in.tsx, unassigned.tsx
src/lib/              Supabase client, auth, data and Realtime sync, images, errors
src/components/       Small UI pieces and theme
supabase/             Migration and SQL tests
```
