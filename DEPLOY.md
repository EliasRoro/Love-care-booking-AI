# Deploying CareNest — from zero to live

**Time needed:** about 45–60 minutes the first time.
**Cost:** $0 (all free tiers).
**You need:** an email address, a web browser, and somewhere to host static files (Netlify, Vercel, or Cloudflare Pages — all free).

> Brand note: "CareNest" is a **working name, not finalized**. To rebrand later, change one constant (`BRAND_NAME` in `js/config.js`) and redeploy. Also update the `<title>` tags if you want to be thorough.

---

## Step 1 — Create the Supabase project (free)

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub login is fastest).
2. **New project** → name it `carenest` (or anything), pick a strong database password and **save it somewhere safe**.
3. Choose the region closest to you (e.g. Canada / `ca-central-1` if offered, otherwise US East).
4. Wait ~2 minutes for provisioning.

## Step 2 — Run the database schema

1. In the Supabase dashboard, open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy the **entire file**, paste it into the editor.
3. Click **Run**. You should see "Success. No rows returned."
4. Verify: open **Table Editor** — you should see tables `clients`, `psws`, `documents`, `bookings`, `payments`, `reviews`, `admin_users`.

> The schema also creates the private `psw-documents` storage bucket and all Row Level Security policies. Nothing else to configure for storage.

## Step 3 — Get your API keys

1. Go to **Project Settings** (gear icon) → **API**.
2. Copy:
   - **Project URL** → `https://xyzcompany.supabase.co`
   - **anon public key** → the long `eyJ...` key under "Project API keys"
3. Open `js/config.js` in this repo and replace:
   - `SUPABASE_URL: "YOUR_SUPABASE_URL"` → your Project URL
   - `SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY"` → your anon key
   - `CONTACT_EMAIL` / `CONTACT_PHONE` → your real business contact (or leave until you have them)

## Step 4 — Configure Auth

1. In Supabase: **Authentication** → **Providers** → make sure **Email** is enabled.
2. **Authentication** → **URL Configuration**:
   - **Site URL**: for now, leave as-is. After deploying (Step 6), come back and set it to your live URL (e.g. `https://carenest.netlify.app`).
   - **Redirect URLs**: add your local test URL (`http://localhost:8000`) and later your live URL.
3. (Optional but recommended) **Authentication** → **Policies**: turn off "Allow new users to sign up" — admins are created by you manually (Step 5), the public never needs Auth accounts in v1.

## Step 5 — Create your admin account

1. In Supabase: **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter your email + a strong password. Check **Auto Confirm User**.
3. Copy the new user's **UID**.
4. Go to **SQL Editor** → **New query** → run:
   ```sql
   insert into public.admin_users (user_id, role)
   values ('PASTE_THE_UID_HERE', 'admin');
   ```
   (This bypasses RLS because the SQL editor runs with elevated privileges.)
5. Verify: `select * from public.admin_users;` should show your row.

## Step 6 — Deploy the frontend (pick one)

All three are free and take ~5 minutes. The site is plain HTML/CSS/JS — no build step.

**Option A — Netlify (easiest):**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the entire project folder (the one containing `index.html`) onto the page.
3. Done — you get a live URL like `https://random-name.netlify.app`. Rename it under Site settings.

**Option B — Vercel:**
1. Push this folder to a GitHub repo, then **Import** it at [vercel.com](https://vercel.com). Or use `vercel` CLI: `npx vercel` in the folder.

**Option C — Cloudflare Pages:**
1. [pages.cloudflare.com](https://pages.cloudflare.com) → **Upload assets** → drag the folder.

## Step 7 — Point Supabase Auth at your live URL

Back in Supabase → **Authentication** → **URL Configuration**:
- Set **Site URL** to your deployed URL (e.g. `https://carenest.netlify.app`).
- Add it to **Redirect URLs** too.

## Step 8 — End-to-end test checklist

Do these in order, in a private/incognito window where you're **not** logged in as admin:

- [ ] **Landing page** loads on your phone; chat helper answers a pricing question.
- [ ] **Book care**: submit a test booking → you should see a confirmation screen with a reference code like `CA-7KQ2XA`.
- [ ] **Join as PSW**: submit a test application with small test files → success screen.
- [ ] Open `admin.html` → **sign in** with your admin account.
- [ ] **Overview** shows 1 pending verification, 1 unassigned booking.
- [ ] **Verification queue**: open a test PSW, click a document link (it should open the file), then **Approve → active**.
- [ ] **Bookings**: click **Assign** on the test booking → suggested matches appear → assign the PSW.
- [ ] Click **Details** on the test booking → set duration (e.g. 4 hours) and scheduled date/time.
- [ ] Change booking status to **completed** → check **Payouts**: a payment row exists with platform fee = 20% and the rest owed to the PSW.
- [ ] **Mark paid** on the payout.
- [ ] In Supabase Table Editor, confirm rows exist in `clients`, `psws`, `documents`, `bookings`, `payments`.

Then **delete the test rows** (or mark them clearly as tests) before real launch.

## Step 9 — Before real launch (do not skip)

- [ ] **Custom domain** (optional): point your domain at Netlify/Vercel/Cloudflare.
- [ ] **Business email + phone**: update `CONTACT_EMAIL` / `CONTACT_PHONE` in `js/config.js` and redeploy.
- [ ] **Blanket liability insurance**: buy the marketplace policy covering PSWs during booked jobs. Do not take real bookings before this is active.
- [ ] **Lawyer review**: independent-contractor agreement for PSWs, client service terms, privacy policy.
- [ ] **PHIPA review**: you handle client addresses and care needs — have your privacy practices reviewed (see README).
- [ ] **CRA**: confirm contractor classification guidance with your accountant.
- [ ] **Backups**: enable Supabase's free daily backups (Project Settings → Database → Backups).
- [ ] **Turn off** public signup in Auth if you haven't (Step 4.3).

## Troubleshooting

| Problem | Fix |
|---|---|
| "Supabase is not configured yet" on any page | `js/config.js` still has placeholder URL/key — fill them in and redeploy. |
| Booking/PSW form fails with `new row violates row-level security` | You edited the schema or policies — re-run `supabase/schema.sql`. The anon INSERT policies must exist. |
| File upload fails | Check the `psw-documents` bucket exists and is **private** (Storage → buckets). |
| Admin login says "not an administrator" | Your user's UID isn't in `admin_users` — repeat Step 5.4. |
| Document links won't open in admin | Signed URLs expire after 5 minutes — reload and click again. |
| Pages show unstyled content | `css/styles.css` path wrong — keep the folder structure exactly as-is when deploying. |
