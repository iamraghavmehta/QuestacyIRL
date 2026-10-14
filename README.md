# Questacy functional MVP

Questacy remains a static HTML/CSS/JavaScript site suitable for GitHub Pages. The original visual direction is retained; the demo quest works in-browser and stores progress locally. Email forms only show success after the Supabase Edge Function confirms a database insert.

## What is implemented

- Interactive five-checkpoint **The Ridge Run** sample quest with clue reveal, answer checking, checkpoint XP, completion state, and duplicate-XP protection.
- Local demo profile: XP, level, completed stops/quests, badges, and reset control persisted in `localStorage` on this device only.
- Working map marker interactions that explain conceptual locations; no GPS is simulated or claimed.
- Early-access signup and local-business partnership-interest forms, with validation, consent, loading/error states, duplicate handling, honeypot, Origin check, and DB-backed limit of five requests per IP hash per form per hour.
- Supabase SQL migration and two Edge Functions. Browser never receives a service-role/secret key.
- Honest prototype labels for concept locations, rewards, city plans, and placeholder feedback.

## Important current status

**The backend is not live until you configure your own Supabase project.** `config.js` is intentionally blank. Until it is configured, form submissions show a clear unavailable message and are not stored or falsely reported as successful. Local quest progress works without Supabase.

## Files

- `index.html`, `style.css`, `script.js`, `config.js`: static site.
- `supabase/migrations/202610140001_questacy_forms.sql`: tables, indexes, RLS, grants, and rate-limit RPC.
- `supabase/functions/early-access-signup/index.ts`: early-access form endpoint.
- `supabase/functions/business-interest/index.ts`: business enquiry endpoint.
- `supabase/config.toml`: public form functions have platform JWT verification disabled; each function enforces its configured site Origin and performs its own validation. Do not remove those checks.

## Configure Supabase

1. Create a Supabase project at https://supabase.com and keep its secret/service-role key private.
2. Open **SQL Editor** and run the full SQL in `supabase/migrations/202610140001_questacy_forms.sql`.
3. Install the Supabase CLI and sign in (`supabase login`). From this project folder, link the project with `supabase link --project-ref YOUR_PROJECT_REF`.
4. Set the function secrets. Replace the example origin with the exact deployed origin (no path or trailing slash). For GitHub Pages it will usually be `https://iamraghavmehta.github.io`:

   ```sh
   supabase secrets set SITE_ORIGIN=https://iamraghavmehta.github.io RATE_LIMIT_SALT="a-long-random-private-value"
   ```

   The Edge Functions use the project-provided `SUPABASE_URL` and need a server-only key. In the Supabase dashboard, add `SUPABASE_SERVICE_ROLE_KEY` as a function secret with the project's service-role key (or use the current secret key with the code's supported `SUPABASE_SECRET_KEY` name). Never put this key in `config.js`, HTML, JavaScript, GitHub, or chat.

5. Deploy both functions:

   ```sh
   supabase functions deploy early-access-signup --no-verify-jwt
   supabase functions deploy business-interest --no-verify-jwt
   ```

6. Edit `config.js` and set only public values:

   ```js
   window.QUESTACY_CONFIG = {
     supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
     publishableKey: 'sb_publishable_YOUR_PUBLIC_KEY',
     functionsBaseUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1'
   };
   ```

   Use the project's **publishable** key (or legacy anon key), never a secret/service-role key. This key is public by design; the database tables have RLS enabled, public table privileges revoked, and the functions use server-side credentials. The browser does not query the signup tables.

7. In Supabase, confirm the migration ran, then submit one test signup and one test business enquiry. Verify records in the dashboard's Table Editor. Try submitting the same email twice and confirm the second request gets a duplicate message. Test from a different browser/device as well.

### Security notes

- RLS is enabled on all three tables; `anon` and `authenticated` have no table grants. The functions use the server-only key.
- Rate limiting is database-backed and atomic: 5 requests per hashed IP address, per form, per hour. The raw IP is not stored. The salt must be private and stable.
- Origin checking is a useful browser abuse barrier, not user authentication; non-browser clients can forge Origin. Add Cloudflare Turnstile or another anti-bot provider before promoting this publicly if spam becomes a concern.
- Supabase Edge Function logs may include server error details. The public error responses intentionally avoid returning raw database errors.
- A duplicate email is treated as a conflict; it is not exposed through any public table read API.
- If your project uses the new secret API key rather than the legacy service-role key, set `SUPABASE_SECRET_KEY` instead. Never expose either secret in frontend code.

## Run locally

No build step or npm dependencies are required for the static frontend. Serve the folder over HTTP (rather than opening the file directly) so browser behavior matches deployment:

```sh
python -m http.server 8000
```

Open http://localhost:8000. For local backend testing, configure `SITE_ORIGIN` to `http://localhost:8000` temporarily, deploy/test appropriately, and restore the production origin afterward. Do not leave broad Origin rules in production.

## Deploy on GitHub Pages

1. Commit the contents of this folder to the root of the existing `Questacy-` repository, keeping `index.html`, `style.css`, `script.js`, and `config.js` at the repository root.
2. In repository **Settings → Pages**, use the current branch and `/ (root)` (or retain the repository's existing deployment workflow if it already builds/deploys the site).
3. Wait for the Pages deployment to complete, then open `https://iamraghavmehta.github.io/Questacy-/#top`.
4. Do not commit `.env` files or any Supabase secret. The publishable key in `config.js` is intended to be public.

## QA checklist

- [ ] Test mobile menu open/close and all navigation anchors.
- [ ] Start The Ridge Run; reveal a clue; submit a wrong answer; verify no XP is awarded.
- [ ] Submit a correct answer; verify one checkpoint and its XP are recorded.
- [ ] Refresh; verify progress remains. Complete all five stops; verify quest completion and badges.
- [ ] Try to repeat a completed checkpoint and confirm XP does not duplicate.
- [ ] Reset demo progress and verify it clears.
- [ ] With blank `config.js`, verify signup says unavailable and never says success.
- [ ] With Supabase configured, test valid signup, missing consent, invalid email, duplicate email, service failure, and rate limiting.
- [ ] Test business enquiry and duplicate handling.
- [ ] Verify public REST queries cannot select either submission table.
- [ ] Check browser console and responsive layout on a phone-sized viewport.

## What has not been verified here

This source package has not been deployed to your GitHub repository, connected to your Supabase account, or tested against a live backend. Conceptual quest stops and answers have not been field-verified. The static frontend can be tested locally, but successful production form storage requires the setup above.
