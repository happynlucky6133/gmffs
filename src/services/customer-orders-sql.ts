import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

const pool =
  databaseUrl == null
    ? null
    : new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes("supabase.com")
          ? { rejectUnauthorized: false }
          : undefined,
      });

type CreateCustomerOrderInput = {
  companySlug: string;
  skuCode: string;
  quantity: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  deliveryAddress: string;
  requestedTimeSlot?: string | null;
  notes?: string | null;
};

export type CreatedCustomerOrder = {
  orderNumber: string;
  total: string;
};

function money(value: number) {
  return value.toFixed(2);
}

function quantity(value: number) {
  return value.toFixed(3);
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

export async function createCustomerOrderSql(
  input: CreateCustomerOrderInput,
): Promise<CreatedCustomerOrder> {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }

  const companySlug = requiredText(input.companySlug, "companySlug");
  const skuCode = requiredText(input.skuCode, "skuCode");
  const customerName = requiredText(input.customerName, "customerName");
  const customerPhone = requiredText(input.customerPhone, "customerPhone");
  const deliveryAddress = requiredText(input.deliveryAddress, "deliveryAddress");

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("quantity must be greater than zero");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const companyResult = await client.query<{ id: string; slug: string }>(
      `SELECT id, slug
         FROM companies
        WHERE slug = $1
          AND status = 'active'
        LIMIT 1`,
      [companySlug],
    );

    const company = companyResult.rows[0];
    if (!company) {
      throw new Error("Company is not available");
    }

    const skuResult = await client.query<{
      id: string;
      price: string;
      name: string;
    }>(
      `SELECT id, price::text, name
         FROM skus
        WHERE "companyId" = $1
          AND code = $2
          AND "isActive" = true
        LIMIT 1`,
      [company.id, skuCode],
    );

    const sku = skuResult.rows[0];
    if (!sku) {
      throw new Error("Selected fruit is not available");
    }

    const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const prefix = `${company.slug.toUpperCase()}-${today}`;
    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM orders
        WHERE "companyId" = $1
          AND "orderNumber" LIKE $2`,
      [company.id, `${prefix}%`],
    );

    const sequence = Number(countResult.rows[0]?.count ?? "0") + 1;
    const orderNumber = `${prefix}-${String(sequence).padStart(4, "0")}`;
    const unitPrice = Number(sku.price);
    const subtotal = input.quantity * unitPrice;

    const customerId = randomUUID();
    const orderId = randomUUID();
    const orderItemId = randomUUID();

    await client.query(
      `INSERT INTO customers
        (id, "companyId", name, phone, email, address, "createdAt", "updatedAt")
       VALUES
        ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [
        customerId,
        company.id,
        customerName,
        customerPhone,
        input.customerEmail?.trim() || null,
        deliveryAddress,
      ],
    );

    await client.query(
      `INSERT INTO orders
        (id, "companyId", "customerId", "orderNumber", "sourceChannel",
         "deliveryAddress", "requestedTimeSlot", subtotal, "deliveryFee", total,
         "orderStatus", "paymentStatus", "allocationStatus",
         "fulfillmentStatus", "deliveryStatus", notes, "createdAt", "updatedAt")
       VALUES
        ($1, $2, $3, $4, 'customer_portal',
         $5, $6, $7, 0, $7,
         'draft', 'unpaid', 'pending',
         'pending', 'not_required', $8, NOW(), NOW())`,
      [
        orderId,
        company.id,
        customerId,
        orderNumber,
        deliveryAddress,
        input.requestedTimeSlot?.trim() || null,
        money(subtotal),
        input.notes?.trim() || null,
      ],
    );

    await client.query(
      `INSERT INTO order_items
        (id, "orderId", "skuId", quantity, "unitPrice", "lineTotal",
         "createdAt", "updatedAt")
       VALUES
        ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [
        orderItemId,
        orderId,
        sku.id,
        quantity(input.quantity),
        money(unitPrice),
        money(subtotal),
      ],
    );

    await client.query("COMMIT");

    return {
      orderNumber,
      total: money(subtotal),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
