import Link from "next/link";
import { createOrder } from "./actions";
import { getActiveCompany } from "@/lib/company";
import { getAdminOrders } from "@/services/admin-queries";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const company = await getActiveCompany();
  const { orders, customers, skus } = await getAdminOrders(company.id);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create and manage orders for {company.name}
        </p>
      </div>

      <form
        action={createOrder}
        className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-base font-semibold">New Order</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Existing Customer
            <select
              name="customerId"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Create new customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            New Customer Name
            <input
              name="customerName"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Phone
            <input
              name="customerPhone"
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
          <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
            Customer Address
            <input
              name="customerAddress"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Source Channel
            <select
              name="sourceChannel"
              required
              defaultValue="internal"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="internal">Internal</option>
              <option value="order_portal">Order Portal</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
            Delivery Address
            <input
              name="deliveryAddress"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Time Slot
            <input
              name="requestedTimeSlot"
              placeholder="Today 2pm-4pm"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Delivery Fee
            <input
              name="deliveryFee"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            SKU
            <select
              name="skuId"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select SKU</option>
              {skus.map((sku) => (
                <option key={sku.id} value={sku.id}>
                  {sku.label}
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
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Unit Price
            <input
              name="unitPrice"
              required
              type="number"
              min="0.01"
              step="0.01"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 lg:col-span-3">
            Notes
            <textarea
              name="notes"
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
          Create Order
        </button>
      </form>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-600">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 font-medium">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3">{order.customerName}</td>
                    <td className="px-4 py-3">
                      {order.items.join(", ")}
                    </td>
                    <td className="px-4 py-3">RM {order.total}</td>
                    <td className="px-4 py-3">{order.orderStatus}</td>
                    <td className="px-4 py-3">{order.paymentStatus}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-blue-600"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
