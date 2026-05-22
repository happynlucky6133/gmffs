import {
  cancelTask,
  completeTask,
  createManualTask,
  createTasksForOrder,
  startTask,
} from "./actions";
import { AllocationStatus, ProductionTaskStatus } from "@/generated/prisma/client";
import { getActiveCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const company = await getActiveCompany();
  const [ordersNeedingProduction, tasks, locations, skus] = await Promise.all([
    prisma.order.findMany({
      where: {
        companyId: company.id,
        allocationStatus: AllocationStatus.failed,
      },
      include: {
        customer: true,
        items: {
          include: {
            sku: true,
          },
        },
        productionTasks: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.productionTask.findMany({
      where: { companyId: company.id },
      include: {
        location: true,
        sku: {
          include: {
            product: true,
          },
        },
        order: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
    }),
    prisma.inventoryLocation.findMany({
      where: {
        companyId: company.id,
        isActive: true,
      },
      orderBy: { code: "asc" },
    }),
    prisma.sku.findMany({
      where: {
        companyId: company.id,
        isActive: true,
      },
      include: {
        product: true,
      },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Production</h1>
        <p className="mt-2 text-sm text-slate-600">
          Production tasks for replenishing stock and blocked orders.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <StatusCard label="Need Production" value={ordersNeedingProduction.length} />
        <StatusCard
          label="Pending"
          value={
            tasks.filter((task) => task.status === ProductionTaskStatus.pending)
              .length
          }
        />
        <StatusCard
          label="In Progress"
          value={
            tasks.filter(
              (task) => task.status === ProductionTaskStatus.in_progress,
            ).length
          }
        />
        <StatusCard
          label="Completed"
          value={
            tasks.filter((task) => task.status === ProductionTaskStatus.completed)
              .length
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,360px)_1fr]">
        <form
          action={createManualTask}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold">Manual Task</h2>
          <label className="block text-sm font-medium text-slate-700">
            Location
            <select
              name="locationId"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} / {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            SKU
            <select
              name="skuId"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select SKU</option>
              {skus.map((sku) => (
                <option key={sku.id} value={sku.id}>
                  {sku.code} / {sku.product.name} / {sku.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Quantity
            <input
              name="quantity"
              required
              type="number"
              min="0.001"
              step="0.001"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Notes
            <textarea
              name="notes"
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Add Task
          </button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">Orders Needing Production</h2>
          </div>
          {ordersNeedingProduction.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-600">
              No blocked orders right now.
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {ordersNeedingProduction.map((order) => {
                const hasOpenTask = order.productionTasks.some(
                  (task) =>
                    task.status === ProductionTaskStatus.pending ||
                    task.status === ProductionTaskStatus.in_progress,
                );

                return (
                  <form
                    key={order.id}
                    action={createTasksForOrder}
                    className="grid gap-3 p-5 lg:grid-cols-[1fr_220px_1.5fr_auto]"
                  >
                    <input type="hidden" name="orderId" value={order.id} />
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {order.customer.name} / RM {order.total.toString()}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {order.items
                          .map(
                            (item) =>
                              `${item.sku.code} x ${item.quantity.toString()}`,
                          )
                          .join(", ")}
                      </p>
                    </div>
                    <select
                      name="locationId"
                      required
                      disabled={hasOpenTask}
                      className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    >
                      <option value="">Select location</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.code}
                        </option>
                      ))}
                    </select>
                    <input
                      name="notes"
                      disabled={hasOpenTask}
                      placeholder="Production notes"
                      className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                    <button
                      disabled={hasOpenTask}
                      className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
                    >
                      {hasOpenTask ? "Task Exists" : "Create Tasks"}
                    </button>
                  </form>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Production Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-600">No production tasks yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {task.createdAt.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {task.notes ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {task.order
                        ? `${task.order.orderNumber} / ${task.order.customer.name}`
                        : "Manual"}
                    </td>
                    <td className="px-4 py-3">{task.location.code}</td>
                    <td className="px-4 py-3">
                      {task.sku.code} / {task.sku.name}
                    </td>
                    <td className="px-4 py-3">{task.quantity.toString()}</td>
                    <td className="px-4 py-3">{task.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {task.status === ProductionTaskStatus.pending ? (
                          <TaskButton
                            action={startTask}
                            id={task.id}
                            label="Start"
                            primary
                          />
                        ) : null}
                        {task.status === ProductionTaskStatus.pending ||
                        task.status === ProductionTaskStatus.in_progress ? (
                          <>
                            <TaskButton
                              action={completeTask}
                              id={task.id}
                              label="Complete"
                              primary
                            />
                            <TaskButton
                              action={cancelTask}
                              id={task.id}
                              label="Cancel"
                            />
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function StatusCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function TaskButton({
  action,
  id,
  label,
  primary = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        className={
          primary
            ? "rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white"
            : "rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
        }
      >
        {label}
      </button>
    </form>
  );
}
