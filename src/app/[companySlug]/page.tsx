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
      productImageUrl: product.imageUrl,
    })),
  );
  const submitOrder = submitCustomerOrder.bind(null, company.slug);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white px-4 pb-8 pt-4 sm:max-w-2xl sm:px-6 lg:max-w-5xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            FreshStack Ordering
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            {company.name}
          </h1>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Choose your fruit cup and place the order from your phone.
          </p>
        </div>
        <a
          href={`/${company.slug}/track`}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
        >
          Track
        </a>
      </header>

      <form action={submitOrder} className="mt-5 space-y-5">
        <section>
          <h2 className="text-base font-semibold text-slate-950">
            Pick Your Fruit
          </h2>
          {skus.length === 0 ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No products are available right now.
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {skus.map((sku, index) => (
                <label key={sku.id} className="group block cursor-pointer">
                  <input
                    name="skuId"
                    required
                    type="radio"
                    value={sku.id}
                    defaultChecked={index === 0}
                    className="peer sr-only"
                  />
                  <span className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition peer-checked:border-blue-600 peer-checked:ring-2 peer-checked:ring-blue-600">
                    {sku.productImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sku.productImageUrl}
                        alt={sku.productName}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <span className="aspect-square w-full bg-slate-100" />
                    )}
                    <span className="flex flex-1 flex-col gap-1 p-3">
                      <span className="text-sm font-semibold leading-5 text-slate-950">
                        {sku.productName}
                      </span>
                      <span className="mt-auto text-base font-bold text-blue-700">
                        RM {sku.price.toString()}
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-base font-semibold text-slate-950">
            Order Details
          </h2>
          <label className="block text-sm font-medium text-slate-700">
            Quantity
            <input
              name="quantity"
              required
              type="number"
              min="0.001"
              step="0.001"
              defaultValue="1"
              className="mt-1 h-12 w-full rounded-md border border-slate-300 px-3 text-base"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              name="customerName"
              required
              autoComplete="name"
              className="mt-1 h-12 w-full rounded-md border border-slate-300 px-3 text-base"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Phone
            <input
              name="customerPhone"
              required
              inputMode="tel"
              autoComplete="tel"
              className="mt-1 h-12 w-full rounded-md border border-slate-300 px-3 text-base"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              name="customerEmail"
              type="email"
              autoComplete="email"
              className="mt-1 h-12 w-full rounded-md border border-slate-300 px-3 text-base"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Delivery Address
            <textarea
              name="deliveryAddress"
              required
              rows={3}
              autoComplete="street-address"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Requested Time
            <input
              name="requestedTimeSlot"
              placeholder="Today 2-4pm"
              className="mt-1 h-12 w-full rounded-md border border-slate-300 px-3 text-base"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Notes
            <textarea
              name="notes"
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base"
            />
          </label>
        </section>

        <div>
          <button className="h-12 w-full rounded-md bg-blue-600 px-4 text-base font-semibold text-white shadow-sm">
            Submit Order
          </button>
          <p className="mt-2 text-center text-xs leading-5 text-slate-500">
            Your order will be reviewed by the team before fulfillment starts.
          </p>
        </div>
      </form>
    </section>
  );
}
