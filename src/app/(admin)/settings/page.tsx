import {
  createServiceArea,
  ensurePaymentMethod,
  updateCompanySettings,
  updatePaymentMethodSettings,
  updateServiceArea,
} from "./actions";
import { PaymentMethodType } from "@/generated/prisma/client";
import { getActiveCompany } from "@/lib/company";
import { sqlQuery } from "@/lib/sql";

export const dynamic = "force-dynamic";

const paymentMethodLabels: Record<PaymentMethodType, string> = {
  touch_n_go: "Touch n Go",
  bank_transfer: "Bank Transfer",
  cash_on_delivery: "Cash on Delivery",
  payment_link: "Payment Link",
};

type PaymentMethodRow = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  settings: unknown;
};

type ServiceAreaRow = {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
};

export default async function SettingsPage() {
  const company = await getActiveCompany();
  const [paymentMethods, serviceAreas] = await Promise.all([
    sqlQuery<PaymentMethodRow>(
      `SELECT id, name, type, enabled, settings
         FROM payment_methods
        WHERE "companyId" = $1
        ORDER BY enabled DESC, type ASC`,
      [company.id],
    ),
    sqlQuery<ServiceAreaRow>(
      `SELECT id, name, code, enabled
         FROM service_areas
        WHERE "companyId" = $1
        ORDER BY enabled DESC, code ASC`,
      [company.id],
    ),
  ]);

  const existingMethodTypes = new Set(
    paymentMethods.rows.map((m) => m.type),
  );

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Company-level configuration for {company.name}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,420px)_1fr]">
        <form
          action={updateCompanySettings}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold">Company</h2>
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              name="name"
              required
              defaultValue={company.name}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Domain
            <input
              name="domain"
              defaultValue={company.domain ?? ""}
              placeholder="order.freshstack.cc/gm"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Slug: <span className="font-medium">{company.slug}</span>
          </div>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Save Company
          </button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">Payment Methods</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {paymentMethods.rows.map((method) => (
              <form
                key={method.id}
                action={updatePaymentMethodSettings}
                className="grid gap-3 p-5 lg:grid-cols-[1fr_140px_1.5fr_auto]"
              >
                <input type="hidden" name="id" value={method.id} />
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Name
                    <input
                      name="name"
                      required
                      defaultValue={method.name}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <p className="mt-2 text-xs text-slate-500">{method.type}</p>
                </div>
                <label className="block text-sm font-medium text-slate-700">
                  Status
                  <select
                    name="enabled"
                    defaultValue={method.enabled ? "true" : "false"}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Settings JSON
                  <textarea
                    name="settings"
                    rows={3}
                    defaultValue={
                      method.settings
                        ? JSON.stringify(method.settings, null, 2)
                        : ""
                    }
                    placeholder='{"accountName":"GM"}'
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <button className="self-end rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
                  Save
                </button>
              </form>
            ))}
          </div>

          <div className="border-t border-slate-200 p-5">
            <h3 className="text-sm font-semibold">Add Missing Method</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              {Object.values(PaymentMethodType)
                .filter((type) => !existingMethodTypes.has(type))
                .map((type) => (
                  <form
                    key={type}
                    action={ensurePaymentMethod}
                    className="contents"
                  >
                    <input type="hidden" name="type" value={type} />
                    <input
                      name="name"
                      defaultValue={paymentMethodLabels[type]}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                    <span className="self-center text-sm text-slate-600">
                      {type}
                    </span>
                    <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
                      Add
                    </button>
                  </form>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,420px)_1fr]">
        <form
          action={createServiceArea}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold">New Service Area</h2>
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              name="name"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Code
            <input
              name="code"
              required
              placeholder="KL"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Status
            <select
              name="enabled"
              defaultValue="true"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Add Area
          </button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">Service Areas</h2>
          </div>
          {serviceAreas.rows.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-600">
              No service areas yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {serviceAreas.rows.map((area) => (
                <form
                  key={area.id}
                  action={updateServiceArea}
                  className="grid gap-3 p-5 md:grid-cols-[1fr_140px_140px_auto]"
                >
                  <input type="hidden" name="id" value={area.id} />
                  <input
                    name="name"
                    required
                    defaultValue={area.name}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    name="code"
                    required
                    defaultValue={area.code}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <select
                    name="enabled"
                    defaultValue={area.enabled ? "true" : "false"}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                  <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
                    Save
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
