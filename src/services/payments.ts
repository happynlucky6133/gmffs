import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { sqlPool } from "@/lib/sql";

type CreatePaymentInput = {
  companyId: string;
  orderId: string;
  paymentMethodId: string;
  amount: string;
  proofUrl?: string | null;
  referenceNumber?: string | null;
};

type PaymentTransitionInput = {
  companyId: string;
  paymentId: string;
  notes?: string | null;
};

type PaymentResult = {
  id: string;
  orderId: string;
};

async function withClient<T>(
  callback: (client: PoolClient) => Promise<T>,
) {
  if (!sqlPool) {
    throw new Error("DATABASE_URL is not configured");
  }

  const client = await sqlPool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function addPaymentEvent(
  client: PoolClient,
  companyId: string,
  paymentId: string,
  type: string,
  notes?: string | null,
) {
  await client.query(
    `INSERT INTO payment_events
      (id, "companyId", "paymentId", type, notes, "createdAt")
     VALUES
      ($1, $2, $3, $4, $5, NOW())`,
    [randomUUID(), companyId, paymentId, type, notes ?? null],
  );
}

export async function createManualPayment(
  input: CreatePaymentInput,
): Promise<PaymentResult> {
  return withClient(async (client) => {
    const orderResult = await client.query<{ id: string }>(
      `SELECT id
         FROM orders
        WHERE id = $1
          AND "companyId" = $2
          AND "orderStatus" <> 'cancelled'
          AND "paymentStatus" NOT IN ('paid', 'refunded')
        LIMIT 1`,
      [input.orderId, input.companyId],
    );
    const order = orderResult.rows[0];
    if (!order) {
      throw new Error("Order is not payable");
    }

    const methodResult = await client.query<{ id: string; name: string }>(
      `SELECT id, name
         FROM payment_methods
        WHERE id = $1
          AND "companyId" = $2
          AND enabled = true
        LIMIT 1`,
      [input.paymentMethodId, input.companyId],
    );
    const paymentMethod = methodResult.rows[0];
    if (!paymentMethod) {
      throw new Error("Payment method is not enabled");
    }

    const paymentId = randomUUID();
    await client.query(
      `INSERT INTO payments
        (id, "companyId", "orderId", "paymentMethodId", amount, status,
         "proofUrl", "referenceNumber", "createdAt", "updatedAt")
       VALUES
        ($1, $2, $3, $4, $5, 'awaiting_confirmation', $6, $7, NOW(), NOW())`,
      [
        paymentId,
        input.companyId,
        order.id,
        paymentMethod.id,
        input.amount,
        input.proofUrl ?? null,
        input.referenceNumber ?? null,
      ],
    );

    await addPaymentEvent(
      client,
      input.companyId,
      paymentId,
      "created",
      `Payment created via ${paymentMethod.name}`,
    );

    if (input.proofUrl || input.referenceNumber) {
      await addPaymentEvent(
        client,
        input.companyId,
        paymentId,
        "proof_submitted",
        "Proof or reference recorded",
      );
    }

    await client.query(
      `UPDATE orders
          SET "paymentStatus" = 'awaiting_confirmation',
              "updatedAt" = NOW()
        WHERE id = $1
          AND "companyId" = $2
          AND "paymentStatus" = 'unpaid'`,
      [order.id, input.companyId],
    );

    return { id: paymentId, orderId: order.id };
  });
}

export async function updatePaymentProof(input: {
  companyId: string;
  paymentId: string;
  proofUrl?: string | null;
  referenceNumber?: string | null;
}): Promise<PaymentResult> {
  return withClient(async (client) => {
    const payment = await requirePayment(
      client,
      input.companyId,
      input.paymentId,
      "awaiting_confirmation",
    );

    await client.query(
      `UPDATE payments
          SET "proofUrl" = $1,
              "referenceNumber" = $2,
              "updatedAt" = NOW()
        WHERE id = $3
          AND "companyId" = $4`,
      [
        input.proofUrl ?? null,
        input.referenceNumber ?? null,
        input.paymentId,
        input.companyId,
      ],
    );

    await addPaymentEvent(
      client,
      input.companyId,
      input.paymentId,
      "proof_submitted",
      "Proof or reference updated",
    );

    return payment;
  });
}

export async function confirmPayment(
  input: PaymentTransitionInput,
): Promise<PaymentResult> {
  return transitionPayment(input, "awaiting_confirmation", "paid", "confirmed");
}

export async function failPayment(
  input: PaymentTransitionInput,
): Promise<PaymentResult> {
  return transitionPayment(input, "awaiting_confirmation", "failed", "failed");
}

export async function markRefundRequired(
  input: PaymentTransitionInput,
): Promise<PaymentResult> {
  return transitionPayment(input, "paid", "refund_required", "refund_required");
}

export async function markRefunded(
  input: PaymentTransitionInput,
): Promise<PaymentResult> {
  return transitionPayment(input, "refund_required", "refunded", "refunded");
}

async function transitionPayment(
  input: PaymentTransitionInput,
  fromStatus: string,
  toStatus: string,
  eventType: string,
): Promise<PaymentResult> {
  return withClient(async (client) => {
    const payment = await requirePayment(
      client,
      input.companyId,
      input.paymentId,
      fromStatus,
    );

    await client.query(
      `UPDATE payments
          SET status = $1,
              "confirmedAt" = CASE WHEN $1 = 'paid' THEN NOW() ELSE "confirmedAt" END,
              "failedAt" = CASE WHEN $1 = 'failed' THEN NOW() ELSE "failedAt" END,
              "refundedAt" = CASE WHEN $1 = 'refunded' THEN NOW() ELSE "refundedAt" END,
              "updatedAt" = NOW()
        WHERE id = $2
          AND "companyId" = $3`,
      [toStatus, input.paymentId, input.companyId],
    );

    await client.query(
      `UPDATE orders
          SET "paymentStatus" = $1,
              "updatedAt" = NOW()
        WHERE id = $2
          AND "companyId" = $3`,
      [toStatus, payment.orderId, input.companyId],
    );

    await addPaymentEvent(
      client,
      input.companyId,
      input.paymentId,
      eventType,
      input.notes,
    );

    return payment;
  });
}

async function requirePayment(
  client: PoolClient,
  companyId: string,
  paymentId: string,
  status: string,
): Promise<PaymentResult> {
  const result = await client.query<PaymentResult>(
    `SELECT id, "orderId" AS "orderId"
       FROM payments
      WHERE id = $1
        AND "companyId" = $2
        AND status = $3
      LIMIT 1`,
    [paymentId, companyId, status],
  );

  const payment = result.rows[0];
  if (!payment) {
    throw new Error("Payment is not in the expected status");
  }

  return payment;
}
