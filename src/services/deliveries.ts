import { randomUUID } from "node:crypto";
import { money } from "@/lib/form";
import { withSqlTransaction } from "@/lib/sql";

type CreateDeliveryInput = {
  companyId: string;
  orderId: string;
  locationId?: string | null;
  provider: string;
  quoteAmount?: number | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  scheduledAt?: Date | null;
};

type DeliveryTransitionInput = {
  companyId: string;
  deliveryId: string;
  notes?: string | null;
};

async function addDeliveryEvent(
  client: Parameters<Parameters<typeof withSqlTransaction>[0]>[0],
  companyId: string,
  deliveryId: string,
  type: string,
  notes?: string | null,
) {
  await client.query(
    `INSERT INTO delivery_events (id, "companyId", "deliveryId", type, notes, "createdAt")
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [randomUUID(), companyId, deliveryId, type, notes ?? null],
  );
}

export async function createDelivery(input: CreateDeliveryInput) {
  return withSqlTransaction(async (client) => {
    const order = await client.query(
      `SELECT id, "deliveryAddress" FROM orders WHERE id = $1 AND "companyId" = $2`,
      [input.orderId, input.companyId],
    );
    if (order.rows.length === 0) throw new Error("Order not found");

    const active = await client.query(
      `SELECT id FROM deliveries WHERE "companyId" = $1 AND "orderId" = $2
        AND status NOT IN ('cancelled', 'failed') LIMIT 1`,
      [input.companyId, input.orderId],
    );
    if (active.rows.length > 0) throw new Error("Order already has an active delivery");

    if (input.locationId) {
      const loc = await client.query(
        `SELECT id FROM inventory_locations WHERE id = $1 AND "companyId" = $2 AND "isActive" = true`,
        [input.locationId, input.companyId],
      );
      if (loc.rows.length === 0) throw new Error("Location not found");
    }

    const status = input.quoteAmount ? "quoted" : "pending_quote";
    const deliveryId = randomUUID();

    await client.query(
      `INSERT INTO deliveries
        (id, "companyId", "orderId", "locationId", provider, status,
         "quoteAmount", "pickupAddress", "dropoffAddress", "scheduledAt",
         "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [
        deliveryId, input.companyId, input.orderId, input.locationId ?? null,
        input.provider, status,
        input.quoteAmount ? money(input.quoteAmount) : null,
        input.pickupAddress ?? null,
        input.dropoffAddress ?? order.rows[0].deliveryAddress,
        input.scheduledAt ?? null,
      ],
    );

    await addDeliveryEvent(client, input.companyId, deliveryId,
      input.quoteAmount ? "quoted" : "webhook_received",
      input.quoteAmount ? "Manual quote created" : "Delivery created");

    await client.query(
      `UPDATE orders SET "deliveryStatus" = $1, "updatedAt" = NOW()
        WHERE id = $2 AND "companyId" = $3`,
      [status, input.orderId, input.companyId],
    );

    return { id: deliveryId, orderId: input.orderId };
  });
}

export async function quoteDelivery(input: {
  companyId: string;
  deliveryId: string;
  quoteAmount: number;
  notes?: string | null;
}) {
  return withSqlTransaction(async (client) => {
    const d = await client.query<{ id: string; "orderId": string }>(
      `SELECT id, "orderId" FROM deliveries WHERE id = $1 AND "companyId" = $2 AND status = 'pending_quote'`,
      [input.deliveryId, input.companyId],
    );
    if (d.rows.length === 0) throw new Error("Delivery not found or not in pending_quote");

    await client.query(
      `UPDATE deliveries SET status = 'quoted', "quoteAmount" = $1, "updatedAt" = NOW()
        WHERE id = $2 AND "companyId" = $3`,
      [money(input.quoteAmount), input.deliveryId, input.companyId],
    );

    await client.query(
      `UPDATE orders SET "deliveryStatus" = 'quoted', "updatedAt" = NOW()
        WHERE id = $1 AND "companyId" = $2`,
      [d.rows[0].orderId, input.companyId],
    );

    await addDeliveryEvent(client, input.companyId, input.deliveryId, "quoted", input.notes);

    return d.rows[0];
  });
}

