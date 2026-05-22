import {
  AllocationAttemptStatus,
  AllocationLineStatus,
  AllocationStatus,
  DeliveryStatus,
  FulfillmentStatus,
  InventoryMovementType,
  OrderStatus,
} from "@/generated/prisma/client";
import { quantity } from "@/lib/form";
import { prisma } from "@/lib/prisma";

type AllocationResult = {
  orderId: string;
  status: AllocationStatus;
};

type OrderWithItems = Awaited<
  ReturnType<typeof getOrderForAllocation>
>;

export async function confirmAndAllocateOrder(
  companyId: string,
  orderId: string,
): Promise<AllocationResult> {
  return prisma.$transaction(async (tx) => {
    await tx.order.findFirstOrThrow({
      where: {
        id: orderId,
        companyId,
        orderStatus: OrderStatus.draft,
      },
    });

    const order = await tx.order.update({
      where: { id: orderId, companyId },
      data: {
        orderStatus: OrderStatus.confirmed,
        confirmedAt: new Date(),
      },
      include: {
        items: true,
      },
    });

    return allocateOrderInTransaction(tx, companyId, order);
  });
}

export async function retryOrderAllocation(
  companyId: string,
  orderId: string,
): Promise<AllocationResult> {
  return prisma.$transaction(async (tx) => {
    const order = await getOrderForAllocation(tx, companyId, orderId);

    if (order.orderStatus !== OrderStatus.confirmed) {
      throw new Error("Only confirmed orders can be allocated");
    }

    await releaseOrderAllocationInTransaction(tx, companyId, orderId);

    return allocateOrderInTransaction(tx, companyId, order);
  });
}

export async function cancelAndReleaseOrder(companyId: string, orderId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.order.findFirstOrThrow({
      where: {
        id: orderId,
        companyId,
        orderStatus: {
          not: OrderStatus.cancelled,
        },
        fulfillmentStatus: {
          not: FulfillmentStatus.completed,
        },
      },
    });

    await releaseOrderAllocationInTransaction(tx, companyId, orderId);

    await tx.order.update({
      where: { id: orderId, companyId },
      data: {
        orderStatus: OrderStatus.cancelled,
        allocationStatus: AllocationStatus.released,
        fulfillmentStatus: FulfillmentStatus.cancelled,
        cancelledAt: new Date(),
      },
    });
  });
}

async function allocateOrderInTransaction(
  tx: TransactionClient,
  companyId: string,
  order: NonNullable<OrderWithItems>,
): Promise<AllocationResult> {
  if (order.items.length === 0) {
    throw new Error("Order has no items");
  }

  const locations = await tx.inventoryLocation.findMany({
    where: {
      companyId,
      isActive: true,
    },
    orderBy: { code: "asc" },
  });

  for (const location of locations) {
    const allocation = await canAllocateFromLocation(
      tx,
      companyId,
      location.id,
      order.items,
    );

    if (!allocation.canAllocate) {
      await tx.allocationAttempt.create({
        data: {
          companyId,
          orderId: order.id,
          locationId: location.id,
          status: AllocationAttemptStatus.failed,
          reason: allocation.reason,
        },
      });
      continue;
    }

    const attempt = await tx.allocationAttempt.create({
      data: {
        companyId,
        orderId: order.id,
        locationId: location.id,
        status: AllocationAttemptStatus.success,
        score: 100,
      },
    });

    for (const item of order.items) {
      const qty = Number(item.quantity);

      await tx.inventoryBalance.update({
        where: {
          companyId_locationId_skuId: {
            companyId,
            locationId: location.id,
            skuId: item.skuId,
          },
        },
        data: {
          reserved: {
            increment: quantity(qty),
          },
        },
      });

      await tx.inventoryReservation.create({
        data: {
          companyId,
          orderId: order.id,
          orderItemId: item.id,
          locationId: location.id,
          skuId: item.skuId,
          quantity: quantity(qty),
        },
      });

      await tx.allocationLine.create({
        data: {
          companyId,
          allocationAttemptId: attempt.id,
          orderItemId: item.id,
          locationId: location.id,
          skuId: item.skuId,
          quantity: quantity(qty),
        },
      });

      await tx.inventoryMovement.create({
        data: {
          companyId,
          locationId: location.id,
          skuId: item.skuId,
          orderId: order.id,
          type: InventoryMovementType.reservation,
          quantity: quantity(qty),
          reason: "Reserved for order",
          referenceId: attempt.id,
        },
      });
    }

    await tx.order.update({
      where: { id: order.id, companyId },
      data: {
        allocationStatus: AllocationStatus.allocated,
        fulfillmentStatus: FulfillmentStatus.ready_to_pack,
        deliveryStatus: DeliveryStatus.pending_quote,
      },
    });

    return {
      orderId: order.id,
      status: AllocationStatus.allocated,
    };
  }

  await tx.allocationAttempt.create({
    data: {
      companyId,
      orderId: order.id,
      status: AllocationAttemptStatus.failed,
      reason: "No active location has enough available stock for every item",
    },
  });

  await tx.order.update({
    where: { id: order.id, companyId },
    data: {
      allocationStatus: AllocationStatus.failed,
      fulfillmentStatus: FulfillmentStatus.production_required,
    },
  });

  return {
    orderId: order.id,
    status: AllocationStatus.failed,
  };
}

