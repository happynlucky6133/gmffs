import {
  cancelTask,
  completeTask,
  createManualTask,
  createTasksForOrder,
  startTask,
} from "./actions";
import { getActiveCompany } from "@/lib/company";
import { sqlQuery } from "@/lib/sql";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  "orderNumber": string;
  "customerName": string;
  total: string;
  items: unknown;
  "hasOpenTask": boolean;
};

type TaskRow = {
  id: string;
  quantity: string;
  status: string;
  notes: string | null;
  "createdAt": Date;
  "locationCode": string;
  "skuCode": string;
  "skuName": string;
  "orderNumber": string | null;
  "orderCustomerName": string | null;
};

type LocationRow = { id: string; code: string; name: string };
type SkuRow = { id: string; code: string; name: string; "productName": string };

export default async function ProductionPage() {
  const company = await getActiveCompany();

  const [orders, tasks, locations, skus] = await Promise.all([
    sqlQuery<OrderRow>(
      `SELECT o.id, o."orderNumber", c.name AS "customerName",
              o.total::text,
              COALESCE(
                json_agg(json_build_object('skuCode', s.code, 'quantity', oi.quantity::text)
                  ORDER BY oi."createdAt")
                  FILTER (WHERE oi.id IS NOT NULL),
                '[]'::json
              ) AS items,
              EXISTS (
                SELECT 1 FROM production_tasks pt
                WHERE pt."orderId" = o.id
                  AND pt.status IN ('pending', 'in_progress')
              ) AS "hasOpenTask"
         FROM orders o
         JOIN customers c ON c.id = o."customerId"
         LEFT JOIN order_items oi ON oi."orderId" = o.id
         LEFT JOIN skus s ON s.id = oi."skuId"
        WHERE o."companyId" = $1
          AND o."allocationStatus" = 'failed'
        GROUP BY o.id, c.name
        ORDER BY o."createdAt" ASC`,
      [company.id],
    ),
    sqlQuery<TaskRow>(
      `SELECT pt.id, pt.quantity::text, pt.status, pt.notes, pt."createdAt",
              l.code AS "locationCode",
              s.code AS "skuCode", s.name AS "skuName",
              o."orderNumber" AS "orderNumber",
              c.name AS "orderCustomerName"
         FROM production_tasks pt
         JOIN inventory_locations l ON l.id = pt."locationId"
         JOIN skus s ON s.id = pt."skuId"
         LEFT JOIN orders o ON o.id = pt."orderId"
         LEFT JOIN customers c ON c.id = o."customerId"
        WHERE pt."companyId" = $1
        ORDER BY
          CASE pt.status
            WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2
            WHEN 'completed' THEN 3 WHEN 'cancelled' THEN 4
          END,
          pt."createdAt" DESC`,
      [company.id],
    ),
    sqlQuery<LocationRow>(
      `SELECT id, code, name FROM inventory_locations
        WHERE "companyId" = $1 AND "isActive" = true
        ORDER BY code ASC`,
      [company.id],
    ),
    sqlQuery<SkuRow>(
      `SELECT s.id, s.code, s.name, p.name AS "productName"
         FROM skus s JOIN products p ON p.id = s."productId"
        WHERE s."companyId" = $1 AND s."isActive" = true
        ORDER BY s.code ASC`,
      [company.id],
    ),
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
        <StatusCard label="Need Production" value={orders.rows.length} />
        <StatusCard label="Pending" value={tasks.rows.filter((t) => t.status === "pending").length} />
        <StatusCard label="In Progress" value={tasks.rows.filter((t) => t.status === "in_progress").length} />
        <StatusCard label="Completed" value={tasks.rows.filter((t) => t.status === "completed").length} />
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
              {locations.rows.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} / {l.name}
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
              {skus.rows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} / {s.productName} / {s.name}
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
          {orders.rows.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-600">
              No blocked orders right now.
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {orders.rows.map((order) => {
                type ItemInfo = { skuCode: string; quantity: string };
                const items: ItemInfo[] = Array.isArray(order.items) ? order.items : [];
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
                        {order.customerName} / RM {order.total}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {items.map((i) => `${i.skuCode} x ${i.quantity}`).join(", ")}
                      </p>
                    </div>
                    <select
                      name="locationId"
                      required
                      disabled={order.hasOpenTask}
                      className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    >
                      <option value="">Select location</option>
                      {locations.rows.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code}
                        </option>
                      ))}
                    </select>
                    <input
                      name="notes"
                      disabled={order.hasOpenTask}
                      placeholder="Production notes"
                      className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                    <button
                      disabled={order.hasOpenTask}
                      className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
                    >
                      {order.hasOpenTask ? "Task Exists" : "Create Tasks"}
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
        {tasks.rows.length === 0 ? (
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
                {tasks.rows.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{t.createdAt.toLocaleString()}</p>
                      <p className="mt-1 text-xs text-slate-500">{t.notes ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {t.orderNumber ? `${t.orderNumber} / ${t.orderCustomerName}` : "Manual"}
                    </td>
                    <td className="px-4 py-3">{t.locationCode}</td>
                    <td className="px-4 py-3">{t.skuCode} / {t.skuName}</td>
                    <td className="px-4 py-3">{t.quantity}</td>
                    <td className="px-4 py-3">{t.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {t.status === "pending" ? (
                          <TaskButton action={startTask} id={t.id} label="Start" primary />
                        ) : null}
                        {t.status === "pending" || t.status === "in_progress" ? (
                          <>
                            <TaskButton action={completeTask} id={t.id} label="Complete" primary />
                            <TaskButton action={cancelTask} id={t.id} label="Cancel" />
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
