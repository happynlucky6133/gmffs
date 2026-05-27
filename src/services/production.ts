import { randomUUID } from "node:crypto";
import { quantity } from "@/lib/form";
import { withSqlTransaction } from "@/lib/sql";

export async function createProductionTasksForOrder(input: {
  companyId: string;
  orderId: string;
  locationId: string;
  notes?: string | null;
}) {
  return withSqlTransaction(async (client) => {
    const order = await client.query<{ id: string; "companyId": string }>(
      `SELECT id, "companyId" FROM orders WHERE id = $1 AND "companyId" = $2`,
      [input.orderId, input.companyId],
    );
    if (order.rows.length === 0) throw new Error("Order not found");

    const loc = await client.query(
      `SELECT id FROM inventory_locations WHERE id = $1 AND "companyId" = $2 AND "isActive" = true`,
      [input.locationId, input.companyId],
    );
    if (loc.rows.length === 0) throw new Error("Location not found");

    const openCount = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM production_tasks
        WHERE "companyId" = $1 AND "orderId" = $2
          AND status IN ('pending', 'in_progress')`,
      [input.companyId, input.orderId],
    );
    if (Number(openCount.rows[0]?.count ?? 0) > 0) {
      throw new Error("Order already has open production tasks");
    }

    const items = await client.query<{ id: string; "skuId": string; quantity: string }>(
      `SELECT id, "skuId", quantity::text FROM order_items WHERE "orderId" = $1`,
      [input.orderId],
    );

    for (const item of items.rows) {
      await client.query(
        `INSERT INTO production_tasks
          (id, "companyId", "orderId", "orderItemId", "locationId", "skuId",
           quantity, status, notes, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, NOW(), NOW())`,
        [
          randomUUID(),
          input.companyId,
          input.orderId,
          item.id,
          input.locationId,
          item.skuId,
          item.quantity,
          input.notes ?? null,
        ],
      );
    }

    return order.rows[0];
  });
}

export async function createManualProductionTask(input: {
  companyId: string;
  locationId: string;
  skuId: string;
  taskQuantity: number;
  notes?: string | null;
}) {
  return withSqlTransaction(async (client) => {
    const result = await client.query<{
      id: string; quantity: string; status: string; notes: string | null;
      "createdAt": Date; "updatedAt": Date; "companyId": string;
      "locationId": string; "skuId": string; "orderId": string | null; "orderItemId": string | null;
    }>(
      `INSERT INTO production_tasks
        (id, "companyId", "locationId", "skuId", quantity, status, notes, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW(), NOW())
       RETURNING *`,
      [
        randomUUID(),
        input.companyId,
        input.locationId,
        input.skuId,
        quantity(input.taskQuantity),
        input.notes ?? null,
      ],
    );
    return result.rows[0];
  });
}

export async function startProductionTask(companyId: string, taskId: string) {
  await withSqlTransaction(async (client) => {
    const task = await client.query(
      `SELECT id FROM production_tasks WHERE id = $1 AND "companyId" = $2 AND status = 'pending'`,
      [taskId, companyId],
    );
    if (task.rows.length === 0) throw new Error("Task not found or not pending");

    await client.query(
      `UPDATE production_tasks SET status = 'in_progress', "startedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = $1 AND "companyId" = $2`,
      [taskId, companyId],
    );
  });
}

export async function cancelProductionTask(companyId: string, taskId: string) {
  await withSqlTransaction(async (client) => {
    const task = await client.query(
      `SELECT id FROM production_tasks WHERE id = $1 AND "companyId" = $2
        AND status IN ('pending', 'in_progress')`,
      [taskId, companyId],
    );
    if (task.rows.length === 0) throw new Error("Task not found or cannot be cancelled");

    await client.query(
      `UPDATE production_tasks SET status = 'cancelled', "updatedAt" = NOW()
        WHERE id = $1 AND "companyId" = $2`,
      [taskId, companyId],
    );
  });
}

export async function completeProductionTask(companyId: string, taskId: string) {
  return withSqlTransaction(async (client) => {
    const taskRows = await client.query<{
      id: string; "orderId": string | null; "locationId": string;
      "skuId": string; quantity: string;
    }>(
      `SELECT id, "orderId", "locationId", "skuId", quantity::text
         FROM production_tasks
        WHERE id = $1 AND "companyId" = $2
          AND status IN ('pending', 'in_progress')`,
      [taskId, companyId],
    );
    const task = taskRows.rows[0];
    if (!task) throw new Error("Task not found or not active");

    await client.query(
      `UPDATE production_tasks SET status = 'completed', "completedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = $1 AND "companyId" = $2`,
      [taskId, companyId],
    );

    await client.query(
      `INSERT INTO inventory_balances
        (id, "companyId", "locationId", "skuId", "onHand", reserved, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())
       ON CONFLICT ("companyId", "locationId", "skuId")
       DO UPDATE SET "onHand" = inventory_balances."onHand" + $5, "updatedAt" = NOW()`,
      [randomUUID(), companyId, task.locationId, task.skuId, task.quantity],
    );

    await client.query(
      `INSERT INTO inventory_movements
        (id, "companyId", "locationId", "skuId", "orderId", type, quantity, reason, "referenceId", "createdAt")
       VALUES ($1, $2, $3, $4, $5, 'production_output', $6, 'Production completed', $7, NOW())`,
      [randomUUID(), companyId, task.locationId, task.skuId, task.orderId, task.quantity, taskId],
    );

    if (task.orderId) {
      const remaining = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM production_tasks
          WHERE "companyId" = $1 AND "orderId" = $2
            AND status IN ('pending', 'in_progress')`,
        [companyId, task.orderId],
      );

      if (Number(remaining.rows[0]?.count ?? 0) === 0) {
        // Release old reservations and mark order ready for re-allocation
        await client.query(
          `UPDATE inventory_reservations
              SET status = 'released', "releasedAt" = NOW()
            WHERE "companyId" = $1 AND "orderId" = $2 AND status = 'reserved'`,
          [companyId, task.orderId],
        );

        const releasedResult = await client.query<{ "locationId": string; "skuId": string; quantity: string }>(
          `SELECT "locationId", "skuId", quantity::text
             FROM inventory_reservations
            WHERE "companyId" = $1 AND "orderId" = $2 AND status = 'released'`,
          [companyId, task.orderId],
        );
        for (const res of releasedResult.rows) {
          await client.query(
            `UPDATE inventory_balances
                SET reserved = reserved - $1, "updatedAt" = NOW()
              WHERE "companyId" = $2 AND "locationId" = $3 AND "skuId" = $4`,
            [res.quantity, companyId, res.locationId, res.skuId],
          );
        }

        await client.query(
          `UPDATE orders SET "allocationStatus" = 'retry', "updatedAt" = NOW()
            WHERE id = $1 AND "companyId" = $2`,
          [task.orderId, companyId],
        );
      }
    }

    return taskRows.rows[0];
  });
}
