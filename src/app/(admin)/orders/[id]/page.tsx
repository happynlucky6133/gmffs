import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelOrder, confirmOrder } from "../actions";
import { getActiveCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type OrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { id } = await params;
  const company = await getActiveCompany();
  const order = await prisma.order.findFirst({
    where: {
      id,
      companyId: company.id,
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
    },
  });

  if (!order) {
    notFound();
  }

  const canConfirm = order.orderStatus === OrderStatus.draft;
  const canCancel = order.orderStatus !== OrderStatus.cancelled;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/orders" className="text-sm font-medium text-blue-600">
            Back to orders
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {order.customer.name} / {order.sourceChannel}
          </p>
        </div>

        <div className="flex gap-2">
          {canConfirm ? (
            <form action={confirmOrder}>
              <input type="hidden" name="id" value={order.id} />
              <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
                Confirm
              </button>
            </form>
          ) : null}
          {canCancel ? (
            <form action={cancelOrder}>
              <input type="hidden" name="id" value={order.id} />
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
                Cancel
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <StatusCard label="Order" value={order.orderStatus} />
        <StatusCard label="Payment" value={order.paymentStatus} />
        <StatusCard label="Allocation" value={order.allocationStatus} />
        <StatusCard label="Fulfillment" value={order.fulfillmentStatus} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">Items</h2>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Unit Price</th>
                <th className="px-5 py-3 font-medium">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-3 font-medium">{item.sku.code}</td>
                  <td className="px-5 py-3">
                    {item.sku.product.name} / {item.sku.name}
                  </td>
                  <td className="px-5 py-3">{item.quantity.toString()}</td>
                  <td className="px-5 py-3">
                    RM {item.unitPrice.toString()}
                  </td>
                  <td className="px-5 py-3">
                    RM {item.lineTotal.toString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Customer</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Name" value={order.customer.name} />
              <Row label="Phone" value={order.customer.phone ?? "-"} />
              <Row label="Email" value={order.customer.email ?? "-"} />
              <Row label="Address" value={order.customer.address ?? "-"} />
            </dl>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Totals</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Subtotal" value={`RM ${order.subtotal.toString()}`} />
              <Row
                label="Delivery"
                value={`RM ${order.deliveryFee.toString()}`}
              />
              <Row label="Total" value={`RM ${order.total.toString()}`} />
            </dl>
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

