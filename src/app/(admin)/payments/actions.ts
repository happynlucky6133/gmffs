"use server";

import { revalidatePath } from "next/cache";
import { getActiveCompany } from "@/lib/company";
import {
  money,
  optionalString,
  requiredPositiveNumber,
  requiredString,
} from "@/lib/form";
import { prisma } from "@/lib/prisma";
import {
  confirmPayment as confirmPaymentService,
  createManualPayment,
  failPayment as failPaymentService,
  markRefunded as markRefundedService,
  markRefundRequired as markRefundRequiredService,
  updatePaymentProof as updatePaymentProofService,
} from "@/services/payments";

export async function setPaymentMethodEnabled(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");
  const enabled = formData.get("enabled") === "true";

  await prisma.paymentMethod.update({
    where: { id, companyId: company.id },
    data: { enabled },
  });

  revalidatePaymentPages();
}

export async function createPayment(formData: FormData) {
  const company = await getActiveCompany();
  const payment = await createManualPayment({
    companyId: company.id,
    orderId: requiredString(formData, "orderId"),
    paymentMethodId: requiredString(formData, "paymentMethodId"),
    amount: money(requiredPositiveNumber(formData, "amount")),
    proofUrl: optionalString(formData, "proofUrl"),
    referenceNumber: optionalString(formData, "referenceNumber"),
  });

  revalidatePaymentPages(payment.orderId);
}

export async function updatePaymentProof(formData: FormData) {
  const company = await getActiveCompany();
  const payment = await updatePaymentProofService({
    companyId: company.id,
    paymentId: requiredString(formData, "id"),
    proofUrl: optionalString(formData, "proofUrl"),
    referenceNumber: optionalString(formData, "referenceNumber"),
  });

  revalidatePaymentPages(payment.orderId);
}

export async function confirmPayment(formData: FormData) {
  const company = await getActiveCompany();
  const payment = await confirmPaymentService({
    companyId: company.id,
    paymentId: requiredString(formData, "id"),
    notes: optionalString(formData, "notes"),
  });

  revalidatePaymentPages(payment.orderId);
}

export async function failPayment(formData: FormData) {
  const company = await getActiveCompany();
  const payment = await failPaymentService({
    companyId: company.id,
    paymentId: requiredString(formData, "id"),
    notes: optionalString(formData, "notes"),
  });

  revalidatePaymentPages(payment.orderId);
}

export async function markRefundRequired(formData: FormData) {
  const company = await getActiveCompany();
  const payment = await markRefundRequiredService({
    companyId: company.id,
    paymentId: requiredString(formData, "id"),
    notes: optionalString(formData, "notes"),
  });

  revalidatePaymentPages(payment.orderId);
}

export async function markRefunded(formData: FormData) {
  const company = await getActiveCompany();
  const payment = await markRefundedService({
    companyId: company.id,
    paymentId: requiredString(formData, "id"),
    notes: optionalString(formData, "notes"),
  });

  revalidatePaymentPages(payment.orderId);
}

function revalidatePaymentPages(orderId?: string) {
  revalidatePath("/payments");
  revalidatePath("/orders");

  if (orderId) {
    revalidatePath(`/orders/${orderId}`);
  }
}

