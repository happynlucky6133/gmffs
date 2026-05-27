import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://freshstack_admin:freshstack_dev_2026@localhost:5432/freshstack";

const seedPassword = "Admin@12345";

const companies = [
  { name: "GM Company", slug: "gm" },
  { name: "YC Company", slug: "yc" },
] as const;

const users = [
  {
    email: "admin@freshstack.cc",
    name: "Platform Admin",
    role: "platform_admin",
    companySlug: null,
  },
  {
    email: "admin@gm.freshstack.cc",
    name: "GM Admin",
    role: "company_admin",
    companySlug: "gm",
  },
  {
    email: "admin@yc.freshstack.cc",
    name: "YC Admin",
    role: "company_admin",
    companySlug: "yc",
  },
] as const;

const paymentMethods = [
  { type: "touch_n_go", name: "Touch n Go", enabled: true },
  { type: "bank_transfer", name: "Bank Transfer", enabled: true },
  { type: "cash_on_delivery", name: "Cash on Delivery", enabled: false },
  { type: "payment_link", name: "Payment Link", enabled: false },
] as const;

const inventoryLocations = [{ code: "MAIN", name: "Main Cold Room" }] as const;

const gmFruitProducts = [
  {
    code: "FRUIT-MANGO",
    name: "Mango Cup",
    description: "Fresh cut mango cup.",
    imageUrl: "/products/fruit1.jpeg",
  },
  {
    code: "FRUIT-DRAGON-BLUEBERRY",
    name: "Dragon Fruit Blueberry Cup",
    description: "Red dragon fruit with blueberries.",
    imageUrl: "/products/fruit2.jpeg",
  },
  {
    code: "FRUIT-GREEN-KIWI",
    name: "Green Kiwi Cup",
    description: "Fresh sliced green kiwi.",
    imageUrl: "/products/fruit3.jpeg",
  },
  {
    code: "FRUIT-MANGO-BLUEBERRY",
    name: "Mango Blueberry Cup",
    description: "Fresh mango with blueberries.",
    imageUrl: "/products/fruit4.jpeg",
  },
  {
    code: "FRUIT-MELON-TOMATO",
    name: "Melon Tomato Cup",
    description: "Fresh melon with cherry tomatoes.",
    imageUrl: "/products/fruit5.jpeg",
  },
  {
    code: "FRUIT-GOLDEN-KIWI",
    name: "Golden Kiwi Cup",
    description: "Fresh sliced golden kiwi.",
    imageUrl: "/products/fruit6.jpeg",
  },
  {
    code: "FRUIT-ORANGE",
    name: "Orange Cup",
    description: "Fresh orange slices.",
    imageUrl: "/products/fruit7.jpeg",
  },
  {
    code: "FRUIT-HONEYDEW",
    name: "Honeydew Cup",
    description: "Fresh honeydew cubes.",
    imageUrl: "/products/fruit8.jpeg",
  },
].map((fruit, index) => ({
  ...fruit,
  displayOrder: (index + 1) * 10,
}));

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("supabase.")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  const password = await bcrypt.hash(seedPassword, 10);

  await client.connect();

  try {
    await client.query("BEGIN");

    const companyIds = new Map<string, string>();
    for (const company of companies) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO companies
          (id, name, slug, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name,
               "updatedAt" = NOW()
         RETURNING id`,
        [randomUUID(), company.name, company.slug],
      );

      companyIds.set(company.slug, result.rows[0].id);
    }

    for (const user of users) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO users
          (id, email, name, password, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE
           SET name = EXCLUDED.name,
               password = EXCLUDED.password,
               "isActive" = true,
               "updatedAt" = NOW()
         RETURNING id`,
        [randomUUID(), user.email, user.name, password],
      );

      if (user.companySlug) {
        await client.query(
          `INSERT INTO company_users
            (id, "companyId", "userId", role, "createdAt")
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT ("companyId", "userId") DO UPDATE
             SET role = EXCLUDED.role`,
          [
            randomUUID(),
            companyIds.get(user.companySlug),
            result.rows[0].id,
            user.role,
          ],
        );
      }
    }

    for (const company of companies) {
      const companyId = companyIds.get(company.slug);
      if (!companyId) {
        throw new Error(`Company was not initialized: ${company.slug}`);
      }

      for (const method of paymentMethods) {
        await client.query(
          `INSERT INTO payment_methods
            (id, "companyId", type, name, enabled, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT ("companyId", type) DO UPDATE
             SET name = EXCLUDED.name,
                 enabled = EXCLUDED.enabled,
                 "updatedAt" = NOW()`,
          [randomUUID(), companyId, method.type, method.name, method.enabled],
        );
      }

      for (const location of inventoryLocations) {
        await client.query(
          `INSERT INTO inventory_locations
            (id, "companyId", code, name, "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())
           ON CONFLICT ("companyId", code) DO UPDATE
             SET name = EXCLUDED.name,
                 "isActive" = true,
                 "updatedAt" = NOW()`,
          [randomUUID(), companyId, location.code, location.name],
        );
      }

      if (company.slug !== "gm") {
        continue;
      }

      for (const fruit of gmFruitProducts) {
        const existingProduct = await client.query<{ id: string }>(
          `SELECT id
             FROM products
            WHERE "companyId" = $1
              AND name = $2
            LIMIT 1`,
          [companyId, fruit.name],
        );

        const productId = existingProduct.rows[0]?.id ?? randomUUID();
        if (existingProduct.rows[0]) {
          await client.query(
            `UPDATE products
                SET description = $2,
                    "imageUrl" = $3,
                    "displayOrder" = $4,
                    "isActive" = true,
                    "updatedAt" = NOW()
              WHERE id = $1`,
            [
              productId,
              fruit.description,
              fruit.imageUrl,
              fruit.displayOrder,
            ],
          );
        } else {
          await client.query(
            `INSERT INTO products
              (id, "companyId", name, description, "imageUrl", "displayOrder",
               "isActive", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())`,
            [
              productId,
              companyId,
              fruit.name,
              fruit.description,
              fruit.imageUrl,
              fruit.displayOrder,
            ],
          );
        }

        await client.query(
          `INSERT INTO skus
            (id, "companyId", "productId", code, name, unit, price, "isActive",
             "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'cup', '8.00', true, NOW(), NOW())
           ON CONFLICT ("companyId", code) DO UPDATE
             SET "productId" = EXCLUDED."productId",
                 name = EXCLUDED.name,
                 unit = EXCLUDED.unit,
                 price = EXCLUDED.price,
                 "isActive" = true,
                 "updatedAt" = NOW()`,
          [randomUUID(), companyId, productId, fruit.code, fruit.name],
        );
      }
    }

    await client.query("COMMIT");
    console.log("Seed complete: GM and YC companies, payment methods, and GM fruit products are ready.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:");
  console.error(error);
  process.exit(1);
});
