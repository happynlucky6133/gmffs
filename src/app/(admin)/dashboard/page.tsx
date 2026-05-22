import Link from "next/link";
import type { ReactNode } from "react";
import {
  AllocationStatus,
  DeliveryStatus,
  PaymentStatus,
  ProductionTaskStatus,
} from "@/generated/prisma/client";
import { getActiveCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const company = await getActiveCompany();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    ordersToday,
    pendingPaymentOrders,
    pendingPaymentTotal,
    allocationFailedOrders,
    openProductionTasks,
    activeDeliveries,
    recentOrders,
    paymentQueue,
    productionQueue,
    deliveryQueue,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        companyId: company.id,
        createdAt: {
          gte: today,
        },
      },
    }),
    prisma.order.count({
      where: {
        companyId: company.id,
        paymentStatus: PaymentStatus.awaiting_confirmation,
      },
    }),
    prisma.order.aggregate({
      where: {
        companyId: company.id,
        paymentStatus: PaymentStatus.awaiting_confirmation,
      },
      _sum: {
        total: true,
      },
    }),
    prisma.order.count({
      where: {
        companyId: company.id,
        allocationStatus: AllocationStatus.failed,
      },
    }),
    prisma.productionTask.count({
      where: {
        companyId: company.id,
        status: {
          in: [ProductionTaskStatus.pending, ProductionTaskStatus.in_progress],
        },
      },
    }),
    prisma.delivery.count({
      where: {
        companyId: company.id,
        status: {
          in: [DeliveryStatus.booked, DeliveryStatus.picked_up],
        },
      },
    }),
    prisma.order.findMany({
      where: { companyId: company.id },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.order.findMany({
      where: {
        companyId: company.id,
        paymentStatus: PaymentStatus.awaiting_confirmation,
      },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.order.findMany({
      where: {
        companyId: company.id,
        allocationStatus: AllocationStatus.failed,
      },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.delivery.findMany({
      where: {
        companyId: company.id,
        status: {
          in: [
            DeliveryStatus.pending_quote,
            DeliveryStatus.quoted,
            DeliveryStatus.booked,
            DeliveryStatus.picked_up,
          ],
        },
      },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
  ]);

  const metrics = [
    {
      label: "Orders Today",
      value: ordersToday.toString(),
      href: "/orders",
    },
    {
      label: "Pending Payments",
      value: pendingPaymentOrders.toString(),
      detail: `RM ${pendingPaymentTotal._sum.total?.toString() ?? "0.00"}`,
      href: "/payments",
    },
    {
      label: "Need Production",
      value: allocationFailedOrders.toString(),
      href: "/production",
    },
    {
      label: "Active Deliveries",
      value: activeDeliveries.toString(),
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
          {paymentQueue.length === 0 ? (
            <EmptyQueue />
          ) : (
            paymentQueue.map((order) => (
              <QueueRow
                key={order.id}
                href={`/orders/${order.id}`}
                title={order.orderNumber}
                meta={`${order.customer.name} / RM ${order.total.toString()}`}
                status={order.paymentStatus}
              />
            ))
          )}
        </QueuePanel>

        <QueuePanel title="Production Queue" href="/production">
          {productionQueue.length === 0 ? (
            <EmptyQueue />
          ) : (
            productionQueue.map((order) => (
              <QueueRow
                key={order.id}
                href={`/orders/${order.id}`}
                title={order.orderNumber}
                meta={`${order.customer.name} / ${order.fulfillmentStatus}`}
                status={order.allocationStatus}
              />
            ))
          )}
        </QueuePanel>

        <QueuePanel title="Delivery Queue" href="/deliveries">
          {deliveryQueue.length === 0 ? (
            <EmptyQueue />
          ) : (
            deliveryQueue.map((delivery) => (
              <QueueRow
                key={delivery.id}
                href={`/orders/${delivery.orderId}`}
                title={delivery.order.orderNumber}
                meta={`${delivery.order.customer.name} / ${
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
        {recentOrders.length === 0 ? (
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
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-blue-600"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{order.customer.name}</td>
                    <td className="px-5 py-3">RM {order.total.toString()}</td>
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
          {openProductionTasks}
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