export async function bookDelivery(input: {
  companyId: string;
  deliveryId: string;
  scheduledAt?: Date | null;
  trackingNumber?: string | null;
  providerRef?: string | null;
  notes?: string | null;
}) {
  return withSqlTransaction(async (client) => {
    const d = await client.query<{ id: string; "orderId": string }>(
      `SELECT id, "orderId" FROM deliveries WHERE id = $1 AND "companyId" = $2
        AND status IN ('pending_quote', 'quoted')`,
      [input.deliveryId, input.companyId],
    );
    if (d.rows.length === 0) throw new Error("Delivery not found or not bookable");

    await client.query(
      `UPDATE deliveries SET status = 'booked', "scheduledAt" = $1,
              "trackingNumber" = $2, "providerRef" = $3, "updatedAt" = NOW()
        WHERE id = $4 AND "companyId" = $5`,
      [input.scheduledAt ?? null, input.trackingNumber ?? null,
       input.providerRef ?? null, input.deliveryId, input.companyId],
    );

    await client.query(
      `UPDATE orders SET "deliveryStatus" = 'booked',
              "fulfillmentStatus" = 'ready_for_pickup', "updatedAt" = NOW()
        WHERE id = $1 AND "companyId" = $2`,
      [d.rows[0].orderId, input.companyId],
    );

    await addDeliveryEvent(client, input.companyId, input.deliveryId, "booked", input.notes);

    return d.rows[0];
  });
}

export async function markDeliveryPickedUp(input: DeliveryTransitionInput) {
  return updateDeliveryState(input, ["booked"], "picked_up", "picked_up", "handed_over");
}

export async function markDeliveryDelivered(input: DeliveryTransitionInput) {
  return updateDeliveryState(input, ["picked_up"], "delivered", "delivered", "completed", new Date());
}

export async function failDelivery(input: DeliveryTransitionInput) {
  return updateDeliveryState(input, ["pending_quote", "quoted", "booked", "picked_up"], "failed", "failed");
}

export async function cancelDelivery(input: DeliveryTransitionInput) {
  return updateDeliveryState(input, ["pending_quote", "quoted", "booked"], "cancelled", "cancelled");
}

async function updateDeliveryState(
  input: DeliveryTransitionInput,
  allowedStatuses: string[],
  toStatus: string,
  eventType: string,
  fulfillmentStatus?: string,
  deliveredAt?: Date,
) {
  return withSqlTransaction(async (client) => {
    const placeholders = allowedStatuses.map((_, i) => `$${i + 3}`).join(", ");
    const d = await client.query<{ id: string; "orderId": string }>(
      `SELECT id, "orderId" FROM deliveries
        WHERE id = $1 AND "companyId" = $2
          AND status IN (${placeholders})`,
      [input.deliveryId, input.companyId, ...allowedStatuses],
    );
    if (d.rows.length === 0) throw new Error("Delivery not found or not in expected status");

    await client.query(
      `UPDATE deliveries SET status = $1, "deliveredAt" = $2, "updatedAt" = NOW()
        WHERE id = $3 AND "companyId" = $4`,
      [toStatus, deliveredAt ?? null, input.deliveryId, input.companyId],
    );

    const orderUpdates = [`"deliveryStatus" = $1`];
    const orderValues: unknown[] = [toStatus];

    if (fulfillmentStatus) {
      orderUpdates.push(`"fulfillmentStatus" = $2`);
      orderValues.push(fulfillmentStatus);
    }
    orderValues.push(d.rows[0].orderId, input.companyId);

    await client.query(
      `UPDATE orders SET ${orderUpdates.join(", ")}, "updatedAt" = NOW()
        WHERE id = $${orderValues.length - 1} AND "companyId" = $${orderValues.length}`,
      orderValues,
    );

    await addDeliveryEvent(client, input.companyId, input.deliveryId, eventType, input.notes);

    return d.rows[0];
  });
}
