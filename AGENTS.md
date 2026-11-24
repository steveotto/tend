# Tend foundation contribution rules

## Narrow authenticated Prayer implementation authorization

- The repository owner has explicitly approved a separate, narrow implementation phase for authenticated Prayer scheduling and person Prayer Health in the deployed Tend React application.
- This authorization permits application code, account-document adapters, migration/recovery logic, mocked/local integration tests, and production build verification for this feature.
- It does not authorize reading or modifying live user records, destructive cleanup, production database changes, or weakening authentication/RLS.
- If a database migration or RLS change is genuinely required, stop and provide the exact proposal, reason, rollback, and verification plan for separate approval.
- Keep live credentials, prayer contents, private account data, and real sessions out of source, logs, fixtures, tests, and exports.

- Keep live accounts, application checkout and database unchanged outside this narrowly authorized Prayer implementation; live-record reads/writes and database changes remain prohibited.
- Use synthetic fixtures only. Never commit personal state, auth/session data, tokens or keys.
- Keep the existing `index.html` app shell intact. The React Today preview is served from `foundation-preview/app-preview.html`, and the component catalogue remains at `foundation-preview/preview.html`.
- Domain readers and selectors must be pure: no browser storage, network or implicit saves.
- Preserve exact raw input independently of parsed views. Never invoke legacy `ensureShape`.
- Report malformed/unresolved data; do not silently delete, deduplicate or normalize it.
- Reuse shared UI components; use category capabilities and configuration for differences rather than parallel category-specific card implementations.
- Before delivering UI work, review changed pages and components for duplicated card markup, editors, dialogs, styles, validation and domain logic. Pages should compose shared components. Prefer typed props, category capabilities and composition for legitimate differences; do not create category-specific copies solely to vary labels, icons, actions or metadata.
- Do not force unrelated behavior into an oversized component. If a separate implementation is justified, document the exception and its reason in the delivery summary.
- Include a component reuse map (shared component → consuming views), resolved duplication notes, remaining exceptions, and the limits of architecture checks in the delivery summary.
- Add practical automated architecture checks when they protect meaningful boundaries. Favor runtime/component contract tests and type-safe interfaces; avoid brittle source-text checks or tests that only assert a component name exists.
- Keep domain behavior in pure typed functions and express state changes through explicit commands or callbacks, never as a side effect of rendering.
- External automation tags are metadata, never proof of transfer or completion.
- Keep stored state-document, database-schema and scoring-policy versions distinct.
- Do not add scoring formulas, finalize Finances taxonomy, or introduce money movement in this slice.
- The isolated React preview may persist only its synthetic preview envelope under the versioned `tend2:synthetic-preview` browser-storage key, with explicit export/import/reset and corruption/conflict safeguards. Never read or write existing Tend state, account-cache, auth, calendar, or sync keys; this exception does not authorize live-account persistence or changes to the existing app.
- Keep exact dependency versions and the committed-ready npm lockfile.
- Run semantic typechecking, tests and the production build independently. Runtime tests do not replace typechecking or integration tests.
- No deployment wiring, live writer or schema cleanup until its phase and review criteria are separately approved.
