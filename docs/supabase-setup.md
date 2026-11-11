# Tend Supabase setup

The Classic app is a static GitHub Pages app. The browser uses Supabase Auth and the public publishable key; Classic private data is stored in `public.tend_user_state` and protected by row-level security. No database password, service-role key, or secret key belongs in this repository or browser. The isolated Tend Preview has a separate manual backup table described below; it does not read or write Classic state.

## 1. Configure the browser client

Edit `app-config.js` and set:

```js
window.TEND_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  publishableKey: "YOUR_SUPABASE_PUBLISHABLE_KEY",
  redirectUrl: "https://steveotto.github.io/tend/"
};
```

The URL and publishable/legacy `anon` key are public client configuration. Never use a `service_role` or secret key. When the URL or key is blank, Tend deliberately stays in its existing local mode and does not show account sign-in.

## 2. Apply the database migration

In Supabase Dashboard → **SQL Editor**, run the complete migration:

[`supabase/migrations/202610160001_private_tend_accounts.sql`](../supabase/migrations/202610160001_private_tend_accounts.sql)

It creates the user-scoped profile and JSON state tables, enables RLS, grants only the required authenticated access, and adds the revision-checked save function. The state function derives its owner from `auth.uid()`; a client cannot supply another user's ID. State reads are owner-filtered, direct writes are not granted, and the function rejects stale revisions atomically. The signup trigger copies the display name from Auth metadata.

In **Project Settings → API → Data API**, keep the Data API enabled and ensure the `public` schema is in **Exposed schemas**. This exposes the schema to PostgREST; it does not grant table access. Keep automatic exposure of new tables disabled. The migration grants authenticated users only the required profile/state access, and all personal-row policies check `auth.uid()`. State writes are granted only through the revision-checked RPC. Review the migration and policies before deployment. Do not enable broad grants to `anon`.

## 3. Configure authentication URLs and email

In **Authentication → URL Configuration**:

- Set the production **Site URL** to `https://steveotto.github.io/tend/`.
- Add `https://steveotto.github.io/tend/` to the redirect allow list.
- For local development, add both `http://localhost:8000/` and `http://127.0.0.1:8000/`.
- Keep confirmation and password-recovery redirects within those app URLs. Tend handles Supabase's email callback in the static app; no server-side route is required.
- The deployed Preview Pages root is `https://tend-beta-3gb.pages.dev/`. It must be an allowed redirect URL for Preview password recovery. Keep the existing Classic **Site URL** and redirects unchanged; this is an additional allow-list entry, not a Site URL replacement. Do not allow arbitrary branch-preview hosts. Preview recovery sends `resetPasswordForEmail` to the current Preview origin root, while Classic recovery continues to use `https://steveotto.github.io/tend/`.
- Preview explicitly uses Supabase's PKCE flow. The reset callback is a short-lived `?code=...` query, which the client exchanges after the protected Pages origin loads; request the reset and open its email link in the same browser/device so the PKCE verifier is available. The Supabase redirect allow list must include the exact Preview root above.
- For authenticated local Preview testing, run `npm run dev -- --mode pages --host 127.0.0.1 --port 8000` from `foundation-preview`. Pages-mode Vite serves the app entry at `/` in development so the PKCE redirect returns to the recovery handler; ordinary Vite development mode remains synthetic and is not a real-auth callback target.

Run locally with `python3 -m http.server 8000` from the repository root, then visit `http://localhost:8000/`.

Enable email/password sign-up and email confirmation under **Authentication → Providers → Email**. Under **Authentication → Email Templates → Reset Password**, use Supabase's recovery link (`{{ .ConfirmationURL }}`) as the link target; do not replace it with a bare Site URL. Confirmation and recovery messages are sent to the app URL allow list above.

Supabase's built-in sender is intended for evaluation and has changing rate limits/delivery restrictions; it is not a dependable public-user mail service. Check **Authentication → Rate Limits** in the project dashboard for the live account limit. For real external signups, configure and verify custom SMTP under **Project Settings → Authentication → SMTP Settings**, and set a sender address on a domain you control.

A read-only request to this project's public Auth settings currently reports sign-up enabled, email auto-confirm disabled, and email sign-in enabled. That endpoint does not reveal whether custom SMTP is configured or the live rate limit; verify both in the dashboard before inviting external users.

## 4. First login and importing existing data

Tend checks for the previous `tend:state` localStorage record only after a user signs in. If that account has no cloud state, it shows the counts found on the device and asks whether to import them or start empty. The old localStorage item is not deleted. The choice is per signed-in account; data is not silently imported into new accounts.

If cloud data already exists, it is loaded as authoritative. The Account screen offers **Keep cloud data** or an explicit local-data import. Importing local, backup, or GitHub recovery data replaces cloud state only after confirmation; Tend downloads a sanitized copy of the current account first. The original localStorage item is not deleted. Existing GitHub sync remains available as a manual recovery path only; automatic GitHub pulls and pushes are disabled in account mode.

