# FreshStack Fulfillment

Multi-company order fulfillment platform (Next.js 16 + Cloudflare Workers + Supabase).

**Live**: https://order.freshstack.cc/gm | **GitHub**: happynlucky6133/gmffs

## Current Status (2026-05-27)

**Phase 3 acceptance in progress.** Latest deploy: v2 worker with Hyperdrive binding.

### Working (direct SQL — Cloudflare-safe)

| Page | URL |
|------|-----|
| Customer ordering | `order.freshstack.cc/gm` |
| Order API | `/api/customer-orders` |
| Admin dashboard | `/dashboard` |
| Admin orders | `/orders` |
| Admin payments | `/payments` |

### Not yet working (still on Prisma — WASM breaks on Cloudflare)

| Page |
|------|
| `/inventory` |
| `/production` |
| `/deliveries` |
| `/settings` |
| Customer order status (`/gm/orders/[orderNumber]`) |

These pages use `prisma` directly and need to be converted to `withSqlClient`/`sqlQuery` (see `src/lib/sql.ts`).

## Architecture

- **Runtime**: Cloudflare Workers via `@opennextjs/cloudflare`
- **Database**: Supabase PostgreSQL via Cloudflare Hyperdrive (`HYPERDRIVE` binding)
- **File storage**: Cloudflare R2 (`PAYMENT_PROOFS` bucket)
- **ORM**: Prisma 6.19 (for local dev / migrations only — replaced by direct SQL in production)
- **Frontend**: Next.js 16.2.6, React 19, Tailwind CSS 4

### Two database paths

1. **`src/lib/sql.ts`** — per-request `Client`, reads `HYPERDRIVE` binding first, falls back to `DATABASE_URL`
2. **`src/lib/prisma.ts`** — Prisma client (locally, via `@prisma/adapter-pg`)

Admin pages that work on Cloudflare use path 1. Pages still broken use path 2.

## Setup

```bash
npm install
npx prisma generate
```

Copy `.env.example` to `.env` and fill in real credentials. For Cloudflare deploy:

```bash
export CLOUDFLARE_API_TOKEN="cfut_..."
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgresql://..."
npm run cf:build
npm run cf:deploy
```

## Verification

```bash
npm run lint
npm run typecheck
npm run cf:build
```

## Admin accounts

Seed creates three admin users sharing password `Admin@12345`:

- `admin@freshstack.cc` — Platform Admin
- `admin@gm.freshstack.cc` — GM Admin
- `admin@yc.freshstack.cc` — YC Admin

## Project phases

- **Phase 1 (done)**: Admin fulfillment — catalog, orders, payments, inventory, production, deliveries
- **Phase 2 (done)**: Customer mobile ordering at `/gm` — 8 fruit cups, RM 8 each
- **Phase 3 (in progress)**: Cloud deployment, Hyperdrive, R2, live verification
- **Phase 4 (planned)**: Customer order tracking, delivery status

## Known blockers

- No authentication/authorization yet — admin pages are open
- `src/lib/company.ts` hardcodes `DEFAULT_COMPANY_SLUG="gm"` 
- `freshstack_hyperdrive` DB user has `BYPASSRLS` (needed until RLS service-account policies are written)
- Remaining Prisma pages need SQL conversion (see above)
