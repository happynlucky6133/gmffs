"use server";

import { revalidatePath } from "next/cache";
import { DeliveryProviderType } from "@/generated/prisma/client";
import { getActiveCompany } from "@/lib/company";
import {
  optionalString,
  requiredPositiveNumber,
  requiredString,
} from "@/lib/form";
import {
  bookDelivery,
  cancelDelivery,
  createDelivery,
  failDelivery,
  markDeliveryDelivered,
  markDeliveryPickedUp,
  quoteDelivery,
} from "@/services/deliveries";

export async function createManualDelivery(formData: FormData) {
  const company = await getActiveCompany();
  const quoteAmountValue = optionalString(formData, "quoteAmount");

  await createDelivery({
    companyId: company.id,
    orderId: requiredString(formData, "orderId"),
    locationId: optionalString(formData, "locationId"),
    provider: DeliveryProviderType.manual,
    quoteAmount: quoteAmountValue ? Number(quoteAmountValue) : null,
    pickupAddress: optionalString(formData, "pickupAddress"),
    dropoffAddress: optionalString(formData, "dropoffAddress"),
    scheduledAt: optionalDate(formData, "scheduledAt"),
  });

  revalidateDeliveryPages();
}

export async function setDeliveryQuote(formData: FormData) {
  const company = await getActiveCompany();

  const delivery = await quoteDelivery({
    companyId: company.id,
    deliveryId: requiredString(formData, "id"),
    quoteAmount: requiredPositiveNumber(formData, "quoteAmount"),
    notes: optionalString(formData, "notes"),
  });

  revalidateDeliveryPages(delivery.orderId);
}

export async function bookManualDelivery(formData: FormData) {
  const company = await getActiveCompany();

  const delivery = await bookDelivery({
    companyId: company.id,
    deliveryId: requiredString(formData, "id"),
    scheduledAt: optionalDate(formData, "scheduledAt"),
    trackingNumber: optionalString(formData, "trackingNumber"),
    providerRef: optionalString(formData, "providerRef"),
    notes: optionalString(formData, "notes"),
  });

  revalidateDeliveryPages(delivery.orderId);
}

export async function markPickedUp(formData: FormData) {
  const company = await getActiveCompany();

  const delivery = await markDeliveryPickedUp({
    companyId: company.id,
    deliveryId: requiredString(formData, "id"),
    notes: optionalString(formData, "notes"),
  });

  revalidateDeliveryPages(delivery.orderId);
}

export async function markDelivered(formData: FormData) {
  const company = await getActiveCompany();

  const delivery = await markDeliveryDelivered({
    companyId: company.id,
    deliveryId: requiredString(formData, "id"),
    notes: optionalString(formData, "notes"),
  });

  revalidateDeliveryPages(delivery.orderId);
}

export async function markFailed(formData: FormData) {
  const company = await getActiveCompany();

  const delivery = await failDelivery({
    companyId: company.id,
    deliveryId: requiredString(formData, "id"),
    notes: optionalString(formData, "notes"),
  });

  revalidateDeliveryPages(delivery.orderId);
}

export async function markCancelled(formData: FormData) {
  const company = await getActiveCompany();

  const delivery = await cancelDelivery({
    companyId: company.id,
    deliveryId: requiredString(formData, "id"),
    notes: optionalString(formData, "notes"),
  });

  revalidateDeliveryPages(delivery.orderId);
}

function optionalDate(formData: FormData, key: string) {
  const value = optionalString(formData, key);

  return value ? new Date(value) : null;
}

function revalidateDeliveryPages(orderId?: string | null) {
  revalidatePath("/deliveries");
  revalidatePath("/orders");

  if (orderId) {
    revalidatePath(`/orders/${orderId}`);
  }
}
