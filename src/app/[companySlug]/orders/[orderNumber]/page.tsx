import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CustomerOrderStatusPageProps = {
  params: Promise<{
    companySlug: string;
    orderNumber: string;
  }>;
};

export default async function CustomerOrderStatusPage({
  params,
}: CustomerOrderStatusPageProps) {
  const { companySlug, orderNumber } = await params;
  const company = await prisma.company.findFirst({
    where: {
      slug: companySlug,
      status: CompanyStatus.active,
    },
  });

  if (!company) {
    notFound();
  }

  const order = await prisma.order.findFirst({
    where: {
      companyId: company.id,
      orderNumber,
    },
    include: {
      customer: true,
      items: {
        include: {
          sku: {
            include: {
              product: true,
            },
          },
        },
      },
      payments: {
        include: {
          paymentMethod: true,
        },
        orderBy: { createdAt: "desc" },
      },
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!order) {
    notFound();
  }

  const paymentMethods = await prisma.paymentMethod.findMany({
    where: {
      companyId: company.id,
      enabled: true,
    },
    orderBy: { name: "asc" },
  });
  const latestDelivery = order.deliveries[0];

  return (
    <section className="mx-auto min-h-screen w-full max-w-md bg-white px-4 py-4 sm:max-w-2xl sm:px-6 lg:max-w-4xl">
      <header className="border-b border-slate-200 pb-4">
        <Link
          href={`/${company.slug}`}
          className="text-sm font-medium text-blue-600"
        >
          Back to ordering
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Order {order.orderNumber}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Thank you, {order.customer.name}. Your order has been submitted.
        </p>
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatusCard label="Order" value={formatStatus(order.orderStatus)} />
        <StatusCard label="Payment" value={formatStatus(order.paymentStatus)} />
        <StatusCard label="Delivery" value={formatStatus(order.deliveryStatus)} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-950">Items</h2>
            </div>
            <div className="divide-y divide-slate-200">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-medium text-slate-950">
                      {item.sku.product.name} / {item.sku.name}
                    </p>
                    <p className="mt-1 text-slate-500">{item.sku.code}</p>
                  </div>
                  <div className="md:text-right">
                    <p>
                      {item.quantity.toString()} x RM{" "}
                      {item.unitPrice.toString()}
                    </p>
                    <p className="mt-1 font-medium">
                      RM {item.lineTotal.toString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-semibold text-slate-950">Payment</h2>
            <p className="mt-2 text-sm text-slate-600">
              Please pay with Touch & Go or bank transfer, then keep your
              screenshot for confirmation.
            </p>
            <div className="mt-4 space-y-3">
              {paymentMethods.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Payment instructions are not available yet.
                </p>
              ) : (
                paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="rounded-md border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="font-medium text-slate-950">{method.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {method.type}
                    </p>
                    {method.settings ? (
                      <pre className="mt-3 whitespace-pre-wrap rounded-md bg-white p-3 text-xs text-slate-600">
                        {JSON.stringify(method.settings, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-semibold text-slate-950">Delivery Tracking</h2>
            <p className="mt-2 text-sm text-slate-600">
              Delivery tracking will appear here after the team arranges
              delivery.
            </p>
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-950">
                {latestDelivery ? formatStatus(latestDelivery.status) : "Preparing"}
              </p>
              <p className="mt-1 text-slate-600">
                Lalamove driver and live delivery status will be shown here
                when external delivery integration is enabled.
              </p>
              {latestDelivery?.trackingNumber ? (
                <p className="mt-2 text-slate-600">
                  Tracking: {latestDelivery.trackingNumber}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-semibold text-slate-950">Total</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Subtotal" value={`RM ${order.subtotal.toString()}`} />
              <Row
                label="Delivery"
                value={`RM ${order.deliveryFee.toString()}`}
              />
              <Row label="Total" value={`RM ${order.total.toString()}`} />
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-semibold text-slate-950">Customer</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Name" value={order.customer.name} />
              <Row label="Phone" value={order.customer.phone ?? "-"} />
              <Row label="Email" value={order.customer.email ?? "-"} />
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-semibold text-slate-950">Address</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {order.deliveryAddress}
            </p>
            {order.requestedTimeSlot ? (
              <p className="mt-3 text-sm text-slate-600">
                Requested: {order.requestedTimeSlot}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
