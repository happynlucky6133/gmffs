import {
  bookManualDelivery,
  createManualDelivery,
  markCancelled,
  markDelivered,
  markFailed,
  markPickedUp,
  setDeliveryQuote,
} from "./actions";
import {
  AllocationStatus,
  DeliveryStatus,
  FulfillmentStatus,
} from "@/generated/prisma/client";
import { getActiveCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const company = await getActiveCompany();
  const [readyOrders, deliveries, locations] = await Promise.all([
    prisma.order.findMany({
      where: {
        companyId: company.id,
        allocationStatus: AllocationStatus.allocated,
        fulfillmentStatus: {
          in: [
            FulfillmentStatus.ready_to_pack,
            FulfillmentStatus.packed,
            FulfillmentStatus.ready_for_pickup,
          ],
        },
        deliveryStatus: {
          in: [DeliveryStatus.pending_quote, DeliveryStatus.quoted],
        },
        deliveries: {
          none: {
            status: {
              notIn: [DeliveryStatus.cancelled, DeliveryStatus.failed],
            },
          },
        },
      },
      include: {
        customer: true,
        inventoryReservations: {
          include: {
            location: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.delivery.findMany({
      where: { companyId: company.id },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
        location: true,
        events: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.inventoryLocation.findMany({
      where: {
        companyId: company.id,
        isActive: true,
      },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deliveries</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manual delivery booking and handover tracking for allocated orders.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <StatusCard label="Ready Orders" value={readyOrders.length} />
        <StatusCard
          label="Quoted"
          value={
            deliveries.filter(
              (delivery) => delivery.status === DeliveryStatus.quoted,
            ).length
          }
        />
        <StatusCard
          label="Booked"
          value={
            deliveries.filter(
              (delivery) => delivery.status === DeliveryStatus.booked,
            ).length
          }
        />
        <StatusCard
          label="Delivered"
          value={
            deliveries.filter(
              (delivery) => delivery.status === DeliveryStatus.delivered,
            ).length
          }
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold">Ready For Delivery</h2>
        </div>
        {readyOrders.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-600">
            No allocated orders waiting for delivery.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {readyOrders.map((order) => {
              const reservedLocation = order.inventoryReservations[0]?.location;

              return (
                <form
                  key={order.id}
                  action={createManualDelivery}
                  className="grid gap-3 p-5 xl:grid-cols-[1.2fr_180px_140px_180px_1fr_auto]"
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {order.customer.name} / {order.customer.phone ?? "-"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {order.deliveryAddress}
                    </p>
                  </div>
                  <select
                    name="locationId"
                    defaultValue={reservedLocation?.id ?? ""}
                    className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">No pickup location</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code}
                      </option>
                    ))}
                  </select>
                  <input
                    name="quoteAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Quote"
                    className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    name="scheduledAt"
                    type="datetime-local"
                    className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    name="pickupAddress"
                    defaultValue={reservedLocation?.address ?? ""}
                    placeholder="Pickup address"
                    className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="hidden"
                    name="dropoffAddress"
                    value={order.deliveryAddress}
                  />
                  <button className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
                    Create
                  </button>
                </form>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Delivery Jobs</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-slate-600">No delivery jobs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Pickup</th>
                  <th className="px-4 py-3 font-medium">Dropoff</th>
                  <th className="px-4 py-3 font-medium">Quote</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {delivery.order.orderNumber}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {delivery.order.customer.name} /{" "}
                        {delivery.order.customer.phone ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{delivery.location?.code ?? "-"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {delivery.pickupAddress ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {delivery.dropoffAddress}
                    </td>
                    <td className="px-4 py-3">
                      {delivery.quoteAmount
                        ? `RM ${delivery.quoteAmount.toString()}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <p>{delivery.status}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {delivery.events[0]?.notes ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <DeliveryActions delivery={delivery} />
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

function DeliveryActions({
  delivery,
}: {
  delivery: {
    id: string;
    status: DeliveryStatus;
    trackingNumber: string | null;
    providerRef: string | null;
    scheduledAt: Date | null;
  };
}) {
  return (
    <div className="space-y-3">
      {delivery.status === DeliveryStatus.pending_quote ? (
        <form action={setDeliveryQuote} className="flex flex-wrap gap-2">
          <input type="hidden" name="id" value={delivery.id} />
          <input
            name="quoteAmount"
            required
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Quote"
            className="w-24 rounded-md border border-slate-300 px-3 py-2"
          />
          <input
            name="notes"
            placeholder="Notes"
            className="w-32 rounded-md border border-slate-300 px-3 py-2"
          />
          <button className="rounded-md bg-blue-600 px-3 py-2 font-medium text-white">
            Quote
          </button>
        </form>
      ) : null}

      {delivery.status === DeliveryStatus.pending_quote ||
      delivery.status === DeliveryStatus.quoted ? (
        <form action={bookManualDelivery} className="flex flex-wrap gap-2">
          <input type="hidden" name="id" value={delivery.id} />
          <input
            name="scheduledAt"
            type="datetime-local"
            className="w-44 rounded-md border border-slate-300 px-3 py-2"
          />
          <input
            name="trackingNumber"
            defaultValue={delivery.trackingNumber ?? ""}
            placeholder="Tracking"
            className="w-28 rounded-md border border-slate-300 px-3 py-2"
          />
          <input
            name="providerRef"
            defaultValue={delivery.providerRef ?? ""}
            placeholder="Ref"
            className="w-24 rounded-md border border-slate-300 px-3 py-2"
          />
          <button className="rounded-md bg-blue-600 px-3 py-2 font-medium text-white">
            Book
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {delivery.status === DeliveryStatus.booked ? (
          <DeliveryButton action={markPickedUp} id={delivery.id} label="Pickup" />
        ) : null}
        {delivery.status === DeliveryStatus.picked_up ? (
          <DeliveryButton
            action={markDelivered}
            id={delivery.id}
            label="Delivered"
            primary
          />
        ) : null}
        {delivery.status !== DeliveryStatus.delivered &&
        delivery.status !== DeliveryStatus.cancelled &&
        delivery.status !== DeliveryStatus.failed ? (
          <>
            <DeliveryButton action={markFailed} id={delivery.id} label="Fail" />
            <DeliveryButton
              action={markCancelled}
              id={delivery.id}
              label="Cancel"
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function DeliveryButton({
  action,
  id,
  label,
  primary = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        className={
          primary
            ? "rounded-md bg-blue-600 px-3 py-2 font-medium text-white"
            : "rounded-md border border-slate-300 px-3 py-2 font-medium"
        }
      >
        {label}
      </button>
    </form>
  );
}

function StatusCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
