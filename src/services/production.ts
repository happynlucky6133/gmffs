import {
  InventoryMovementType,
  ProductionTaskStatus,
} from "@/generated/prisma/client";
import { quantity } from "@/lib/form";
import { prisma } from "@/lib/prisma";
import { retryOrderAllocation } from "@/services/inventory";

export async function createProductionTasksForOrder(input: {
  companyId: string;
  orderId: string;
  locationId: string;
  notes?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirstOrThrow({
      where: {
        id: input.orderId,
        companyId: input.companyId,
      },
      include: {
        items: true,
      },
    });

    await tx.inventoryLocation.findFirstOrThrow({
      where: {
        id: input.locationId,
        companyId: input.companyId,
        isActive: true,
      },
    });

    const openTaskCount = await tx.productionTask.count({
      where: {
        companyId: input.companyId,
        orderId: order.id,
        status: {
          in: [ProductionTaskStatus.pending, ProductionTaskStatus.in_progress],
        },
      },
    });

    if (openTaskCount > 0) {
      throw new Error("Order already has open production tasks");
    }

    for (const item of order.items) {
      await tx.productionTask.create({
        data: {
          companyId: input.companyId,
          orderId: order.id,
          orderItemId: item.id,
          locationId: input.locationId,
          skuId: item.skuId,
          quantity: item.quantity,
          notes: input.notes,
        },
      });
    }

    return order;
  });
}

export async function createManualProductionTask(input: {
  companyId: string;
  locationId: string;
  skuId: string;
  taskQuantity: number;
  notes?: string | null;
}) {
  return prisma.productionTask.create({
    data: {
      companyId: input.companyId,
      locationId: input.locationId,
      skuId: input.skuId,
      quantity: quantity(input.taskQuantity),
      notes: input.notes,
    },
  });
}

export async function startProductionTask(companyId: string, taskId: string) {
  await prisma.productionTask.findFirstOrThrow({
    where: {
      id: taskId,
      companyId,
      status: ProductionTaskStatus.pending,
    },
  });

  await prisma.productionTask.update({
    where: {
      id: taskId,
      companyId,
    },
    data: {
      status: ProductionTaskStatus.in_progress,
      startedAt: new Date(),
    },
  });
}

export async function cancelProductionTask(companyId: string, taskId: string) {
  await prisma.productionTask.findFirstOrThrow({
    where: {
      id: taskId,
      companyId,
      status: {
        in: [ProductionTaskStatus.pending, ProductionTaskStatus.in_progress],
      },
    },
  });

  await prisma.productionTask.update({
    where: {
      id: taskId,
      companyId,
    },
    data: {
      status: ProductionTaskStatus.cancelled,
    },
  });
}

export async function completeProductionTask(
  companyId: string,
  taskId: string,
) {
  const task = await prisma.$transaction(async (tx) => {
    await tx.productionTask.findFirstOrThrow({
      where: {
        id: taskId,
        companyId,
        status: {
          in: [ProductionTaskStatus.pending, ProductionTaskStatus.in_progress],
        },
      },
    });

    const savedTask = await tx.productionTask.update({
      where: {
        id: taskId,
        companyId,
      },
      data: {
        status: ProductionTaskStatus.completed,
        completedAt: new Date(),
      },
    });

    await tx.inventoryBalance.upsert({
      where: {
        companyId_locationId_skuId: {
          companyId,
          locationId: savedTask.locationId,
          skuId: savedTask.skuId,
        },
      },
      update: {
        onHand: {
          increment: savedTask.quantity,
        },
      },
      create: {
        companyId,
        locationId: savedTask.locationId,
        skuId: savedTask.skuId,
        onHand: savedTask.quantity,
      },
    });

    await tx.inventoryMovement.create({
      data: {
        companyId,
        locationId: savedTask.locationId,
        skuId: savedTask.skuId,
        orderId: savedTask.orderId,
        type: InventoryMovementType.production_output,
        quantity: savedTask.quantity,
        reason: "Production completed",
        referenceId: savedTask.id,
      },
    });

    return savedTask;
  });

  if (task.orderId) {
    const remainingTasks = await prisma.productionTask.count({
      where: {
        companyId,
        orderId: task.orderId,
        status: {
          in: [ProductionTaskStatus.pending, ProductionTaskStatus.in_progress],
        },
      },
    });

    if (remainingTasks === 0) {
      await retryOrderAllocation(companyId, task.orderId);
    }
  }

  return task;
}