async function releaseOrderAllocationInTransaction(
  tx: TransactionClient,
  companyId: string,
  orderId: string,
) {
  const reservations = await tx.inventoryReservation.findMany({
    where: {
      companyId,
      orderId,
      status: AllocationLineStatus.reserved,
    },
  });

  for (const reservation of reservations) {
    const qty = Number(reservation.quantity);

    await tx.inventoryBalance.update({
      where: {
        companyId_locationId_skuId: {
          companyId,
          locationId: reservation.locationId,
          skuId: reservation.skuId,
        },
      },
      data: {
        reserved: {
          decrement: quantity(qty),
        },
      },
    });

    await tx.inventoryReservation.update({
      where: { id: reservation.id },
      data: {
        status: AllocationLineStatus.released,
        releasedAt: new Date(),
      },
    });

    await tx.inventoryMovement.create({
      data: {
        companyId,
        locationId: reservation.locationId,
        skuId: reservation.skuId,
        orderId,
        type: InventoryMovementType.release,
        quantity: quantity(qty),
        reason: "Released order reservation",
        referenceId: reservation.id,
      },
    });
  }

  await tx.allocationLine.updateMany({
    where: {
      companyId,
      orderItem: {
        orderId,
      },
      status: AllocationLineStatus.reserved,
    },
    data: {
      status: AllocationLineStatus.released,
    },
  });
}

async function canAllocateFromLocation(
  tx: TransactionClient,
  companyId: string,
  locationId: string,
  items: NonNullable<OrderWithItems>["items"],
) {
  const skuIds = items.map((item) => item.skuId);
  const balances = await tx.inventoryBalance.findMany({
    where: {
      companyId,
      locationId,
      skuId: {
        in: skuIds,
      },
    },
  });

  for (const item of items) {
    const balance = balances.find((row) => row.skuId === item.skuId);

    if (!balance) {
      return {
        canAllocate: false,
        reason: `Missing stock balance for SKU ${item.skuId}`,
      };
    }

    const available = Number(balance.onHand) - Number(balance.reserved);
    const needed = Number(item.quantity);

    if (available < needed) {
      return {
        canAllocate: false,
        reason: `Insufficient stock for SKU ${item.skuId}`,
      };
    }
  }

  return {
    canAllocate: true,
    reason: null,
  };
}

async function getOrderForAllocation(
  tx: TransactionClient,
  companyId: string,
  orderId: string,
) {
  return tx.order.findFirstOrThrow({
    where: {
      id: orderId,
      companyId,
    },
    include: {
      items: true,
    },
  });
}

type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];
