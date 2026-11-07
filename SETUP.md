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

Run this file only once. Running it a second time fails because the tables already exist.

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
- [ ] Tap the **person icon** at the top of the Products tab and assign each employee to **Main Store** or **Warehouse**.
- [ ] Tap **+** to add your products, each with a photo and its stock at both locations.

### 10. Test with two phones
- [ ] Phone A: sign in as a Main Store employee. Phone B: sign in as a Warehouse employee.
- [ ] Phone A: tap **Request from Warehouse** on a product, choose a quantity and tap **Request**.
- [ ] Phone B: the request appears under **Requests → Incoming**. Tap **Approve**.
- [ ] Both phones: Warehouse stock goes down and the product shows "in transit".
- [ ] Phone A: under **Requests → Outgoing**, tap **Received**. Main Store stock goes up.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| App shows "Missing EXPO_PUBLIC_SUPABASE_URL" | `.env` is missing or misspelt. Fix it, then restart with `npx expo start --clear`. |
| "Email or password is incorrect" | Check the user exists under **Authentication → Users** and was auto-confirmed. |
| Employee sees "Almost ready" | They have no location yet. Assign one with the person icon (admin), then they tap **Check again**. |
| Admin doesn't see **+** or the person icon | The `is_admin` SQL in step 4 wasn't run for that email. Run it, then sign out and back in. |
| Photos don't load | Confirm the `product-images` bucket exists (step 6). |
