"use server";

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
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@/generated/prisma/client";

async function nextOrderNumber(companySlug: string) {
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const count = await prisma.order.count({
    where: {
      orderNumber: {
        startsWith: `${companySlug.toUpperCase()}-${today}`,
      },
    },
  });

  return `${companySlug.toUpperCase()}-${today}-${String(count + 1).padStart(4, "0")}`;
}

export async function createOrder(formData: FormData) {
  const company = await getActiveCompany();
  const existingCustomerId = optionalString(formData, "customerId");
  const skuId = requiredString(formData, "skuId");
  const itemQuantity = requiredPositiveNumber(formData, "quantity");
  const unitPrice = requiredPositiveNumber(formData, "unitPrice");
  const deliveryFee = requiredNonNegativeNumber(formData, "deliveryFee");

  const orderNumber = await nextOrderNumber(company.slug);

  const order = await prisma.$transaction(async (tx) => {
    const customer = existingCustomerId
      ? await tx.customer.findFirstOrThrow({
          where: {
            id: existingCustomerId,
            companyId: company.id,
          },
        })
      : await tx.customer.create({
          data: {
            companyId: company.id,
            name: requiredString(formData, "customerName"),
            phone: optionalString(formData, "customerPhone"),
            email: optionalString(formData, "customerEmail"),
            address: optionalString(formData, "customerAddress"),
          },
        });

    const sku = await tx.sku.findFirstOrThrow({
      where: {
        id: skuId,
        companyId: company.id,
        isActive: true,
      },
    });

    const subtotal = itemQuantity * unitPrice;
    const total = subtotal + deliveryFee;
    const deliveryAddress =
      optionalString(formData, "deliveryAddress") ?? customer.address;

    if (!deliveryAddress) {
      throw new Error("deliveryAddress is required");
    }

    return tx.order.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        orderNumber,
        sourceChannel: requiredString(formData, "sourceChannel"),
        deliveryAddress,
        requestedTimeSlot: optionalString(formData, "requestedTimeSlot"),
        subtotal: money(subtotal),
        deliveryFee: money(deliveryFee),
        total: money(total),
        notes: optionalString(formData, "notes"),
        items: {
          create: {
            skuId: sku.id,
            quantity: quantity(itemQuantity),
            unitPrice: money(unitPrice),
            lineTotal: money(subtotal),
          },
        },
      },
    });
  });

  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

export async function confirmOrder(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");

  await prisma.order.update({
    where: {
      id,
      companyId: company.id,
    },
    data: {
      orderStatus: OrderStatus.confirmed,
      confirmedAt: new Date(),
    },
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
}

export async function cancelOrder(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");

  await prisma.order.update({
    where: {
      id,
      companyId: company.id,
    },
    data: {
      orderStatus: OrderStatus.cancelled,
      cancelledAt: new Date(),
    },
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
}
