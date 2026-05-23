import { CompanyStatus, OrderStatus } from "@/generated/prisma/client";
import { money, quantity } from "@/lib/form";
import { prisma } from "@/lib/prisma";

type CustomerPortalOrderInput = {
  companySlug: string;
  skuId: string;
  itemQuantity: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  deliveryAddress: string;
  requestedTimeSlot?: string | null;
  notes?: string | null;
};

export async function createCustomerPortalOrder(
  input: CustomerPortalOrderInput,
) {
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findFirstOrThrow({
      where: {
        slug: input.companySlug,
        status: CompanyStatus.active,
      },
    });

    const sku = await tx.sku.findFirstOrThrow({
      where: {
        id: input.skuId,
        companyId: company.id,
        isActive: true,
        product: {
          isActive: true,
        },
      },
    });

    const existingCustomer = await tx.customer.findFirst({
      where: {
        companyId: company.id,
        phone: input.customerPhone,
      },
      orderBy: { updatedAt: "desc" },
    });

    const customer = existingCustomer
      ? await tx.customer.update({
          where: { id: existingCustomer.id },
          data: {
            name: input.customerName,
            email: input.customerEmail,
            address: input.deliveryAddress,
          },
        })
      : await tx.customer.create({
          data: {
            companyId: company.id,
            name: input.customerName,
            phone: input.customerPhone,
            email: input.customerEmail,
            address: input.deliveryAddress,
          },
        });

    const subtotal = input.itemQuantity * Number(sku.price);
    const orderNumber = nextOrderNumber(company.slug);

    return tx.order.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        orderNumber,
        sourceChannel: "customer_portal",
        deliveryAddress: input.deliveryAddress,
        requestedTimeSlot: input.requestedTimeSlot,
        orderStatus: OrderStatus.confirmed,
        subtotal: money(subtotal),
        deliveryFee: money(0),
        total: money(subtotal),
        notes: input.notes,
        items: {
          create: {
            skuId: sku.id,
            quantity: quantity(input.itemQuantity),
            unitPrice: money(Number(sku.price)),
            lineTotal: money(subtotal),
          },
        },
      },
    });
  });
}

function nextOrderNumber(companySlug: string) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toISOString().slice(11, 19).replaceAll(":", "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${companySlug.toUpperCase()}-${date}-${time}-${random}`;
}
