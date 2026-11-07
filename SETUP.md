# Setup checklist

Follow these steps in order. Part A is done on the Supabase website, Part B in this project.

## Part A: Supabase website

### 1. Create the project
- [ ] Sign in at [supabase.com](https://supabase.com) and click **New project**.
- [ ] Choose a name, a database password (save it somewhere safe) and the region closest to your stores (for example, Sydney).
- [ ] Wait for the project to finish setting up.

### 2. Create the database
- [ ] Open **SQL Editor → New query**.
- [ ] Open [supabase/migrations/20261107000000_inventory.sql](supabase/migrations/20261107000000_inventory.sql) in this project, copy all of it and paste it into the editor.
- [ ] Click **Run**. You should see "Success. No rows returned".
- [ ] Check **Table Editor**. It should list `profiles`, `products`, `inventory` and `requests`.

- [ ] Open another **New query**, paste all of [supabase/migrations/20261107010000_multiple_images.sql](supabase/migrations/20261107010000_multiple_images.sql) and click **Run**. This adds multiple photos per product. If you already have products, their existing photo becomes the cover photo.
- [ ] Open another **New query**, paste all of [supabase/migrations/20261107020000_bulk_import.sql](supabase/migrations/20261107020000_bulk_import.sql) and click **Run**. This adds bulk import from CSV or Excel.
- [ ] Open another **New query**, paste all of [supabase/migrations/20261107030000_names_and_handlers.sql](supabase/migrations/20261107030000_names_and_handlers.sql) and click **Run**. This shows who requested, sent and received each request.

Run each file only once, in this order. Running one a second time fails because its changes already exist.

### Optional: add test users and dummy products
For testing only. Don't do this on your live store.
- [ ] Open a **New query**, paste all of [supabase/seed.sql](supabase/seed.sql) and click **Run**. It's safe to run again.
- [ ] It creates these logins. They all use the password **`Test@12345`**:

| Email | Role | Name |
| --- | --- | --- |
| admin@example.com | Administrator (and Main Store) | Admin |
| warehouse1@example.com | Warehouse | Ravi Kumar |
| warehouse2@example.com | Warehouse | Neha Singh |
| store1@example.com | Main Store | Priya Sharma |
| store2@example.com | Main Store | Arjun Mehta |

It also adds 12 jewellery products with stock (no photos) and 2 pending requests. To try CSV import, sign in as admin, tap the upload icon and choose [templates/sample-import-test.csv](templates/sample-import-test.csv). It updates 2 existing products and adds 3 new ones.

If you seed test users, you can skip steps 4 and 5.

### 3. Turn off public sign-up
- [ ] Open **Authentication → Sign In / Providers**.
- [ ] Make sure **Email** is enabled.
- [ ] Turn **off** "Allow new users to sign up" and save.

### 4. Create the administrator account
- [ ] Open **Authentication → Users → Add user → Create new user**.
- [ ] Enter the admin's email and password, tick **Auto Confirm User** and click **Create user**.
- [ ] Open **SQL Editor**, paste the following (change the email) and click **Run**:

```sql
update public.profiles
   set is_admin = true
 where id = (select id from auth.users where email = 'admin@example.com');
```

If the admin also works at a location and needs to approve or receive requests, run this as well:

```sql
update public.profiles
   set location = 'main_store'   -- or 'warehouse'
 where id = (select id from auth.users where email = 'admin@example.com');
```

### 5. Create employee accounts
For each employee:
- [ ] Open **Authentication → Users → Add user → Create new user**.
- [ ] Enter their email and a password, tick **Auto Confirm User** and click **Create user**.
- [ ] Give them their email and password.

You assign each employee's location later, in the app (step 9).

### 6. Check storage and realtime
The SQL in step 2 already set these up. You only need to confirm them:
- [ ] **Storage** lists a bucket named `product-images` marked **Private**.
- [ ] **Database → Publications → supabase_realtime** includes `products`, `inventory` and `requests`.

### 7. Copy your API keys
- [ ] Open **Project Settings → API Keys** (or the **Connect** button at the top of the dashboard).
- [ ] Copy the **Project URL**. It looks like `https://abcdefgh.supabase.co`.
- [ ] Copy the **Publishable key**, which starts with `sb_publishable_`. The legacy **anon** key also works.

Never copy the **secret** or **service_role** key into the app.

## Part B: The app

### 8. Add the keys
- [ ] In the project folder, copy `.env.example` to a new file named `.env`:

```bash
cp .env.example .env
```

- [ ] Open `.env` and paste your values:

```
EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx
```

`.env` is excluded from git, so your keys are never pushed to GitHub.

### 9. Run the app and finish setup
- [ ] Install and start:

```bash
npm install
npx expo start
```

- [ ] Install **Expo Go** on your phone and scan the QR code shown in the terminal.
- [ ] Sign in as the administrator.
- [ ] Tap the **person icon** at the top of the Products tab and assign each employee to **Main Store** or **Warehouse**. Fill in **Name shown on requests** so their real name appears instead of their email name.
- [ ] Tap **+** to add your products, each with photos and its stock at both locations.
- [ ] Or add many at once: tap the **upload icon** and choose a CSV or Excel file with the columns `Name`, `Main Store` and `Warehouse`. [templates/products-import-template.csv](templates/products-import-template.csv) is a ready-made example. Check the preview, then tap **Import**. Add photos afterwards with **Edit**.

### 10. Test with two phones
- [ ] Phone A: sign in as a Main Store employee. Phone B: sign in as a Warehouse employee.
- [ ] Phone A: tap **Request from Warehouse** on a product, choose a quantity and tap **Request**.
- [ ] Phone B: the request appears under **Requests → Incoming**. Tap **Approve**.
- [ ] Both phones: Warehouse stock goes down and the product shows "in transit".
- [ ] Phone A: under **Requests → Outgoing**, tap **Received**. Main Store stock goes up.
- [ ] The request shows who requested it, who sent it and who received it.

### 11. Optional: hand over with a QR code
Instead of finding the request in the list, staff can scan it:
- **To approve:** the requester opens the request. A QR code appears on their screen. The sending location taps the **QR icon** on the Requests tab and scans it. The request opens with **Approve** ready.
- **To receive:** whoever delivers the items opens the request on their phone and shows the QR code. The receiving location scans it, and the request opens with **Received** ready.

Scanning only opens the request; the person still taps **Approve** or **Received**. The app asks for camera permission the first time.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| App shows "Missing EXPO_PUBLIC_SUPABASE_URL" | `.env` is missing or misspelt. Fix it, then restart with `npx expo start --clear`. |
| "Email or password is incorrect" | Check the user exists under **Authentication → Users** and was auto-confirmed. |
| Employee sees "Almost ready" | They have no location yet. Assign one with the person icon (admin), then they tap **Check again**. |
| Admin doesn't see **+** or the person icon | The `is_admin` SQL in step 4 wasn't run for that email. Run it, then sign out and back in. |
| Photos don't load | Confirm the `product-images` bucket exists (step 6). |
