# Tend

Care for what matters. A personal life-rhythm app: faith, marriage, parenting, health, fitness, finances, friendships.

Structure beats good intention.

- `index.html` - existing app shell
- `tend.css` - brand tokens and styles
- `app-core.js` / `app-actions.js` - existing application logic
- `logo-data.js` - supplied brand logo, inlined
- `brand/` - brand source-of-truth docs; see `brand/BRAND-RULES.md`

Live at https://steveotto.github.io/tend/

## Account sync

The existing browser client is configured for private email/password accounts with Supabase. The service is not live until the SQL migration and dashboard setup in [docs/supabase-setup.md](docs/supabase-setup.md) are complete. The GitHub Pages app remains static; do not put database passwords, service-role keys, or secret keys in browser code.

## Tend 2.0 local foundation preview

The React + strict TypeScript foundation is an isolated local preview, not a replacement for the existing app shell. `index.html` remains the existing app entry. The preview uses synthetic data only and has no account, network, scoring, or banking behavior. Its app preview may save only its explicit synthetic-data envelope to the versioned `tend2:synthetic-preview` key in browser storage; this is not live Tend persistence and does not sync across devices.

Use Node 24 or newer. The preview is a self-contained package so its installation does not modify the legacy app's tracked root `node_modules`:

```sh
cd foundation-preview
npm ci
npm run dev -- --port 4173
```

Open `http://127.0.0.1:4173/app-preview.html` for the Tend-style Today view, `http://127.0.0.1:4173/preview.html` for the component catalogue, or `http://127.0.0.1:4173/comparison.html` to compare Today against a static legacy-style reference. The comparison fixture uses equivalent synthetic content and loads neither the legacy app scripts nor account data. Its static card markup intentionally mirrors the sample only as a script-free visual reference; it is not a second application renderer. From `foundation-preview/`, run the local checks and static preview build:

```sh
npm run typecheck
npm test
npm run build
```

`npm test` runs the lossless-reader tests, the component tests, and the existing JavaScript regression tests. The React views compose shared Rhythm, Goal, and Foundation cards; the catalogue demonstrates those components with Marriage and Finances examples. Finances examples are illustrative only; they do not finalize the category taxonomy.

The legacy reader preserves original JSON text separately from parsed projections. It is read-only, does not invoke the legacy `ensureShape` migration, and is not a complete validator or a safe-to-publish export. Never read or write existing Tend state, account-cache, auth, calendar, or sync keys; add account data, secrets, a live Supabase connection, scoring formulas, or money movement. The synthetic preview storage adapter must remain confined to its versioned key and explicit validated envelope. Browser storage is local to the preview origin, may be cleared, and is not a backup substitute.
