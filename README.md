# FreshStack Fulfillment

FreshStack Fulfillment is a Next.js admin application for multi-company order fulfillment operations.

## Current Status

Latest known good commit:

```text
08f4bb5 cloudflare-demo-order-page
```

Production demo URL:

```text
https://order.freshstack.cc/gm
```

The project is deployed on Cloudflare Workers through OpenNext. Supabase is used as the Postgres database, and Cloudflare R2 is configured for payment proof storage.

Important handoff note: `/gm` is currently a stable demo ordering page for the boss presentation. It intentionally does not write orders into Supabase yet, because Prisma's Cloudflare Workers wasm packaging hit a runtime issue during deployment. The live demo page shows the 8 fruit products, RM 8 pricing, mobile ordering form, and local in-browser order confirmation. After the presentation, restore real order creation by fixing the Cloudflare + Prisma runtime path and reconnecting `/gm` to `createCustomerPortalOrder`.

## Completed Scope

Phase 1 admin flow covers:

- Company-scoped catalog, SKU, stock location, and stock balance management
- Order creation and order detail review
- Manual payment creation, proof update, confirmation, failure, and refund workflow
- Inventory allocation, reservation, release, and movement history
- Production tasks for orders that cannot be allocated from stock
- Manual delivery creation, quote, booking, pickup, delivery, failure, and cancellation
- Operations dashboard queues for payments, production, delivery, and recent orders
- Company settings, service areas, and payment method configuration

Phase 2 customer ordering flow covers:

- Mobile-first `/gm` ordering page
- 8 Gold Marry fruit products with product images
- RM 8 pricing for every fruit cup
- Customer details form and order confirmation experience

Phase 3 deployment foundation covers:

- Cloudflare Workers deployment using OpenNext
- Custom domain binding for `order.freshstack.cc`
- Separate Supabase database for FreshStack
- Cloudflare R2 bucket `freshstack-payment-proofs`
- `DATABASE_URL` stored as a Cloudflare Worker secret

## Hermes / Codex CLI Handoff

Before making changes, pull the latest main branch:

```bash
git pull origin main
```

Do not assume `/gm` is already production-grade order persistence. It is live and suitable for presentation, but the current `/gm` page is a demo-safe fallback in `src/components/customer/DemoOrderForm.tsx`.

The previous real customer page queried Prisma from `src/app/[companySlug]/page.tsx`. On Cloudflare Workers, Prisma generated wasm failed with errors like:

```text
WebAssembly.Module(): Wasm code generation disallowed by embedder
no such file or directory, readAll '/bundle/static/wasm/f2c55d60b921ca47.wasm'
```

Current mitigation:

- Prisma was pinned to `6.19.0`.
- `engineType = "client"` and `runtime = "workerd"` were added in `prisma/schema.prisma`.
- Next webpack wasm support was enabled in `next.config.ts`.
- Wrangler additional module rules were added in `wrangler.jsonc`.
- `/gm` was temporarily decoupled from Prisma to guarantee a working live presentation.

Recommended next technical task:

1. Fix Prisma/OpenNext/Cloudflare wasm bundling in a durable way, preferably from WSL or Linux because OpenNext warns that Windows builds may be unreliable.
2. Reconnect `/gm` to Supabase order creation.
3. Verify order creation, order tracking, and payment screenshot upload on Cloudflare.
4. Keep the current demo page behavior available until real persistence passes live verification.

## Local Development

Install dependencies:

```bash
npm install
```

Set `DATABASE_URL`:

```bash
export DATABASE_URL="postgresql://freshstack_admin:freshstack_dev_2026@localhost:5432/freshstack"
```

For Windows PowerShell:

```powershell
$env:DATABASE_URL="postgresql://freshstack_admin:freshstack_dev_2026@localhost:5432/freshstack"
```

Apply migrations, generate the Prisma client, and seed the database:

```bash
npx prisma migrate dev
npm run prisma:generate
npm run seed
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The admin index redirects to `/dashboard`.

On this Windows workstation, PostgreSQL binaries and the local data directory are kept at:

- `C:\tmp\pgsql`
- `C:\tmp\freshstack-pgdata`

Use the helper scripts for local acceptance testing:

```bat
start-local.bat
stop-local.bat
```

`start-local.bat` starts PostgreSQL if needed, then starts the Next.js dev server.

Seeded admin users use `Admin@12345`:

- `admin@freshstack.cc`
- `admin@gm.freshstack.cc`
- `admin@yc.freshstack.cc`

## Verification

Run these before pushing functional changes:

```bash
npm run lint
npm run typecheck
npm run build
npm run cf:build
```

Run `npm run seed` only when a local PostgreSQL database is available.

## Architecture Notes

- Business tables are company-scoped with `companyId`.
- Server actions parse form data and call service modules for cross-table state changes.
- Cross-table operations such as payments, allocation, production completion, and delivery transitions use database transactions.
- Generated Prisma files are ignored at `/src/generated/prisma`; regenerate them with `npm run prisma:generate`.
- Customer URLs are intended to be company-scoped, for example `order.freshstack.cc/gm`.
- `gmpos.freshstack.cc` remains a separate internal staff system and should not be coupled to this customer-facing app.

## Current Production Blockers

These must be addressed before real multi-company production use:

- Replace the temporary hardcoded company context in `src/lib/company.ts` with authenticated session/company routing.
- Add authentication and role checks for admin actions.
- Reconnect the customer-facing `/gm` route to real Supabase order persistence after the Cloudflare Prisma runtime issue is fixed.
- Complete live verification of R2 payment proof upload from the customer order status page.
- Add automated tests for payment, allocation, production, and delivery state transitions.
