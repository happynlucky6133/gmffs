import Link from "next/link";
import {
  confirmPayment,
  createPayment,
  failPayment,
  markRefundRequired,
  markRefunded,
  setPaymentMethodEnabled,
  updatePaymentProof,
} from "./actions";
import { PaymentStatus } from "@/generated/prisma/client";
import { getActiveCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PaymentsPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

const paymentStatusOptions = Object.values(PaymentStatus);

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const { status } = await searchParams;
  const statusFilter = paymentStatusOptions.includes(status as PaymentStatus)
    ? (status as PaymentStatus)
    : undefined;

  const company = await getActiveCompany();
  const [paymentMethods, payableOrders, payments] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: { companyId: company.id },
      orderBy: [{ enabled: "desc" }, { name: "asc" }],
    }),
    prisma.order.findMany({
      where: {
        companyId: company.id,
        paymentStatus: {
          not: PaymentStatus.paid,
        },
      },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.payment.findMany({
      where: {
        companyId: company.id,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
        paymentMethod: true,
        events: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const enabledPaymentMethods = paymentMethods.filter((method) => method.enabled);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manual payment confirmation for {company.name}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,420px)_1fr]">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">Payment Methods</h2>
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <form
                key={method.id}
                action={setPaymentMethodEnabled}
                className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-2"
              >
                <input type="hidden" name="id" value={method.id} />
                <div>
                  <p className="text-sm font-medium">{method.name}</p>
                  <p className="text-xs text-slate-500">{method.type}</p>
                </div>
                <button
                  name="enabled"
                  value={method.enabled ? "false" : "true"}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium"
                >
                  {method.enabled ? "Disable" : "Enable"}
                </button>
              </form>
            ))}
          </div>
        </div>

        <form
          action={createPayment}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold">Create Payment</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Order
              <select
                name="orderId"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select order</option>
                {payableOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} / {order.customer.name} / RM{" "}
                    {order.total.toString()}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Method
              <select
                name="paymentMethodId"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select method</option>
                {enabledPaymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Amount
              <input
                name="amount"
                required
                type="number"
                min="0.01"
                step="0.01"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Reference Number
              <input
                name="referenceNumber"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              Proof URL
              <input
                name="proofUrl"
                type="url"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Create Payment
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterLink href="/payments" active={!statusFilter} label="All" />
        {paymentStatusOptions.map((option) => (
          <FilterLink
            key={option}
            href={`/payments?status=${option}`}
            active={statusFilter === option}
            label={option}
          />
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Payment Queue</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-600">No payments found.</p>
        ) : (
          <div className="grid gap-4">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/orders/${payment.orderId}`}
                      className="font-semibold text-blue-600"
                    >
                      {payment.order.orderNumber}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">
                      {payment.order.customer.name} / {payment.paymentMethod.name}
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      RM {payment.amount.toString()} / {payment.status}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {payment.events.map((event) => (
                      <p key={event.id}>
                        {event.type}
                        {event.notes ? ` - ${event.notes}` : ""}
                      </p>
                    ))}
                  </div>
                </div>

                <form
                  action={updatePaymentProof}
                  className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  <input type="hidden" name="id" value={payment.id} />
                  <input
                    name="referenceNumber"
                    defaultValue={payment.referenceNumber ?? ""}
                    placeholder="Reference number"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    name="proofUrl"
                    defaultValue={payment.proofUrl ?? ""}
                    placeholder="Proof URL"
                    type="url"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
                    Save Proof
                  </button>
                </form>
                {payment.proofUrl ? (
                  <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[180px_1fr]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={payment.proofUrl}
                      alt="Payment proof"
                      className="max-h-48 w-full rounded-md object-contain"
                    />
                    <div className="text-sm">
                      <p className="font-medium text-slate-950">
                        Customer payment proof
                      </p>
                      <a
                        href={payment.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block font-medium text-blue-600"
                      >
                        Open full screenshot
                      </a>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <PaymentAction
                    action={confirmPayment}
                    id={payment.id}
                    label="Confirm Paid"
                    primary
                  />
                  <PaymentAction
                    action={failPayment}
                    id={payment.id}
                    label="Fail"
                  />
                  <PaymentAction
                    action={markRefundRequired}
                    id={payment.id}
                    label="Refund Required"
                  />
                  <PaymentAction
                    action={markRefunded}
                    id={payment.id}
                    label="Refunded"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
        active
          ? "border-blue-600 bg-blue-50 text-blue-700"
          : "border-slate-300 text-slate-700"
      }`}
    >
      {label}
    </Link>
  );
}

function PaymentAction({
  action,
  id,
  label,
  primary = false,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        className={`rounded-md px-3 py-2 text-sm font-medium ${
          primary
            ? "bg-blue-600 text-white"
            : "border border-slate-300 text-slate-700"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
