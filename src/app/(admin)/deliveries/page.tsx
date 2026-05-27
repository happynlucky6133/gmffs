import {
  bookManualDelivery,
  createManualDelivery,
  markCancelled,
  markDelivered,
  markFailed,
  markPickedUp,
  setDeliveryQuote,
} from "./actions";
import { getActiveCompany } from "@/lib/company";
import { sqlQuery } from "@/lib/sql";

export const dynamic = "force-dynamic";

type ReadyOrderRow = {
  id: string;
  "orderNumber": string;
  "customerName": string;
  "customerPhone": string | null;
  "deliveryAddress": string;
  "reservedLocationId": string | null;
  "reservedLocationCode": string | null;
  "reservedLocationAddress": string | null;
};

type DeliveryRow = {
  id: string;
  status: string;
  "quoteAmount": string | null;
  "pickupAddress": string | null;
  "dropoffAddress": string;
  "trackingNumber": string | null;
  "providerRef": string | null;
  "scheduledAt": Date | null;
  "locationCode": string | null;
  "orderNumber": string;
  "customerName": string;
  "customerPhone": string | null;
  "latestEventNotes": string | null;
};

type LocationRow = { id: string; code: string; name: string };

export default async function DeliveriesPage() {
  const company = await getActiveCompany();

  const [readyOrders, deliveries, locations] = await Promise.all([
    sqlQuery<ReadyOrderRow>(
      `SELECT o.id, o."orderNumber", c.name AS "customerName",
              c.phone AS "customerPhone", o."deliveryAddress",
              r."locationId" AS "reservedLocationId",
              l.code AS "reservedLocationCode",
              l.address AS "reservedLocationAddress"
         FROM orders o
         JOIN customers c ON c.id = o."customerId"
         LEFT JOIN LATERAL (
           SELECT "locationId" FROM inventory_reservations
           WHERE "orderId" = o.id AND "companyId" = o."companyId"
           LIMIT 1
         ) r ON true
         LEFT JOIN inventory_locations l ON l.id = r."locationId"
        WHERE o."companyId" = $1
          AND o."allocationStatus" = 'allocated'
          AND o."fulfillmentStatus" IN ('ready_to_pack', 'packed', 'ready_for_pickup')
          AND o."deliveryStatus" IN ('pending_quote', 'quoted')
          AND NOT EXISTS (
            SELECT 1 FROM deliveries d
            WHERE d."orderId" = o.id
              AND d.status NOT IN ('cancelled', 'failed')
          )
        ORDER BY o."createdAt" ASC`,
      [company.id],
    ),
    sqlQuery<DeliveryRow>(
      `SELECT d.id, d.status, d."quoteAmount"::text, d."pickupAddress",
              d."dropoffAddress", d."trackingNumber", d."providerRef",
              d."scheduledAt",
              l.code AS "locationCode",
              o."orderNumber", c.name AS "customerName",
              c.phone AS "customerPhone",
              de.notes AS "latestEventNotes"
         FROM deliveries d
         JOIN orders o ON o.id = d."orderId"
         JOIN customers c ON c.id = o."customerId"
         LEFT JOIN inventory_locations l ON l.id = d."locationId"
         LEFT JOIN LATERAL (
           SELECT notes FROM delivery_events
           WHERE "deliveryId" = d.id
           ORDER BY "createdAt" DESC LIMIT 1
         ) de ON true
        WHERE d."companyId" = $1
        ORDER BY
          CASE d.status
            WHEN 'pending_quote' THEN 1 WHEN 'quoted' THEN 2
            WHEN 'booked' THEN 3 WHEN 'picked_up' THEN 4
            WHEN 'delivered' THEN 5 ELSE 6
          END,
          d."createdAt" DESC`,
      [company.id],
    ),
    sqlQuery<LocationRow>(
      `SELECT id, code, name FROM inventory_locations
        WHERE "companyId" = $1 AND "isActive" = true
        ORDER BY code ASC`,
      [company.id],
    ),
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
        <StatusCard label="Ready Orders" value={readyOrders.rows.length} />
        <StatusCard label="Quoted" value={deliveries.rows.filter((d) => d.status === "quoted").length} />
        <StatusCard label="Booked" value={deliveries.rows.filter((d) => d.status === "booked").length} />
        <StatusCard label="Delivered" value={deliveries.rows.filter((d) => d.status === "delivered").length} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold">Ready For Delivery</h2>
        </div>
        {readyOrders.rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-600">
            No allocated orders waiting for delivery.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {readyOrders.rows.map((order) => (
              <form
                key={order.id}
                action={createManualDelivery}
                className="grid gap-3 p-5 xl:grid-cols-[1.2fr_180px_140px_180px_1fr_auto]"
              >
                <input type="hidden" name="orderId" value={order.id} />
                <div>
                  <p className="font-medium">{order.orderNumber}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {order.customerName} / {order.customerPhone ?? "-"}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{order.deliveryAddress}</p>
                </div>
                <select
                  name="locationId"
                  defaultValue={order.reservedLocationId ?? ""}
                  className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">No pickup location</option>
                  {locations.rows.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code}
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
                  defaultValue={order.reservedLocationAddress ?? ""}
                  placeholder="Pickup address"
                  className="self-start rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input type="hidden" name="dropoffAddress" value={order.deliveryAddress} />
                <button className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
                  Create
                </button>
              </form>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Delivery Jobs</h2>
        {deliveries.rows.length === 0 ? (
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
                {deliveries.rows.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{d.orderNumber}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {d.customerName} / {d.customerPhone ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{d.locationCode ?? "-"}</p>
                      <p className="mt-1 text-xs text-slate-500">{d.pickupAddress ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3 max-w-xs">{d.dropoffAddress}</td>
                    <td className="px-4 py-3">
                      {d.quoteAmount ? `RM ${d.quoteAmount}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <p>{d.status}</p>
                      <p className="mt-1 text-xs text-slate-500">{d.latestEventNotes ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <DeliveryActions delivery={d} />
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

function DeliveryActions({ delivery }: { delivery: DeliveryRow }) {
  return (
    <div className="space-y-3">
      {delivery.status === "pending_quote" ? (
        <form action={setDeliveryQuote} className="flex flex-wrap gap-2">
          <input type="hidden" name="id" value={delivery.id} />
          <input
            name="quoteAmount" required type="number" min="0.01" step="0.01"
            placeholder="Quote"
            className="w-24 rounded-md border border-slate-300 px-3 py-2"
          />
          <input name="notes" placeholder="Notes" className="w-32 rounded-md border border-slate-300 px-3 py-2" />
          <button className="rounded-md bg-blue-600 px-3 py-2 font-medium text-white">Quote</button>
        </form>
      ) : null}

      {(delivery.status === "pending_quote" || delivery.status === "quoted") ? (
        <form action={bookManualDelivery} className="flex flex-wrap gap-2">
          <input type="hidden" name="id" value={delivery.id} />
          <input name="scheduledAt" type="datetime-local" className="w-44 rounded-md border border-slate-300 px-3 py-2" />
          <input name="trackingNumber" defaultValue={delivery.trackingNumber ?? ""} placeholder="Tracking" className="w-28 rounded-md border border-slate-300 px-3 py-2" />
          <input name="providerRef" defaultValue={delivery.providerRef ?? ""} placeholder="Ref" className="w-24 rounded-md border border-slate-300 px-3 py-2" />
          <button className="rounded-md bg-blue-600 px-3 py-2 font-medium text-white">Book</button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {delivery.status === "booked" ? (
          <DeliveryButton action={markPickedUp} id={delivery.id} label="Pickup" />
        ) : null}
        {delivery.status === "picked_up" ? (
          <DeliveryButton action={markDelivered} id={delivery.id} label="Delivered" primary />
        ) : null}
        {delivery.status !== "delivered" && delivery.status !== "cancelled" && delivery.status !== "failed" ? (
          <>
            <DeliveryButton action={markFailed} id={delivery.id} label="Fail" />
            <DeliveryButton action={markCancelled} id={delivery.id} label="Cancel" />
          </>
        ) : null}
      </div>
    </div>
  );
}

function DeliveryButton({
  action, id, label, primary = false,
}: { action: (d: FormData) => void; id: string; label: string; primary?: boolean }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className={primary ? "rounded-md bg-blue-600 px-3 py-2 font-medium text-white" : "rounded-md border border-slate-300 px-3 py-2 font-medium"}>
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
