import {
  DeliveryEventType,
  DeliveryProviderType,
  DeliveryStatus,
  FulfillmentStatus,
} from "@/generated/prisma/client";
import { money } from "@/lib/form";
import { prisma } from "@/lib/prisma";

type CreateDeliveryInput = {
  companyId: string;
  orderId: string;
  locationId?: string | null;
  provider: DeliveryProviderType;
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

export async function createDelivery(input: CreateDeliveryInput) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirstOrThrow({
      where: {
        id: input.orderId,
        companyId: input.companyId,
      },
    });

    const activeDelivery = await tx.delivery.findFirst({
      where: {
        companyId: input.companyId,
        orderId: order.id,
        status: {
          notIn: [DeliveryStatus.cancelled, DeliveryStatus.failed],
        },
      },
    });

    if (activeDelivery) {
      throw new Error("Order already has an active delivery");
    }

    if (input.locationId) {
      await tx.inventoryLocation.findFirstOrThrow({
        where: {
          id: input.locationId,
          companyId: input.companyId,
          isActive: true,
        },
      });
    }

    const quoteAmount = input.quoteAmount ?? null;
    const status = quoteAmount
      ? DeliveryStatus.quoted
      : DeliveryStatus.pending_quote;

    const delivery = await tx.delivery.create({
      data: {
        companyId: input.companyId,
        orderId: order.id,
        locationId: input.locationId,
        provider: input.provider,
        status,
        quoteAmount: quoteAmount === null ? null : money(quoteAmount),
        pickupAddress: input.pickupAddress,
        dropoffAddress: input.dropoffAddress ?? order.deliveryAddress,
        scheduledAt: input.scheduledAt,
      },
    });

    await addDeliveryEvent(
      tx,
      input.companyId,
      delivery.id,
      quoteAmount ? DeliveryEventType.quoted : DeliveryEventType.webhook_received,
      quoteAmount ? "Manual quote created" : "Delivery created",
    );

    await tx.order.update({
      where: {
        id: order.id,
        companyId: input.companyId,
      },
      data: {
        deliveryStatus: status,
      },
    });

    return delivery;
  });
}

export async function quoteDelivery(input: {
  companyId: string;
  deliveryId: string;
  quoteAmount: number;
  notes?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.delivery.findFirstOrThrow({
      where: {
        id: input.deliveryId,
        companyId: input.companyId,
        status: DeliveryStatus.pending_quote,
      },
    });

    const delivery = await tx.delivery.update({
      where: {
        id: input.deliveryId,
        companyId: input.companyId,
      },
      data: {
        status: DeliveryStatus.quoted,
        quoteAmount: money(input.quoteAmount),
      },
    });

    await tx.order.update({
      where: {
        id: delivery.orderId,
        companyId: input.companyId,
      },
      data: {
        deliveryStatus: DeliveryStatus.quoted,
      },
    });

    await addDeliveryEvent(
      tx,
      input.companyId,
      delivery.id,
      DeliveryEventType.quoted,
      input.notes,
    );

    return delivery;
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
  return prisma.$transaction(async (tx) => {
    await tx.delivery.findFirstOrThrow({
      where: {
        id: input.deliveryId,
        companyId: input.companyId,
        status: {
          in: [DeliveryStatus.pending_quote, DeliveryStatus.quoted],
        },
      },
    });

    const delivery = await tx.delivery.update({
      where: {
        id: input.deliveryId,
        companyId: input.companyId,
      },
      data: {
        status: DeliveryStatus.booked,
        scheduledAt: input.scheduledAt,
        trackingNumber: input.trackingNumber,
        providerRef: input.providerRef,
      },
    });

    await tx.order.update({
      where: {
        id: delivery.orderId,
        companyId: input.companyId,
      },
      data: {
        deliveryStatus: DeliveryStatus.booked,
        fulfillmentStatus: FulfillmentStatus.ready_for_pickup,
      },
    });

    await addDeliveryEvent(
      tx,
      input.companyId,
      delivery.id,
      DeliveryEventType.booked,
      input.notes,
    );

    return delivery;
  });
}

export async function markDeliveryPickedUp(input: DeliveryTransitionInput) {
  return updateDeliveryState(input, {
    allowedStatuses: [DeliveryStatus.booked],
    deliveryStatus: DeliveryStatus.picked_up,
    fulfillmentStatus: FulfillmentStatus.handed_over,
    eventType: DeliveryEventType.picked_up,
  });
}

export async function markDeliveryDelivered(input: DeliveryTransitionInput) {
  return updateDeliveryState(input, {
    allowedStatuses: [DeliveryStatus.picked_up],
    deliveryStatus: DeliveryStatus.delivered,
    fulfillmentStatus: FulfillmentStatus.completed,
    eventType: DeliveryEventType.delivered,
    deliveredAt: new Date(),
  });
}

export async function failDelivery(input: DeliveryTransitionInput) {
  return updateDeliveryState(input, {
    allowedStatuses: [
      DeliveryStatus.pending_quote,
      DeliveryStatus.quoted,
      DeliveryStatus.booked,
      DeliveryStatus.picked_up,
    ],
    deliveryStatus: DeliveryStatus.failed,
    eventType: DeliveryEventType.failed,
  });
}

export async function cancelDelivery(input: DeliveryTransitionInput) {
  return updateDeliveryState(input, {
    allowedStatuses: [
      DeliveryStatus.pending_quote,
      DeliveryStatus.quoted,
      DeliveryStatus.booked,
    ],
    deliveryStatus: DeliveryStatus.cancelled,
    eventType: DeliveryEventType.cancelled,
  });
}

async function updateDeliveryState(
  input: DeliveryTransitionInput,
  next: {
    allowedStatuses: DeliveryStatus[];
    deliveryStatus: DeliveryStatus;
    fulfillmentStatus?: FulfillmentStatus;
    eventType: DeliveryEventType;
    deliveredAt?: Date;
  },
) {
  return prisma.$transaction(async (tx) => {
    await tx.delivery.findFirstOrThrow({
      where: {
        id: input.deliveryId,
        companyId: input.companyId,
        status: {
          in: next.allowedStatuses,
        },
      },
    });

    const delivery = await tx.delivery.update({
      where: {
        id: input.deliveryId,
        companyId: input.companyId,
      },
      data: {
        status: next.deliveryStatus,
        deliveredAt: next.deliveredAt,
      },
    });

    await tx.order.update({
      where: {
        id: delivery.orderId,
        companyId: input.companyId,
      },
      data: {
        deliveryStatus: next.deliveryStatus,
        fulfillmentStatus: next.fulfillmentStatus,
      },
    });

    await addDeliveryEvent(
      tx,
      input.companyId,
      delivery.id,
      next.eventType,
      input.notes,
    );

    return delivery;
  });
}

async function addDeliveryEvent(
  tx: TransactionClient,
  companyId: string,
  deliveryId: string,
  type: DeliveryEventType,
  notes?: string | null,
) {
  await tx.deliveryEvent.create({
    data: {
      companyId,
      deliveryId,
      type,
      notes,
    },
  });
}

type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];