Cloud rows contain the complete existing Tend state document (including IDs, categories, history, and fitness data), with a state schema version, server-incremented revision, and server timestamp. Device caches use a separate `tend:account-cache:<user-id>` key. Do not clear browser storage until pending offline work has synced or been exported.

External calendar-feed caches are scoped to the signed-in account to prevent one account's calendar entries from appearing in another account's Focus view.

After a successful sign-in, if the device is offline Tend can open that account's existing per-user cache. New edits stay queued locally and are revision-checked against the server when the device reconnects; stale edits require an explicit conflict choice.

## 5. Preview manual backup and restore (separate from Classic state)

The Preview's manual account backup uses the existing signed-in Supabase JS client and the versioned `tend.synthetic-preview` envelope. It is not automatic sync and does not use `tend_user_state`. The dedicated migration is [`supabase/migrations/202611040001_preview_account_backups.sql`](../supabase/migrations/202611040001_preview_account_backups.sql). It creates one `public.tend_preview_backups` row per `auth.users` UUID, enables owner-only RLS, grants authenticated users read access, and routes document writes through `tend_save_preview_backup`. The RPC derives the owner from `auth.uid()` and atomically checks the expected revision. With explicit authorization, this exact migration was applied on 2026-11-06 to the existing project `fhujqvudflxdpcvonids` (Tend; CLI identifies it as production). It adds only the dedicated Preview backup objects; it does not change Classic tables or existing account records.

After the migration is applied, ensure `public` remains in the Data API exposed schemas; table grants and RLS remain the authorization boundary. In Preview, the **More → Account backup** panel shows the signed-in account identifier suffix, a read-only backup date/revision status, and operation results. Missing account-backup API configuration is shown as unavailable, with the actions disabled. **Back up to my account** validates and saves the current browser envelope; if the account copy differs, it requires explicit confirmation before replacing it. **Restore from my account** validates/migrates the cloud envelope before asking to replace different local data. A confirmed restore first preserves the exact local bytes in the account-scoped `cloud-restore-recovery` key and then uses the existing local compare-before-write path; success is reported only after the durable browser write completes. The transferable document is the versioned Preview data envelope (Rhythms and associations, completion/activity records, Fitness logs, People, notes, goals, calendar settings, and other supported Preview state); credentials, auth tokens, and session storage are excluded. The current controls are explicit/manual; they do not upload edits, synchronize in the background, or modify Classic state. A stale cloud revision is rejected, and users must review the latest copy before retrying. The local recovery copy can be downloaded from More.

Hosted setup checkpoint (2026-11-06): read-only catalog checks confirmed the table/function were absent before setup; only the migration file above was applied (no blanket migration push). Hosted schema checks confirmed RLS and owner-scoped policies, authenticated users can select but cannot directly insert/update/delete, only authenticated users can execute the revision-checked RPC, and the new table contains no rows. Anonymous and no-key API checks returned HTTP 401. This verifies database configuration, not the authenticated application flow. Email signups are enabled but confirmation is required; two disposable, confirmed accounts and separate browser contexts are still needed to verify real sign-in, account isolation, backup revisions, restore, conflict handling, retries, and account switching. Do not use real account data for these tests.

To disable Preview backup access without deleting any backups, leave `VITE_PREVIEW_ACCESS_READY` unset or set it to `false` (or omit the Preview Supabase URL/publishable-key variables) in the Preview build environment. This disables the Preview identity/workspace entry point; it does not remove the table, migration, or stored backup rows. Do not drop the table to disable the feature.

## 6. Checks before calling the service live

The migration and client implementation are version-controlled, but the integration is **not live until** the migration has been applied, `app-config.js` has the supplied project's URL and publishable key, redirect/email settings have been saved, and the deployed app has been tested.

Use two confirmed test accounts:

1. Sign up account A and account B, confirm both emails, and verify that each starts with its own empty or explicitly imported state.
2. With A signed in, inspect B's `tend_user_state` row through the Data API using A's access token. It must return no row; repeat anonymously and expect an authorization error. Confirm A cannot update or delete B's row directly. Do not use a service-role key for these tests.
3. Open A on two devices. Save on device one, then attempt a stale save from device two. The stale write must be rejected and Tend must offer the device draft and current cloud version without silently overwriting either.
4. Disconnect a device, make a change, reconnect, and verify the revision check either saves the pending draft or reports a conflict. Switch accounts in the same browser and verify the other account's records and cache are not shown.
5. Complete signup confirmation, password reset, logout, backup import/export, and manual GitHub recovery on the production URL and the local URLs above.

Until those checks pass, keep this integration in preview and preserve the original device backup.
