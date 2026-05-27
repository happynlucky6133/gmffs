"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getActiveCompany } from "@/lib/company";
import {
  money,
  optionalString,
  quantity,
  requiredNonNegativeNumber,
  requiredString,
} from "@/lib/form";
import { withSqlTransaction } from "@/lib/sql";

function requiredPrice(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${key} must be zero or greater`);
  }
  return money(value);
}

export async function createProduct(formData: FormData) {
  const company = await getActiveCompany();
  await withSqlTransaction(async (client) => {
    await client.query(
      `INSERT INTO products
        (id, "companyId", name, description, "imageUrl", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [
        randomUUID(),
        company.id,
        requiredString(formData, "name"),
        optionalString(formData, "description"),
        optionalString(formData, "imageUrl"),
      ],
    );
  });
  revalidatePath("/inventory");
}

export async function updateProduct(formData: FormData) {
  const company = await getActiveCompany();
  await withSqlTransaction(async (client) => {
    await client.query(
      `UPDATE products
          SET name = $1, description = $2, "imageUrl" = $3, "updatedAt" = NOW()
        WHERE id = $4 AND "companyId" = $5`,
      [
        requiredString(formData, "name"),
        optionalString(formData, "description"),
        optionalString(formData, "imageUrl"),
        requiredString(formData, "id"),
        company.id,
      ],
    );
  });
  revalidatePath("/inventory");
}

export async function setProductActive(formData: FormData) {
  const company = await getActiveCompany();
  const isActive = formData.get("isActive") === "true";
  await withSqlTransaction(async (client) => {
    await client.query(
      `UPDATE products SET "isActive" = $1, "updatedAt" = NOW()
        WHERE id = $2 AND "companyId" = $3`,
      [isActive, requiredString(formData, "id"), company.id],
    );
  });
  revalidatePath("/inventory");
}

export async function createSku(formData: FormData) {
  const company = await getActiveCompany();
  const productId = requiredString(formData, "productId");
  await withSqlTransaction(async (client) => {
    const product = await client.query(
      `SELECT id FROM products WHERE id = $1 AND "companyId" = $2 AND "isActive" = true`,
      [productId, company.id],
    );
    if (product.rows.length === 0) {
      throw new Error("Product not found or inactive");
    }
    await client.query(
      `INSERT INTO skus
        (id, "companyId", "productId", code, name, unit, price, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        randomUUID(),
        company.id,
        productId,
        requiredString(formData, "code"),
        requiredString(formData, "name"),
        requiredString(formData, "unit"),
        requiredPrice(formData, "price"),
      ],
    );
  });
  revalidatePath("/inventory");
}

export async function updateSku(formData: FormData) {
  const company = await getActiveCompany();
  await withSqlTransaction(async (client) => {
    await client.query(
      `UPDATE skus SET code = $1, name = $2, unit = $3, price = $4, "updatedAt" = NOW()
        WHERE id = $5 AND "companyId" = $6`,
      [
        requiredString(formData, "code"),
        requiredString(formData, "name"),
        requiredString(formData, "unit"),
        requiredPrice(formData, "price"),
        requiredString(formData, "id"),
        company.id,
      ],
    );
  });
  revalidatePath("/inventory");
}

export async function setSkuActive(formData: FormData) {
  const company = await getActiveCompany();
  const isActive = formData.get("isActive") === "true";
  await withSqlTransaction(async (client) => {
    await client.query(
      `UPDATE skus SET "isActive" = $1, "updatedAt" = NOW()
        WHERE id = $2 AND "companyId" = $3`,
      [isActive, requiredString(formData, "id"), company.id],
    );
  });
  revalidatePath("/inventory");
}

export async function createLocation(formData: FormData) {
  const company = await getActiveCompany();
  await withSqlTransaction(async (client) => {
    await client.query(
      `INSERT INTO inventory_locations
        (id, "companyId", name, code, address, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [
        randomUUID(),
        company.id,
        requiredString(formData, "name"),
        requiredString(formData, "code"),
        optionalString(formData, "address"),
      ],
    );
  });
  revalidatePath("/inventory");
}

export async function setLocationActive(formData: FormData) {
  const company = await getActiveCompany();
  const isActive = formData.get("isActive") === "true";
  await withSqlTransaction(async (client) => {
    await client.query(
      `UPDATE inventory_locations SET "isActive" = $1, "updatedAt" = NOW()
        WHERE id = $2 AND "companyId" = $3`,
      [isActive, requiredString(formData, "id"), company.id],
    );
  });
  revalidatePath("/inventory");
}

export async function adjustInventory(formData: FormData) {
  const company = await getActiveCompany();
  const locationId = requiredString(formData, "locationId");
  const skuId = requiredString(formData, "skuId");
  const onHand = requiredNonNegativeNumber(formData, "onHand");
  const reason = optionalString(formData, "reason") ?? "Manual stock adjustment";

  await withSqlTransaction(async (client) => {
    const loc = await client.query(
      `SELECT id FROM inventory_locations WHERE id = $1 AND "companyId" = $2`,
      [locationId, company.id],
    );
    if (loc.rows.length === 0) throw new Error("Location not found");

    const sku = await client.query(
      `SELECT id FROM skus WHERE id = $1 AND "companyId" = $2`,
      [skuId, company.id],
    );
    if (sku.rows.length === 0) throw new Error("SKU not found");

    const existing = await client.query<{ "onHand": string }>(
      `SELECT "onHand"::text FROM inventory_balances
        WHERE "companyId" = $1 AND "locationId" = $2 AND "skuId" = $3`,
      [company.id, locationId, skuId],
    );
    const previous = existing.rows[0] ? Number(existing.rows[0].onHand) : 0;

    await client.query(
      `INSERT INTO inventory_balances
        (id, "companyId", "locationId", "skuId", "onHand", reserved, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())
       ON CONFLICT ("companyId", "locationId", "skuId")
       DO UPDATE SET "onHand" = $5, "updatedAt" = NOW()`,
      [randomUUID(), company.id, locationId, skuId, quantity(onHand)],
    );

    const difference = onHand - previous;
    if (difference !== 0) {
      await client.query(
        `INSERT INTO inventory_movements
          (id, "companyId", "locationId", "skuId", type, quantity, reason, "createdAt")
         VALUES ($1, $2, $3, $4, 'adjustment', $5, $6, NOW())`,
        [randomUUID(), company.id, locationId, skuId, quantity(difference), reason],
      );
    }
  });
  revalidatePath("/inventory");
}
