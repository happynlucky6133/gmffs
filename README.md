# FreshStack Fulfillment

FreshStack Fulfillment is a Next.js admin application for multi-company order fulfillment operations.

The current Phase 1 admin flow covers:

- Company-scoped catalog, SKU, stock location, and stock balance management
- Order creation and order detail review
- Manual payment creation, proof update, confirmation, failure, and refund workflow
- Inventory allocation, reservation, release, and movement history
- Production tasks for orders that cannot be allocated from stock
- Manual delivery creation, quote, booking, pickup, delivery, failure, and cancellation
- Operations dashboard queues for payments, production, delivery, and recent orders
- Company settings, service areas, and payment method configuration

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
```

Run `npm run seed` only when a local PostgreSQL database is available.

## Architecture Notes

- Business tables are company-scoped with `companyId`.
- Server actions parse form data and call service modules for cross-table state changes.
- Cross-table operations such as payments, allocation, production completion, and delivery transitions use database transactions.
- Generated Prisma files are ignored at `/src/generated/prisma`; regenerate them with `npm run prisma:generate`.

## Current Production Blockers

These must be addressed before real multi-company production use:

- Replace the temporary hardcoded company context in `src/lib/company.ts` with authenticated session/company routing.
- Add authentication and role checks for admin actions.
- Add customer-facing order routes for `order.freshstack.cc/gm`.
- Add real file upload/storage for payment proof instead of plain proof URLs.
- Add automated tests for payment, allocation, production, and delivery state transitions.
