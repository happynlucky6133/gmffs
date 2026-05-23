import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type TrackOrderPageProps = {
  params: Promise<{
    companySlug: string;
  }>;
  searchParams: Promise<{
    orderNumber?: string;
    phone?: string;
  }>;
};

export default async function TrackOrderPage({
  params,
  searchParams,
}: TrackOrderPageProps) {
  const { companySlug } = await params;
  const { orderNumber, phone } = await searchParams;
  const company = await prisma.company.findFirst({
    where: {
      slug: companySlug,
      status: CompanyStatus.active,
    },
  });

  if (!company) {
    notFound();
  }

  const cleanOrderNumber = orderNumber?.trim();
  const cleanPhone = phone?.trim();
  const order =
    cleanOrderNumber && cleanPhone
      ? await prisma.order.findFirst({
          where: {
            companyId: company.id,
            orderNumber: cleanOrderNumber,
            customer: {
              phone: cleanPhone,
            },
          },
          include: {
            customer: true,
          },
        })
      : null;

  return (
    <section className="mx-auto min-h-screen w-full max-w-md bg-white px-4 py-4 sm:max-w-2xl sm:px-6">
      <header className="border-b border-slate-200 pb-4">
        <Link
          href={`/${company.slug}`}
          className="text-sm font-medium text-blue-600"
        >
          Back to ordering
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Track Order
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your order number and phone number to check the latest status.
        </p>
      </header>

      <form className="mt-5 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_1fr]">
        <label className="block text-sm font-medium text-slate-700">
          Order Number
          <input
            name="orderNumber"
            defaultValue={cleanOrderNumber ?? ""}
            required
            className="mt-1 h-12 w-full rounded-md border border-slate-300 px-3 text-base"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Phone
          <input
            name="phone"
            defaultValue={cleanPhone ?? ""}
            required
            inputMode="tel"
            autoComplete="tel"
            className="mt-1 h-12 w-full rounded-md border border-slate-300 px-3 text-base"
          />
        </label>
        <button className="h-12 rounded-md bg-blue-600 px-4 text-base font-semibold text-white sm:col-span-2">
          Track
        </button>
      </form>

      {cleanOrderNumber && cleanPhone ? (
        order ? (
          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-slate-500">Order</p>
                <Link
                  href={`/${company.slug}/orders/${order.orderNumber}`}
                  className="mt-1 block text-xl font-semibold text-blue-600"
                >
                  {order.orderNumber}
                </Link>
              </div>
              <p className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                RM {order.total.toString()}
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatusCard label="Order" value={formatStatus(order.orderStatus)} />
              <StatusCard label="Payment" value={formatStatus(order.paymentStatus)} />
              <StatusCard label="Delivery" value={formatStatus(order.deliveryStatus)} />
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            No matching order found. Please check the order number and phone.
          </div>
        )
      ) : null}
    </section>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
