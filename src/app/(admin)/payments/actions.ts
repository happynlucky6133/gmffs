"use server";

import { revalidatePath } from "next/cache";
import { getActiveCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { PaymentEventType, PaymentStatus } from "@/generated/prisma/client";

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function optionalString(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() || null;
}

function requiredAmount(formData: FormData, key: string) {
  const value = Number(formData.get(key));

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be greater than zero`);
  }

  return value.toFixed(2);
}

async function addPaymentEvent(
  companyId: string,
  paymentId: string,
  type: PaymentEventType,
  notes?: string | null,
) {
  await prisma.paymentEvent.create({
    data: {
      companyId,
      paymentId,
      type,
      notes,
    },
  });
}

export async function setPaymentMethodEnabled(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");
  const enabled = formData.get("enabled") === "true";

  await prisma.paymentMethod.update({
    where: { id, companyId: company.id },
    data: { enabled },
  });

  revalidatePath("/payments");
}

export async function createPayment(formData: FormData) {
  const company = await getActiveCompany();
  const orderId = requiredString(formData, "orderId");
  const paymentMethodId = requiredString(formData, "paymentMethodId");
  const proofUrl = optionalString(formData, "proofUrl");
  const referenceNumber = optionalString(formData, "referenceNumber");

  const order = await prisma.order.findFirstOrThrow({
    where: {
      id: orderId,
      companyId: company.id,
    },
  });

  const paymentMethod = await prisma.paymentMethod.findFirstOrThrow({
    where: {
      id: paymentMethodId,
      companyId: company.id,
      enabled: true,
    },
  });

  const payment = await prisma.payment.create({
    data: {
      companyId: company.id,
      orderId: order.id,
      paymentMethodId: paymentMethod.id,
      amount: requiredAmount(formData, "amount"),
      status: PaymentStatus.awaiting_confirmation,
      proofUrl,
      referenceNumber,
    },
  });

  await addPaymentEvent(
    company.id,
    payment.id,
    PaymentEventType.created,
    `Payment created via ${paymentMethod.name}`,
  );

  if (proofUrl || referenceNumber) {
    await addPaymentEvent(
      company.id,
      payment.id,
      PaymentEventType.proof_submitted,
      "Proof or reference recorded",
    );
  }

  if (order.paymentStatus === PaymentStatus.unpaid) {
    await prisma.order.update({
      where: { id: order.id, companyId: company.id },
      data: { paymentStatus: PaymentStatus.awaiting_confirmation },
    });
  }

  revalidatePath("/payments");
  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
}

export async function updatePaymentProof(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");

  const payment = await prisma.payment.update({
    where: { id, companyId: company.id },
    data: {
      proofUrl: optionalString(formData, "proofUrl"),
      referenceNumber: optionalString(formData, "referenceNumber"),
    },
  });

  await addPaymentEvent(
    company.id,
    payment.id,
    PaymentEventType.proof_submitted,
    "Proof or reference updated",
  );

  revalidatePath("/payments");
}

export async function confirmPayment(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");

  const payment = await prisma.payment.update({
    where: { id, companyId: company.id },
    data: {
      status: PaymentStatus.paid,
      confirmedAt: new Date(),
    },
  });

  await prisma.order.update({
    where: { id: payment.orderId, companyId: company.id },
    data: { paymentStatus: PaymentStatus.paid },
  });

  await addPaymentEvent(
    company.id,
    payment.id,
    PaymentEventType.confirmed,
    optionalString(formData, "notes"),
  );

  revalidatePath("/payments");
  revalidatePath("/orders");
  revalidatePath(`/orders/${payment.orderId}`);
}

export async function failPayment(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");

  const payment = await prisma.payment.update({
    where: { id, companyId: company.id },
    data: {
      status: PaymentStatus.failed,
      failedAt: new Date(),
    },
  });

  const paidPayment = await prisma.payment.findFirst({
    where: {
      companyId: company.id,
      orderId: payment.orderId,
      status: PaymentStatus.paid,
    },
  });

  if (!paidPayment) {
    await prisma.order.update({
      where: { id: payment.orderId, companyId: company.id },
      data: { paymentStatus: PaymentStatus.failed },
    });
  }

  await addPaymentEvent(
    company.id,
    payment.id,
    PaymentEventType.failed,
    optionalString(formData, "notes"),
  );

  revalidatePath("/payments");
  revalidatePath("/orders");
  revalidatePath(`/orders/${payment.orderId}`);
}

export async function markRefundRequired(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");

  const payment = await prisma.payment.update({
    where: { id, companyId: company.id },
    data: { status: PaymentStatus.refund_required },
  });

  await prisma.order.update({
    where: { id: payment.orderId, companyId: company.id },
    data: { paymentStatus: PaymentStatus.refund_required },
  });

  await addPaymentEvent(
    company.id,
    payment.id,
    PaymentEventType.refund_required,
    optionalString(formData, "notes"),
  );

  revalidatePath("/payments");
  revalidatePath("/orders");
  revalidatePath(`/orders/${payment.orderId}`);
}

export async function markRefunded(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");

  const payment = await prisma.payment.update({
    where: { id, companyId: company.id },
    data: {
      status: PaymentStatus.refunded,
      refundedAt: new Date(),
    },
  });

  await prisma.order.update({
    where: { id: payment.orderId, companyId: company.id },
    data: { paymentStatus: PaymentStatus.refunded },
  });

  await addPaymentEvent(
    company.id,
    payment.id,
    PaymentEventType.refunded,
    optionalString(formData, "notes"),
  );

  revalidatePath("/payments");
  revalidatePath("/orders");
  revalidatePath(`/orders/${payment.orderId}`);
}

