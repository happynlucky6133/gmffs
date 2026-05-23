"use client";

import { FormEvent, useMemo, useState } from "react";

type FruitProduct = {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
};

const products: FruitProduct[] = [
  { id: "mango-cup", name: "Mango Fruit Cup", imageUrl: "/products/fruit1.jpeg", price: 8 },
  { id: "dragonfruit-blueberry", name: "Dragon Fruit Blueberry Cup", imageUrl: "/products/fruit2.jpeg", price: 8 },
  { id: "green-kiwi", name: "Green Kiwi Cup", imageUrl: "/products/fruit3.jpeg", price: 8 },
  { id: "mango-blueberry", name: "Mango Blueberry Cup", imageUrl: "/products/fruit4.jpeg", price: 8 },
  { id: "melon-tomato", name: "Melon Tomato Cup", imageUrl: "/products/fruit5.jpeg", price: 8 },
  { id: "gold-kiwi", name: "Gold Kiwi Cup", imageUrl: "/products/fruit6.jpeg", price: 8 },
  { id: "orange-cup", name: "Orange Cup", imageUrl: "/products/fruit7.jpeg", price: 8 },
  { id: "honeydew-cup", name: "Honeydew Cup", imageUrl: "/products/fruit8.jpeg", price: 8 },
];

export function DemoOrderForm() {
  const [selectedProductId, setSelectedProductId] = useState(products[0].id);
  const [quantity, setQuantity] = useState(1);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];
  const total = useMemo(() => selectedProduct.price * quantity, [quantity, selectedProduct.price]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = new Date();
    const orderSuffix = String(date.getTime()).slice(-6);
    setOrderNumber(`GM-${date.toISOString().slice(0, 10).replaceAll("-", "")}-${orderSuffix}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (orderNumber) {
    return (
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white px-4 pb-8 pt-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-700">Order submitted</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {orderNumber}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Your order has been received by FreshStack. Please pay with Touch 'n Go and keep the payment screenshot ready for confirmation.
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 p-4">
          <div className="flex gap-3">
            <img
              src={selectedProduct.imageUrl}
              alt={selectedProduct.name}
              className="h-20 w-20 rounded-md object-cover"
            />
            <div>
              <p className="font-semibold text-slate-950">{selectedProduct.name}</p>
              <p className="mt-1 text-sm text-slate-600">Qty {quantity}</p>
              <p className="mt-2 text-lg font-bold text-blue-700">RM {total.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOrderNumber(null)}
          className="mt-5 h-12 w-full rounded-md border border-slate-300 text-base font-semibold text-slate-800"
        >
          Place Another Order
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white px-4 pb-8 pt-4 sm:max-w-2xl sm:px-6 lg:max-w-5xl">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold uppercase text-blue-600">FreshStack Ordering</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
          Gold Marry Fresh Fruits
        </h1>
        <p className="mt-1 text-sm leading-5 text-slate-600">
          Choose your fruit cup and place the order from your phone.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <section>
          <h2 className="text-base font-semibold text-slate-950">Pick Your Fruit</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {products.map((product) => (
              <label key={product.id} className="block cursor-pointer">
                <input
                  name="productId"
                  required
                  type="radio"
                  value={product.id}
                  checked={selectedProductId === product.id}
                  onChange={() => setSelectedProductId(product.id)}
                  className="peer sr-only"
                />
                <span className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition peer-checked:border-blue-600 peer-checked:ring-2 peer-checked:ring-blue-600">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="aspect-square w-full object-cover"
                  />
                  <span className="flex flex-1 flex-col gap-1 p-3">
                    <span className="text-sm font-semibold leading-5 text-slate-950">
                      {product.name}
                    </span>
                    <span className="mt-auto text-base font-bold text-blue-700">
                      RM {product.price.toFixed(2)}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <label className="block flex-1 text-sm font-medium text-slate-700">
              Quantity
              <input
                required
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
                className="mt-1 h-12 w-full rounded-md border border-slate-300 px-3 text-base"
              />
            </label>
            <div className="pt-6 text-right">
              <p className="text-xs font-semibold uppercase text-slate-500">Total</p>
              <p className="text-xl font-bold text-blue-700">RM {total.toFixed(2)}</p>
            </div>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Name
            <input required autoComplete="name" className="mt-1 h-12 w-full rounded-md border border-slate-300 px-3 text-base" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Phone
            <input required inputMode="tel" autoComplete="tel" className="mt-1 h-12 w-full rounded-md border border-slate-300 px-3 text-base" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Delivery Address
            <textarea required rows={3} autoComplete="street-address" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Requested Time
            <input placeholder="Today 2-4pm" className="mt-1 h-12 w-full rounded-md border border-slate-300 px-3 text-base" />
          </label>
        </section>

        <button className="h-12 w-full rounded-md bg-blue-600 px-4 text-base font-semibold text-white shadow-sm">
          Submit Order
        </button>
      </form>
    </section>
  );
}
