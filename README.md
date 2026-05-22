# FreshStack Fulfillment

FreshStack Fulfillment is a Next.js admin application for multi-company fulfillment operations.

## Local Development

Install dependencies:

```bash
npm install
```

Start PostgreSQL locally with this database URL:

```bash
postgresql://freshstack_admin:freshstack_dev_2026@localhost:5432/freshstack
```

Set `DATABASE_URL` for Prisma and seed commands:

```bash
export DATABASE_URL="postgresql://freshstack_admin:freshstack_dev_2026@localhost:5432/freshstack"
```

For Windows PowerShell:

```powershell
$env:DATABASE_URL="postgresql://freshstack_admin:freshstack_dev_2026@localhost:5432/freshstack"
```

Apply migrations:

```bash
npx prisma migrate dev
```

Generate the Prisma client:

```bash
npm run prisma:generate
```

Seed the initial platform and company admin users:

```bash
npm run seed
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The admin index redirects to `/dashboard`.

## Verification

```bash
npm run prisma:generate
npm run build
npm run lint
npm run typecheck
npm run seed
```
