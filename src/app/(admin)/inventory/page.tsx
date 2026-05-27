import {
  adjustInventory,
  createLocation,
  createProduct,
  createSku,
  setLocationActive,
  setProductActive,
  setSkuActive,
  updateProduct,
  updateSku,
} from "./actions";
import { getActiveCompany } from "@/lib/company";
import { sqlQuery } from "@/lib/sql";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  "imageUrl": string | null;
  "displayOrder": number;
  "isActive": boolean;
};

type SkuRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: string;
  "isActive": boolean;
  "productName": string;
};

type LocationRow = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  "isActive": boolean;
};

type BalanceRow = {
  id: string;
  "onHand": string;
  reserved: string;
  "locationCode": string;
  "skuCode": string;
  "skuName": string;
  "productName": string;
};

type MovementRow = {
  id: string;
  type: string;
  quantity: string;
  reason: string | null;
  "createdAt": Date;
  "locationCode": string;
  "skuCode": string;
};

export default async function InventoryPage() {
  const company = await getActiveCompany();

  const [products, skus, locations, balances, movements] = await Promise.all([
    sqlQuery<ProductRow>(
      `SELECT id, name, description, "imageUrl", "displayOrder", "isActive"
         FROM products
        WHERE "companyId" = $1
        ORDER BY "isActive" DESC, name ASC`,
      [company.id],
    ),
    sqlQuery<SkuRow>(
      `SELECT s.id, s.code, s.name, s.unit, s.price::text, s."isActive",
              p.name AS "productName"
         FROM skus s
         JOIN products p ON p.id = s."productId"
        WHERE s."companyId" = $1
        ORDER BY s."isActive" DESC, s.code ASC`,
      [company.id],
    ),
    sqlQuery<LocationRow>(
      `SELECT id, name, code, address, "isActive"
         FROM inventory_locations
        WHERE "companyId" = $1
        ORDER BY "isActive" DESC, code ASC`,
      [company.id],
    ),
    sqlQuery<BalanceRow>(
      `SELECT b.id, b."onHand"::text, b.reserved::text,
              l.code AS "locationCode",
              s.code AS "skuCode", s.name AS "skuName",
              p.name AS "productName"
         FROM inventory_balances b
         JOIN inventory_locations l ON l.id = b."locationId"
         JOIN skus s ON s.id = b."skuId"
         JOIN products p ON p.id = s."productId"
        WHERE b."companyId" = $1
        ORDER BY l.code ASC, s.code ASC`,
      [company.id],
    ),
    sqlQuery<MovementRow>(
      `SELECT m.id, m.type, m.quantity::text, m.reason, m."createdAt",
              l.code AS "locationCode",
              s.code AS "skuCode"
         FROM inventory_movements m
         JOIN inventory_locations l ON l.id = m."locationId"
         JOIN skus s ON s.id = m."skuId"
        WHERE m."companyId" = $1
        ORDER BY m."createdAt" DESC
        LIMIT 10`,
      [company.id],
    ),
  ]);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="mt-2 text-sm text-slate-600">
          Managing catalog for {company.name}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,360px)_1fr]">
        <form
          action={createLocation}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold">New Location</h2>
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
              placeholder="GM-MAIN"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Address
            <textarea
              name="address"
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Add Location
          </button>
        </form>

        <form
          action={adjustInventory}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold">Stock Adjustment</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Location
              <select
                name="locationId"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select location</option>
                {locations.rows
                  .filter((l) => l.isActive)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} / {l.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              SKU
              <select
                name="skuId"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select SKU</option>
                {skus.rows
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} / {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              On Hand
              <input
                name="onHand"
                required
                type="number"
                min="0"
                step="0.001"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Reason
              <input
                name="reason"
                placeholder="Opening stock, recount, damaged stock"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Save Stock
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Locations</h2>
        {locations.rows.length === 0 ? (
          <p className="text-sm text-slate-600">No locations yet.</p>
        ) : (
          <div className="grid gap-3">
            {locations.rows.map((l) => (
              <form
                key={l.id}
                className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[0.8fr_1fr_1.5fr_auto_auto]"
              >
                <input type="hidden" name="id" value={l.id} />
                <span className="self-center text-sm font-medium">{l.code}</span>
                <span className="self-center text-sm">{l.name}</span>
                <span className="self-center text-sm text-slate-600">
                  {l.address ?? "-"}
                </span>
                <span className="self-center text-sm text-slate-600">
                  {l.isActive ? "Active" : "Disabled"}
                </span>
                <button
                  formAction={setLocationActive}
                  name="isActive"
                  value={l.isActive ? "false" : "true"}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
                >
                  {l.isActive ? "Disable" : "Enable"}
                </button>
              </form>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Stock Balances</h2>
        {balances.rows.length === 0 ? (
          <p className="text-sm text-slate-600">No stock balances yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">On Hand</th>
                  <th className="px-4 py-3 font-medium">Reserved</th>
                  <th className="px-4 py-3 font-medium">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {balances.rows.map((b) => {
                  const available = Number(b.onHand) - Number(b.reserved);
                  return (
                    <tr key={b.id}>
                      <td className="px-4 py-3">{b.locationCode}</td>
                      <td className="px-4 py-3 font-medium">{b.skuCode}</td>
                      <td className="px-4 py-3">
                        {b.productName} / {b.skuName}
                      </td>
                      <td className="px-4 py-3">{b.onHand}</td>
                      <td className="px-4 py-3">{b.reserved}</td>
                      <td className="px-4 py-3">{available.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,360px)_1fr]">
        <form
          action={createProduct}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold">New Product</h2>
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              name="name"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea
              name="description"
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Image URL
            <input
              name="imageUrl"
              placeholder="/products/fruit1.jpeg"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Add Product
          </button>
        </form>

        <form
          action={createSku}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold">New SKU</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Product
              <select
                name="productId"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select product</option>
                {products.rows.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Code
              <input
                name="code"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Name
              <input
                name="name"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Unit
              <input
                name="unit"
                required
                placeholder="box, kg, tray"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Price
              <input
                name="price"
                required
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Add SKU
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Products</h2>
        {products.rows.length === 0 ? (
          <p className="text-sm text-slate-600">No products yet.</p>
        ) : (
          <div className="grid gap-3">
            {products.rows.map((p) => (
              <form
                key={p.id}
                action={updateProduct}
                className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1.3fr_1.3fr_auto_auto]"
              >
                <input type="hidden" name="id" value={p.id} />
                <input
                  name="name"
                  defaultValue={p.name}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  name="description"
                  defaultValue={p.description ?? ""}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  name="imageUrl"
                  defaultValue={p.imageUrl ?? ""}
                  placeholder="/products/fruit1.jpeg"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
                  Save
                </button>
                <button
                  formAction={setProductActive}
                  name="isActive"
                  value={p.isActive ? "false" : "true"}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
                >
                  {p.isActive ? "Disable" : "Enable"}
                </button>
              </form>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">SKUs</h2>
        {skus.rows.length === 0 ? (
          <p className="text-sm text-slate-600">No SKUs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {skus.rows.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">{s.productName}</td>
                    <td className="px-4 py-3" colSpan={6}>
                      <form
                        action={updateSku}
                        className="grid gap-2 md:grid-cols-[1fr_1.5fr_0.8fr_0.8fr_auto_auto_auto]"
                      >
                        <input type="hidden" name="id" value={s.id} />
                        <input
                          name="code"
                          defaultValue={s.code}
                          className="rounded-md border border-slate-300 px-3 py-2"
                        />
                        <input
                          name="name"
                          defaultValue={s.name}
                          className="rounded-md border border-slate-300 px-3 py-2"
                        />
                        <input
                          name="unit"
                          defaultValue={s.unit}
                          className="rounded-md border border-slate-300 px-3 py-2"
                        />
                        <input
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={s.price}
                          className="rounded-md border border-slate-300 px-3 py-2"
                        />
                        <span className="self-center text-slate-600">
                          {s.isActive ? "Active" : "Disabled"}
                        </span>
                        <button className="rounded-md border border-slate-300 px-3 py-2 font-medium">
                          Save
                        </button>
                        <button
                          formAction={setSkuActive}
                          name="isActive"
                          value={s.isActive ? "false" : "true"}
                          className="rounded-md border border-slate-300 px-3 py-2 font-medium"
                        >
                          {s.isActive ? "Disable" : "Enable"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Stock Movements</h2>
        {movements.rows.length === 0 ? (
          <p className="text-sm text-slate-600">No stock movements yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {movements.rows.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      {m.createdAt.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{m.type}</td>
                    <td className="px-4 py-3">{m.locationCode}</td>
                    <td className="px-4 py-3">{m.skuCode}</td>
                    <td className="px-4 py-3">{m.quantity}</td>
                    <td className="px-4 py-3">{m.reason ?? "-"}</td>
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
