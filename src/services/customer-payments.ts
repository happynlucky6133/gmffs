import { sqlQuery } from "@/lib/sql";
import { createManualPayment, updatePaymentProof } from "@/services/payments";

type SubmitCustomerPaymentProofInput = {
  companySlug: string;
  orderNumber: string;
  proofUrl: string;
  referenceNumber?: string | null;
};

export async function submitCustomerPaymentProof(input: SubmitCustomerPaymentProofInput) {
  const companyResult = await sqlQuery<{ id: string }>(
    `SELECT id FROM companies WHERE slug = $1 AND status = 'active' LIMIT 1`,
    [input.companySlug],
  );
  const company = companyResult.rows[0];
  if (!company) throw new Error("Company not found");

  const orderResult = await sqlQuery<{ id: string; total: string }>(
    `SELECT o.id, o.total::text
       FROM orders o
      WHERE o."companyId" = $1
        AND o."orderNumber" = $2
        AND o."paymentStatus" NOT IN ('paid', 'refunded')
      LIMIT 1`,
    [company.id, input.orderNumber],
  );
  const order = orderResult.rows[0];
  if (!order) throw new Error("Order not found or not payable");

  const methodResult = await sqlQuery<{ id: string }>(
    `SELECT id FROM payment_methods
      WHERE "companyId" = $1 AND enabled = true AND type = 'touch_n_go'
      LIMIT 1`,
    [company.id],
  );
  const paymentMethod = methodResult.rows[0];
  if (!paymentMethod) throw new Error("Touch n Go payment is not enabled");

  const existingResult = await sqlQuery<{ id: string }>(
    `SELECT id FROM payments
      WHERE "companyId" = $1 AND "orderId" = $2 AND status = 'awaiting_confirmation'
      ORDER BY "createdAt" DESC LIMIT 1`,
    [company.id, order.id],
  );
  const existing = existingResult.rows[0];

  if (existing) {
    return updatePaymentProof({
      companyId: company.id,
      paymentId: existing.id,
      proofUrl: input.proofUrl,
      referenceNumber: input.referenceNumber,
    });
  }

  return createManualPayment({
    companyId: company.id,
    orderId: order.id,
    paymentMethodId: paymentMethod.id,
    amount: order.total,
    proofUrl: input.proofUrl,
    referenceNumber: input.referenceNumber,
  });
}
