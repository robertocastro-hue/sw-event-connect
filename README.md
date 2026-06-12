# Smart Wires Event Connect

A simple, secure portal for logging customer interactions at events (badge photos, audio
notes, contact details, follow-ups) and exporting them to HubSpot.

- **Frontend**: React + Vite, deployed on Netlify
- **Backend**: Supabase (auth, database, file storage)
- **Admin functions**: Netlify Functions (user management)

---

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and run the entire contents of `supabase/schema.sql`.
   This creates the `profiles`, `events`, and `interactions` tables, sets up
   row-level security so any signed-in teammate can read/write data, and
   creates the `badge-photos` and `audio-notes` storage buckets.
3. Go to **Authentication > Providers** and make sure **Email** is enabled.
4. Go to **Authentication > URL Configuration** and set:
   - **Site URL**: your Netlify URL (e.g. `https://sw-event-connect.netlify.app`)
   - **Redirect URLs**: add `https://sw-event-connect.netlify.app/reset-password`
     (and the same for any preview/staging URLs you use)
5. (Optional but recommended) Go to **Authentication > Email Templates** and
   update the "Invite user" and "Reset password" templates with Smart Wires
   branding/wording if you'd like.

### Create yourself as the first admin

1. In Supabase, go to **Authentication > Users > Add user**, create your
   account with your email and a temporary password (check "Auto Confirm
   User").
2. Back in **SQL Editor**, run (with your email):
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'roberto@smartwires.com');
   ```
3. You can now log in with that email/password, and use the **Users** tab in
   the app to invite everyone else (they'll get an email invite to set their
   own password — no need to repeat the manual steps above for other users).

### Grab your API keys

Go to **Project Settings > API**. You'll need:
- **Project URL**
- **anon public key** (safe for the frontend)
- **service_role key** (secret — only used by Netlify Functions, never the browser)

---

## 2. Run locally (optional)

```bash
npm install
cp .env.example .env
# edit .env with your Supabase URL and anon key
npm run dev
```

The admin functions (`netlify/functions`) require the Netlify CLI to run
locally:

```bash
npm install -g netlify-cli
netlify dev
```

---

## 3. Deploy to Netlify

1. Push this project to a GitHub repo (or drag-and-drop the folder into
   Netlify for a manual deploy).
2. In Netlify, **Add new site > Import an existing project**, connect the
   repo. Build settings are already defined in `netlify.toml`
   (`npm run build`, publish `dist`).
3. Under **Site configuration > Environment variables**, add:

   | Key | Value | Notes |
   |---|---|---|
   | `VITE_SUPABASE_URL` | your Supabase project URL | used by frontend |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key | used by frontend |
   | `SUPABASE_URL` | your Supabase project URL | used by Netlify Functions |
   | `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service role key | **secret** — used by Netlify Functions only |

4. Deploy. Once live, update the Supabase **Site URL** / **Redirect URLs**
   (step 1.4 above) to match your real Netlify domain.

---

## 4. Using the app

- **Login**: everyone signs in with the email/password set up via their
  invite.
- **New interaction**: log a contact's details, event, notes, mark for
  follow-up, attach a badge photo (from camera or file), and/or record an
  audio note right from the browser.
- **Interactions**: searchable/filterable list of everything the team has
  logged. Click "Open" to edit, attach media, or delete.
- **Export**: filter by event/date range, pick which interactions to
  download as a HubSpot-ready CSV, then mark them as exported so they don't
  get exported twice.
- **Users** (admin only): invite new teammates, promote/demote admins, send
  password reset emails, or remove access.
- **Account**: anyone can change their own password here.

All signed-in users have the same access to interaction data — the "admin"
distinction only controls who can manage user accounts.

---

## 5. HubSpot import mapping

The exported CSV has these columns:

| CSV column | HubSpot property |
|---|---|
| First Name | `firstname` (standard) |
| Last Name | `lastname` (standard) |
| Email | `email` (standard — used to match/dedupe contacts) |
| Phone Number | `phone` (standard) |
| Company Name | `company` (standard) |
| Job Title | `jobtitle` (standard) |
| Event Interaction Notes | custom property — create once in HubSpot |
| Event Name | optional custom property, or ignore on import |
| Interaction Date | optional custom property, or ignore on import |
| Needs Follow Up | optional custom property, or ignore on import |

**One-time setup in HubSpot**: go to **Settings > Properties > Contact
properties > Create property**, name it something like "Event Interaction
Notes" (type: Multi-line text). After that, HubSpot's import wizard will let
you map the CSV column to it automatically each time.

To import: **Contacts > Import > Start an import > File from computer >
One file, one object > Contacts**, upload the CSV, and map the columns above.
HubSpot will match existing contacts by email and update them, or create new
ones.

> Note: badge photos and audio notes stay in the portal (Supabase storage) —
> HubSpot's CSV import doesn't support file attachments. The notes field and
> contact details are what travel into HubSpot; photos/audio remain
> reference material inside Event Connect.

---

## 6. Customization ideas

- Add more events ahead of a show (Dashboard/New Interaction event dropdown
  lets anyone add one on the fly too).
- If you'd rather each person only see their own logged interactions, change
  the `interactions_all_authenticated` policy in `supabase/schema.sql` to
  check `created_by = auth.uid()` for `select`.
- Add a direct HubSpot API push later (Netlify Function using a HubSpot
  Private App token) if CSV import becomes a bottleneck.
