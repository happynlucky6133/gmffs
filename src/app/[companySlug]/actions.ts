"use server";

import { redirect } from "next/navigation";
import {
  optionalString,
  requiredPositiveNumber,
  requiredString,
} from "@/lib/form";
import { createCustomerPortalOrder } from "@/services/orders";

export async function submitCustomerOrder(
  companySlug: string,
  formData: FormData,
) {
  const order = await createCustomerPortalOrder({
    companySlug,
    skuId: requiredString(formData, "skuId"),
    itemQuantity: requiredPositiveNumber(formData, "quantity"),
    customerName: requiredString(formData, "customerName"),
    customerPhone: requiredString(formData, "customerPhone"),
    customerEmail: optionalString(formData, "customerEmail"),
    deliveryAddress: requiredString(formData, "deliveryAddress"),
    requestedTimeSlot: optionalString(formData, "requestedTimeSlot"),
    notes: optionalString(formData, "notes"),
  });

  redirect(`/${companySlug}/orders/${order.orderNumber}`);
}
