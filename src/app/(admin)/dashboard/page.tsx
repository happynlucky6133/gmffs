import Link from "next/link";
import type { ReactNode } from "react";
import { getActiveCompany } from "@/lib/company";
import { getAdminDashboard } from "@/services/admin-queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const company = await getActiveCompany();
  const dashboard = await getAdminDashboard(company.id);

  const metrics = [
    {
      label: "Orders Today",
      value: dashboard.ordersToday.toString(),
      href: "/orders",
    },
    {
      label: "Pending Payments",
      value: dashboard.pendingPaymentOrders.toString(),
      detail: `RM ${dashboard.pendingPaymentTotal}`,
      href: "/payments",
    },
    {
      label: "Need Production",
      value: dashboard.allocationFailedOrders.toString(),
      href: "/production",
    },
    {
      label: "Active Deliveries",
      value: dashboard.activeDeliveries.toString(),
      href: "/deliveries",
    },
  ];

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Operational snapshot for {company.name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300"
          >
            <p className="text-sm font-medium text-slate-500">
              {metric.label}
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {metric.value}
            </p>
            {metric.detail ? (
              <p className="mt-2 text-sm text-slate-600">{metric.detail}</p>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <QueuePanel title="Payment Queue" href="/payments">
          {dashboard.paymentQueue.length === 0 ? (
            <EmptyQueue />
          ) : (
            dashboard.paymentQueue.map((order) => (
              <QueueRow
                key={order.id}
                href={`/orders/${order.id}`}
                title={order.orderNumber}
                meta={`${order.customerName} / RM ${order.total}`}
                status={order.paymentStatus}
              />
            ))
          )}
        </QueuePanel>

        <QueuePanel title="Production Queue" href="/production">
          {dashboard.productionQueue.length === 0 ? (
            <EmptyQueue />
          ) : (
            dashboard.productionQueue.map((order) => (
              <QueueRow
                key={order.id}
                href={`/orders/${order.id}`}
                title={order.orderNumber}
                meta={`${order.customerName} / ${order.fulfillmentStatus}`}
                status={order.allocationStatus}
              />
            ))
          )}
        </QueuePanel>

        <QueuePanel title="Delivery Queue" href="/deliveries">
          {dashboard.deliveryQueue.length === 0 ? (
            <EmptyQueue />
          ) : (
            dashboard.deliveryQueue.map((delivery) => (
              <QueueRow
                key={delivery.id}
                href={`/orders/${delivery.orderId}`}
                title={delivery.orderNumber}
                meta={`${delivery.customerName} / ${
                  delivery.scheduledAt?.toLocaleString() ?? "unscheduled"
                }`}
                status={delivery.status}
              />
            ))
          )}
        </QueuePanel>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold">Recent Orders</h2>
          <Link href="/orders" className="text-sm font-medium text-blue-600">
            View all
          </Link>
        </div>
        {dashboard.recentOrders.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-600">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 font-medium">Allocation</th>
                  <th className="px-5 py-3 font-medium">Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dashboard.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-blue-600"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{order.customerName}</td>
                    <td className="px-5 py-3">RM {order.total}</td>
                    <td className="px-5 py-3">{order.paymentStatus}</td>
                    <td className="px-5 py-3">{order.allocationStatus}</td>
                    <td className="px-5 py-3">{order.deliveryStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Production Load</h2>
        <p className="mt-3 text-3xl font-semibold text-slate-950">
          {dashboard.openProductionTasks}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Open production tasks across pending and in-progress work.
        </p>
      </div>
    </section>
  );
}

function QueuePanel({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-sm font-medium text-blue-600">
          Open
        </Link>
      </div>
      <div className="divide-y divide-slate-200">{children}</div>
    </div>
  );
}

function QueueRow({
  href,
  title,
  meta,
  status,
}: {
  href: string;
  title: string;
  meta: string;
  status: string;
}) {
  return (
    <Link
      href={href}
      className="block px-5 py-4 transition-colors hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-slate-950">{title}</p>
          <p className="mt-1 text-sm text-slate-600">{meta}</p>
        </div>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          {status}
        </span>
      </div>
    </Link>
  );
}

function EmptyQueue() {
  return <p className="px-5 py-4 text-sm text-slate-600">Nothing pending.</p>;
}
