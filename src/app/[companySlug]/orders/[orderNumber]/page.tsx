import Link from "next/link";
import { notFound } from "next/navigation";
import { submitPaymentProof } from "./actions";
import { sqlQuery } from "@/lib/sql";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  "orderNumber": string;
  "orderStatus": string;
  "paymentStatus": string;
  "deliveryStatus": string;
  subtotal: string;
  "deliveryFee": string;
  total: string;
  "deliveryAddress": string;
  "requestedTimeSlot": string | null;
  "customerName": string;
  "customerPhone": string | null;
  "customerEmail": string | null;
};

type ItemRow = {
  id: string;
  "skuCode": string;
  "skuName": string;
  "productName": string;
  quantity: string;
  "unitPrice": string;
  "lineTotal": string;
};

type PaymentRow = {
  id: string;
  status: string;
  "proofUrl": string | null;
  "referenceNumber": string | null;
  "methodName": string;
  "methodType": string;
};

type DeliveryRow = {
  id: string;
  status: string;
  "trackingNumber": string | null;
};

type PaymentMethodRow = {
  id: string;
  name: string;
  type: string;
  settings: unknown;
};

type CustomerOrderStatusPageProps = {
  params: Promise<{ companySlug: string; orderNumber: string }>;
};

export default async function CustomerOrderStatusPage({ params }: CustomerOrderStatusPageProps) {
  const { companySlug, orderNumber } = await params;

  const [companyResult, orderResult, items, payments, deliveries, paymentMethods] =
    await Promise.all([
      sqlQuery<{ id: string; slug: string; name: string }>(
        `SELECT id, slug, name FROM companies WHERE slug = $1 AND status = 'active' LIMIT 1`,
        [companySlug],
      ),
      sqlQuery<OrderRow>(
        `SELECT o.id, o."orderNumber", o."orderStatus", o."paymentStatus",
                o."deliveryStatus", o.subtotal::text, o."deliveryFee"::text,
                o.total::text, o."deliveryAddress", o."requestedTimeSlot",
                c.name AS "customerName", c.phone AS "customerPhone",
                c.email AS "customerEmail"
           FROM orders o
           JOIN customers c ON c.id = o."customerId"
          WHERE o."orderNumber" = $1
            AND EXISTS (
              SELECT 1 FROM companies co
              WHERE co.id = o."companyId" AND co.slug = $2 AND co.status = 'active'
            )
          LIMIT 1`,
        [orderNumber, companySlug],
      ),
      sqlQuery<ItemRow>(
        `SELECT oi.id, s.code AS "skuCode", s.name AS "skuName",
                p.name AS "productName",
                oi.quantity::text, oi."unitPrice"::text, oi."lineTotal"::text
           FROM order_items oi
           JOIN skus s ON s.id = oi."skuId"
           JOIN products p ON p.id = s."productId"
           JOIN orders o ON o.id = oi."orderId"
           JOIN companies co ON co.id = o."companyId"
          WHERE o."orderNumber" = $1 AND co.slug = $2
          ORDER BY oi."createdAt" ASC`,
        [orderNumber, companySlug],
      ),
      sqlQuery<PaymentRow>(
        `SELECT p.id, p.status, p."proofUrl", p."referenceNumber",
                pm.name AS "methodName", pm.type AS "methodType"
           FROM payments p
           JOIN payment_methods pm ON pm.id = p."paymentMethodId"
           JOIN orders o ON o.id = p."orderId"
           JOIN companies co ON co.id = o."companyId"
          WHERE o."orderNumber" = $1 AND co.slug = $2
          ORDER BY p."createdAt" DESC`,
        [orderNumber, companySlug],
      ),
      sqlQuery<DeliveryRow>(
        `SELECT d.id, d.status, d."trackingNumber"
           FROM deliveries d
           JOIN orders o ON o.id = d."orderId"
           JOIN companies co ON co.id = o."companyId"
          WHERE o."orderNumber" = $1 AND co.slug = $2
          ORDER BY d."createdAt" DESC
          LIMIT 1`,
        [orderNumber, companySlug],
      ),
      sqlQuery<PaymentMethodRow>(
        `SELECT id, name, type, settings
           FROM payment_methods pm
          WHERE pm."companyId" = (SELECT id FROM companies WHERE slug = $1 LIMIT 1)
            AND pm.enabled = true
          ORDER BY pm.name ASC`,
        [companySlug],
      ),
    ]);

  const company = companyResult.rows[0];
  const order = orderResult.rows[0];
  if (!company || !order) notFound();

  const latestPayment = payments.rows[0] ?? null;
  const latestDelivery = deliveries.rows[0] ?? null;

  return (
    <section className="mx-auto min-h-screen w-full max-w-md bg-white px-4 py-4 sm:max-w-2xl sm:px-6 lg:max-w-4xl">
      <header className="border-b border-slate-200 pb-4">
        <Link href={`/${company.slug}`} className="text-sm font-medium text-blue-600">
          Back to ordering
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Order {order.orderNumber}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Thank you, {order.customerName}. Your order has been submitted.
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
              {items.rows.map((item) => (
                <div key={item.id} className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium text-slate-950">
                      {item.productName} / {item.skuName}
                    </p>
                    <p className="mt-1 text-slate-500">{item.skuCode}</p>
                  </div>
                  <div className="text-slate-700 md:text-right">
                    <p className="font-medium">{item.quantity} x RM {item.unitPrice}</p>
                    <p className="mt-1 font-medium">RM {item.lineTotal}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-semibold text-slate-950">Payment</h2>
            <p className="mt-2 text-sm text-slate-600">
              Please pay with Touch & Go or bank transfer, then keep your screenshot for confirmation.
            </p>
            <form action={submitPaymentProof.bind(null, company.slug, order.orderNumber)} className="mt-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
              <label className="block text-sm font-medium text-slate-700">
                Touch & Go Screenshot
                <input name="proof" required={!latestPayment?.proofUrl} type="file" accept="image/jpeg,image/png,image/webp"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Reference Number
                <input name="referenceNumber" defaultValue={latestPayment?.referenceNumber ?? ""} placeholder="Optional"
                  className="mt-1 h-12 w-full rounded-md border border-slate-300 px-3 text-base" />
              </label>
              <button className="h-12 w-full rounded-md bg-blue-600 px-4 text-base font-semibold text-white">
                Submit Payment Proof
              </button>
              {latestPayment ? (
                <p className="text-xs leading-5 text-slate-500">
                  Current payment status: {formatStatus(latestPayment.status)}
                </p>
              ) : null}
            </form>
            {latestPayment?.proofUrl ? (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-950">Uploaded Screenshot</p>
                <a href={latestPayment.proofUrl} className="mt-1 block text-sm font-medium text-blue-600" target="_blank" rel="noreferrer">
                  View proof
                </a>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={latestPayment.proofUrl} alt="Payment proof" className="mt-3 max-h-80 w-full rounded-md object-contain" />
              </div>
            ) : null}
            <div className="mt-4 space-y-3">
              {paymentMethods.rows.length === 0 ? (
                <p className="text-sm text-slate-600">Payment instructions are not available yet.</p>
              ) : (
                paymentMethods.rows.map((method) => (
                  <div key={method.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="font-medium text-slate-950">{method.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{method.type}</p>
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
              Delivery tracking will appear here after the team arranges delivery.
            </p>
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-950">
                {latestDelivery ? formatStatus(latestDelivery.status) : "Preparing"}
              </p>
              <p className="mt-1 text-slate-600">
                Lalamove driver and live delivery status will be shown here when external delivery integration is enabled.
              </p>
              {latestDelivery?.trackingNumber ? (
                <p className="mt-2 text-slate-600">Tracking: {latestDelivery.trackingNumber}</p>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-semibold text-slate-950">Total</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Subtotal" value={`RM ${order.subtotal}`} />
              <Row label="Delivery" value={`RM ${order.deliveryFee}`} />
              <Row label="Total" value={`RM ${order.total}`} />
            </dl>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-semibold text-slate-950">Customer</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Name" value={order.customerName} />
              <Row label="Phone" value={order.customerPhone ?? "-"} />
              <Row label="Email" value={order.customerEmail ?? "-"} />
            </dl>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-semibold text-slate-950">Address</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{order.deliveryAddress}</p>
            {order.requestedTimeSlot ? (
              <p className="mt-3 text-sm text-slate-600">Requested: {order.requestedTimeSlot}</p>
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
  return value.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
