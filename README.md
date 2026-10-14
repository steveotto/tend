# Tend

Care for what matters. A personal life-rhythm app: faith, marriage, parenting, health, fitness, finances, friendships.

Structure beats good intention.

- `index.html` - app shell
- `tend.css` - brand tokens and styles (from tend-tokens.css)
- `app-core.js` / `app-actions.js` - application logic
- `logo-data.js` - the supplied brand logo, inlined
- `brand/` - brand source-of-truth docs; see `brand/BRAND-RULES.md`

Live at https://steveotto.github.io/tend/

## Account sync

Tend's browser client is configured for private email/password accounts with Supabase. The service is not live until the SQL migration and dashboard setup in [docs/supabase-setup.md](docs/supabase-setup.md) are complete. The GitHub Pages app remains static; do not put database passwords, service-role keys, or secret keys in browser code.
