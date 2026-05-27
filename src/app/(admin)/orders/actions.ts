"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveCompany } from "@/lib/company";
import {
  money,
  optionalString,
  quantity,
  requiredNonNegativeNumber,
  requiredPositiveNumber,
  requiredString,
} from "@/lib/form";
import { sqlQuery, withSqlTransaction } from "@/lib/sql";

async function nextOrderNumber(companySlug: string) {
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `${companySlug.toUpperCase()}-${today}`;
  const result = await sqlQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM orders
      WHERE "orderNumber" LIKE $1`,
    [`${prefix}%`],
  );

  return `${prefix}-${String(Number(result.rows[0]?.count ?? 0) + 1).padStart(4, "0")}`;
}

export async function createOrder(formData: FormData) {
  const company = await getActiveCompany();
  const existingCustomerId = optionalString(formData, "customerId");
  const skuId = requiredString(formData, "skuId");
  const itemQuantity = requiredPositiveNumber(formData, "quantity");
  const unitPrice = requiredPositiveNumber(formData, "unitPrice");
  const deliveryFee = requiredNonNegativeNumber(formData, "deliveryFee");

  const orderNumber = await nextOrderNumber(company.slug);
  let orderId = "";

  await withSqlTransaction(async (client) => {
    const customer = existingCustomerId
      ? (
          await client.query<{
            id: string;
            address: string | null;
          }>(
            `SELECT id, address
               FROM customers
              WHERE id = $1
                AND "companyId" = $2
              LIMIT 1`,
            [existingCustomerId, company.id],
          )
        ).rows[0]
      : null;

    const customerId = customer?.id ?? randomUUID();
    const customerAddress =
      customer?.address ?? optionalString(formData, "customerAddress");

    if (!customer) {
      await client.query(
        `INSERT INTO customers
          (id, "companyId", name, phone, email, address, "createdAt", "updatedAt")
         VALUES
          ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          customerId,
          company.id,
          requiredString(formData, "customerName"),
          optionalString(formData, "customerPhone"),
          optionalString(formData, "customerEmail"),
          customerAddress,
        ],
      );
    }

    const sku = (
      await client.query<{ id: string }>(
        `SELECT id
           FROM skus
          WHERE id = $1
            AND "companyId" = $2
            AND "isActive" = true
          LIMIT 1`,
        [skuId, company.id],
      )
    ).rows[0];

    if (!sku) {
      throw new Error("Selected SKU is not available");
    }

    const subtotal = itemQuantity * unitPrice;
    const total = subtotal + deliveryFee;
    const deliveryAddress =
      optionalString(formData, "deliveryAddress") ?? customerAddress;

    if (!deliveryAddress) {
      throw new Error("deliveryAddress is required");
    }

    orderId = randomUUID();
    await client.query(
      `INSERT INTO orders
        (id, "companyId", "customerId", "orderNumber", "sourceChannel",
         "deliveryAddress", "requestedTimeSlot", subtotal, "deliveryFee", total,
         notes, "createdAt", "updatedAt")
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      [
        orderId,
        company.id,
        customerId,
        orderNumber,
        requiredString(formData, "sourceChannel"),
        deliveryAddress,
        optionalString(formData, "requestedTimeSlot"),
        money(subtotal),
        money(deliveryFee),
        money(total),
        optionalString(formData, "notes"),
      ],
    );

    await client.query(
      `INSERT INTO order_items
        (id, "orderId", "skuId", quantity, "unitPrice", "lineTotal",
         "createdAt", "updatedAt")
       VALUES
        ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [
        randomUUID(),
        orderId,
        sku.id,
        quantity(itemQuantity),
        money(unitPrice),
        money(subtotal),
      ],
    );

  });

  revalidatePath("/orders");
  redirect(`/orders/${orderId}`);
}

export async function confirmOrder(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");

  await sqlQuery(
    `UPDATE orders
        SET "orderStatus" = 'confirmed',
            "allocationStatus" = CASE
              WHEN "allocationStatus" = 'not_required' THEN 'pending'
              ELSE "allocationStatus"
            END,
            "confirmedAt" = COALESCE("confirmedAt", NOW()),
            "updatedAt" = NOW()
      WHERE id = $1
        AND "companyId" = $2`,
    [id, company.id],
  );

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
}

export async function retryAllocation(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");

  await sqlQuery(
    `UPDATE orders
        SET "allocationStatus" = 'pending',
            "updatedAt" = NOW()
      WHERE id = $1
        AND "companyId" = $2`,
    [id, company.id],
  );

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
}

export async function cancelOrder(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");

  await sqlQuery(
    `UPDATE orders
        SET "orderStatus" = 'cancelled',
            "fulfillmentStatus" = 'cancelled',
            "deliveryStatus" = 'cancelled',
            "cancelledAt" = COALESCE("cancelledAt", NOW()),
            "updatedAt" = NOW()
      WHERE id = $1
        AND "companyId" = $2`,
    [id, company.id],
  );

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
}
