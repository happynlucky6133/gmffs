import { notFound } from "next/navigation";
import { submitCustomerOrder } from "./actions";
import { CompanyStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CustomerOrderPageProps = {
  params: Promise<{
    companySlug: string;
  }>;
};

export default async function CustomerOrderPage({
  params,
}: CustomerOrderPageProps) {
  const { companySlug } = await params;
  const company = await prisma.company.findFirst({
    where: {
      slug: companySlug,
      status: CompanyStatus.active,
    },
    include: {
      products: {
        where: { isActive: true },
        include: {
          skus: {
            where: { isActive: true },
            orderBy: { code: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!company) {
    notFound();
  }

  const skus = company.products.flatMap((product) =>
    product.skus.map((sku) => ({
      ...sku,
      productName: product.name,
      productDescription: product.description,
    })),
  );
  const submitOrder = submitCustomerOrder.bind(null, company.slug);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-600">
          FreshStack Ordering
        </p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              {company.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Place your order and submit Touch & Go or bank transfer details
              after checkout.
            </p>
          </div>
          <a
            href={`/${company.slug}/track`}
            className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Track Order
          </a>
        </div>
      </header>

      <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {company.products.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              No products are available right now.
            </div>
          ) : (
            company.products.map((product) => (
              <div
                key={product.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {product.name}
                  </h2>
                  {product.description ? (
                    <p className="text-sm text-slate-600">
                      {product.description}
                    </p>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {product.skus.map((sku) => (
                    <div
                      key={sku.id}
                      className="rounded-md border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="font-medium text-slate-950">{sku.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {sku.code} / {sku.unit}
                      </p>
                      <p className="mt-3 text-lg font-semibold text-slate-950">
                        RM {sku.price.toString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <form
          action={submitOrder}
          className="h-fit space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-950">Order Now</h2>
          <label className="block text-sm font-medium text-slate-700">
            Item
            <select
              name="skuId"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select item</option>
              {skus.map((sku) => (
                <option key={sku.id} value={sku.id}>
                  {sku.productName} / {sku.name} / RM {sku.price.toString()}
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
              defaultValue="1"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              name="customerName"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Phone
            <input
              name="customerPhone"
              required
              inputMode="tel"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              name="customerEmail"
              type="email"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Delivery Address
            <textarea
              name="deliveryAddress"
              required
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Requested Time
            <input
              name="requestedTimeSlot"
              placeholder="Today 2-4pm"
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
          <button className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white">
            Submit Order
          </button>
          <p className="text-xs leading-5 text-slate-500">
            Your order will be reviewed by the team before fulfillment starts.
          </p>
        </form>
      </div>
    </section>
  );
}
