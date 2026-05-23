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
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const company = await getActiveCompany();
  const [products, skus, locations, balances, movements] = await Promise.all([
    prisma.product.findMany({
      where: { companyId: company.id },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.sku.findMany({
      where: { companyId: company.id },
      include: { product: true },
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    }),
    prisma.inventoryLocation.findMany({
      where: { companyId: company.id },
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    }),
    prisma.inventoryBalance.findMany({
      where: { companyId: company.id },
      include: {
        location: true,
        sku: {
          include: {
            product: true,
          },
        },
      },
      orderBy: [{ location: { code: "asc" } }, { sku: { code: "asc" } }],
    }),
    prisma.inventoryMovement.findMany({
      where: { companyId: company.id },
      include: {
        location: true,
        sku: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
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
                {locations
                  .filter((location) => location.isActive)
                  .map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} / {location.name}
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
                {skus
                  .filter((sku) => sku.isActive)
                  .map((sku) => (
                    <option key={sku.id} value={sku.id}>
                      {sku.code} / {sku.name}
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
        {locations.length === 0 ? (
          <p className="text-sm text-slate-600">No locations yet.</p>
        ) : (
          <div className="grid gap-3">
            {locations.map((location) => (
              <form
                key={location.id}
                className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[0.8fr_1fr_1.5fr_auto_auto]"
              >
                <input type="hidden" name="id" value={location.id} />
                <span className="self-center text-sm font-medium">
                  {location.code}
                </span>
                <span className="self-center text-sm">{location.name}</span>
                <span className="self-center text-sm text-slate-600">
                  {location.address ?? "-"}
                </span>
                <span className="self-center text-sm text-slate-600">
                  {location.isActive ? "Active" : "Disabled"}
                </span>
                <button
                  formAction={setLocationActive}
                  name="isActive"
                  value={location.isActive ? "false" : "true"}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
                >
                  {location.isActive ? "Disable" : "Enable"}
                </button>
              </form>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Stock Balances</h2>
        {balances.length === 0 ? (
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
                {balances.map((balance) => {
                  const available =
                    Number(balance.onHand) - Number(balance.reserved);

                  return (
                    <tr key={balance.id}>
                      <td className="px-4 py-3">{balance.location.code}</td>
                      <td className="px-4 py-3 font-medium">
                        {balance.sku.code}
                      </td>
                      <td className="px-4 py-3">
                        {balance.sku.product.name} / {balance.sku.name}
                      </td>
                      <td className="px-4 py-3">
                        {balance.onHand.toString()}
                      </td>
                      <td className="px-4 py-3">
                        {balance.reserved.toString()}
                      </td>
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
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
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
        {products.length === 0 ? (
          <p className="text-sm text-slate-600">No products yet.</p>
        ) : (
          <div className="grid gap-3">
            {products.map((product) => (
              <form
                key={product.id}
                action={updateProduct}
                className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1.3fr_1.3fr_auto_auto]"
              >
                <input type="hidden" name="id" value={product.id} />
                <input
                  name="name"
                  defaultValue={product.name}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  name="description"
                  defaultValue={product.description ?? ""}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  name="imageUrl"
                  defaultValue={product.imageUrl ?? ""}
                  placeholder="/products/fruit1.jpeg"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
                  Save
                </button>
                <button
                  formAction={setProductActive}
                  name="isActive"
                  value={product.isActive ? "false" : "true"}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
                >
                  {product.isActive ? "Disable" : "Enable"}
                </button>
              </form>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">SKUs</h2>
        {skus.length === 0 ? (
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
                {skus.map((sku) => (
                  <tr key={sku.id}>
                    <td className="px-4 py-3">{sku.product.name}</td>
                    <td className="px-4 py-3" colSpan={6}>
                      <form
                        action={updateSku}
                        className="grid gap-2 md:grid-cols-[1fr_1.5fr_0.8fr_0.8fr_auto_auto_auto]"
                      >
                        <input type="hidden" name="id" value={sku.id} />
                        <input
                          name="code"
                          defaultValue={sku.code}
                          className="rounded-md border border-slate-300 px-3 py-2"
                        />
                        <input
                          name="name"
                          defaultValue={sku.name}
                          className="rounded-md border border-slate-300 px-3 py-2"
                        />
                        <input
                          name="unit"
                          defaultValue={sku.unit}
                          className="rounded-md border border-slate-300 px-3 py-2"
                        />
                        <input
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={sku.price.toString()}
                          className="rounded-md border border-slate-300 px-3 py-2"
                        />
                        <span className="self-center text-slate-600">
                          {sku.isActive ? "Active" : "Disabled"}
                        </span>
                        <button className="rounded-md border border-slate-300 px-3 py-2 font-medium">
                          Save
                        </button>
                        <button
                          formAction={setSkuActive}
                          name="isActive"
                          value={sku.isActive ? "false" : "true"}
                          className="rounded-md border border-slate-300 px-3 py-2 font-medium"
                        >
                          {sku.isActive ? "Disable" : "Enable"}
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
        {movements.length === 0 ? (
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
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="px-4 py-3">
                      {movement.createdAt.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{movement.type}</td>
                    <td className="px-4 py-3">{movement.location.code}</td>
                    <td className="px-4 py-3">{movement.sku.code}</td>
                    <td className="px-4 py-3">
                      {movement.quantity.toString()}
                    </td>
                    <td className="px-4 py-3">{movement.reason ?? "-"}</td>
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
