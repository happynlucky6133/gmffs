"use client";

import { FormEvent, useMemo, useState } from "react";
import { GoldMarryBadge } from "./FreshStackLogo";

type FruitProduct = {
  id: string;
  code: string;
  name: string;
  imageUrl: string;
  price: number;
};

const products: FruitProduct[] = [
  { id: "mango-cup", code: "FRUIT-MANGO", name: "Mango Fruit Cup", imageUrl: "/products/fruit1.jpeg", price: 8 },
  { id: "dragonfruit-blueberry", code: "FRUIT-DRAGON-BLUEBERRY", name: "Dragon Fruit Blueberry Cup", imageUrl: "/products/fruit2.jpeg", price: 8 },
  { id: "green-kiwi", code: "FRUIT-GREEN-KIWI", name: "Green Kiwi Cup", imageUrl: "/products/fruit3.jpeg", price: 8 },
  { id: "mango-blueberry", code: "FRUIT-MANGO-BLUEBERRY", name: "Mango Blueberry Cup", imageUrl: "/products/fruit4.jpeg", price: 8 },
  { id: "melon-tomato", code: "FRUIT-MELON-TOMATO", name: "Melon Tomato Cup", imageUrl: "/products/fruit5.jpeg", price: 8 },
  { id: "gold-kiwi", code: "FRUIT-GOLDEN-KIWI", name: "Gold Kiwi Cup", imageUrl: "/products/fruit6.jpeg", price: 8 },
  { id: "orange-cup", code: "FRUIT-ORANGE", name: "Orange Cup", imageUrl: "/products/fruit7.jpeg", price: 8 },
  { id: "honeydew-cup", code: "FRUIT-HONEYDEW", name: "Honeydew Cup", imageUrl: "/products/fruit8.jpeg", price: 8 },
];

export function DemoOrderForm() {
  const [selectedProductId, setSelectedProductId] = useState(products[0].id);
  const [quantity, setQuantity] = useState(1);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [serverTotal, setServerTotal] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? products[0];
  const total = useMemo(() => selectedProduct.price * quantity, [quantity, selectedProduct.price]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/customer-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companySlug: "gm",
          skuCode: selectedProduct.code,
          quantity,
          customerName: formData.get("customerName"),
          customerPhone: formData.get("customerPhone"),
          customerEmail: formData.get("customerEmail"),
          deliveryAddress: formData.get("deliveryAddress"),
          requestedTimeSlot: formData.get("requestedTimeSlot"),
          notes: formData.get("notes"),
        }),
      });

      const payload = (await response.json()) as {
        orderNumber?: string;
        total?: string;
        error?: string;
      };

      if (!response.ok || !payload.orderNumber) {
        throw new Error(payload.error ?? "Unable to create order");
      }

      setOrderNumber(payload.orderNumber);
      setServerTotal(payload.total ?? total.toFixed(2));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to create order. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (orderNumber) {
    return <OrderConfirmation product={selectedProduct} quantity={quantity} total={Number(serverTotal ?? total)} orderNumber={orderNumber} onReset={() => setOrderNumber(null)} />;
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="text-center sm:text-left">
        <GoldMarryBadge />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-fs-text">
          Order Your Fruit Cups
        </h1>
        <p className="mt-2 text-base leading-6 text-fs-muted">
          Pick your favourite fresh fruit cup and we'll deliver it straight to your door.
        </p>
      </div>

      {/* Selected product preview */}
      <div className="overflow-hidden rounded-2xl border border-fs-green-pale/50 bg-fs-card shadow-sm">
        <div className="flex flex-col sm:flex-row">
          <div className="relative aspect-square w-full sm:w-48 sm:shrink-0">
            <img
              src={selectedProduct.imageUrl}
              alt={selectedProduct.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent sm:bg-gradient-to-r sm:from-black/10 sm:to-transparent" />
          </div>
          <div className="flex flex-1 flex-col justify-center p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-fs-green-light">
              Selected
            </p>
            <p className="mt-1 text-xl font-bold text-fs-text">{selectedProduct.name}</p>
            <p className="mt-1 text-2xl font-black text-fs-orange">RM {selectedProduct.price.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product grid */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fs-muted">
            Choose Your Fruit
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => {
              const isSelected = selectedProductId === product.id;
              return (
                <label
                  key={product.id}
                  className={`group relative block cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? "border-fs-green shadow-md shadow-fs-green/10"
                      : "border-fs-green-pale/40 shadow-sm hover:border-fs-green-light/40 hover:shadow-md"
                  }`}
                >
                  <input
                    name="productId"
                    required
                    type="radio"
                    value={product.id}
                    checked={isSelected}
                    onChange={() => setSelectedProductId(product.id)}
                    className="peer sr-only"
                  />
                  {/* Checkmark badge */}
                  {isSelected && (
                    <div className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-fs-green shadow">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <div className="relative aspect-square overflow-hidden bg-fs-green-bg">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className={`h-full w-full object-cover transition-transform duration-300 ${
                          isSelected ? "scale-105" : "group-hover:scale-105"
                        }`}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 p-3">
                      <span className="text-sm font-semibold leading-tight text-fs-text">
                        {product.name}
                      </span>
                      <span className="mt-auto text-base font-bold text-fs-orange">
                        RM {product.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* Order details */}
        <section className="rounded-2xl border border-fs-green-pale/50 bg-fs-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fs-muted">
            Your Details
          </h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex-1">
                <span className="text-sm font-medium text-fs-muted">Quantity</span>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="mt-1 h-11 w-full rounded-lg border border-fs-green-pale/60 bg-white px-3 text-base font-medium text-fs-text transition focus:border-fs-green focus:outline-none focus:ring-2 focus:ring-fs-green/20"
                />
              </label>
              <div className="pt-5 text-right">
                <p className="text-xs font-semibold uppercase text-fs-muted">Total</p>
                <p className="text-xl font-black text-fs-orange">RM {total.toFixed(2)}</p>
              </div>
            </div>

            <div>
              <label className="block">
                <span className="text-sm font-medium text-fs-muted">Name</span>
                <input
                  name="customerName"
                  required
                  autoComplete="name"
                  className="mt-1 h-11 w-full rounded-lg border border-fs-green-pale/60 bg-white px-3 text-base text-fs-text transition focus:border-fs-green focus:outline-none focus:ring-2 focus:ring-fs-green/20"
                />
              </label>
            </div>

            <div>
              <label className="block">
                <span className="text-sm font-medium text-fs-muted">Phone</span>
                <input
                  name="customerPhone"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  className="mt-1 h-11 w-full rounded-lg border border-fs-green-pale/60 bg-white px-3 text-base text-fs-text transition focus:border-fs-green focus:outline-none focus:ring-2 focus:ring-fs-green/20"
                />
              </label>
            </div>

            <div>
              <label className="block">
                <span className="text-sm font-medium text-fs-muted">Email</span>
                <input
                  name="customerEmail"
                  type="email"
                  autoComplete="email"
                  className="mt-1 h-11 w-full rounded-lg border border-fs-green-pale/60 bg-white px-3 text-base text-fs-text transition focus:border-fs-green focus:outline-none focus:ring-2 focus:ring-fs-green/20"
                />
              </label>
            </div>

            <div>
              <label className="block">
                <span className="text-sm font-medium text-fs-muted">Delivery Address</span>
                <textarea
                  name="deliveryAddress"
                  required
                  rows={3}
                  autoComplete="street-address"
                  className="mt-1 w-full rounded-lg border border-fs-green-pale/60 bg-white px-3 py-3 text-base text-fs-text transition focus:border-fs-green focus:outline-none focus:ring-2 focus:ring-fs-green/20"
                />
              </label>
            </div>

            <div>
              <label className="block">
                <span className="text-sm font-medium text-fs-muted">Requested Time</span>
                <input
                  name="requestedTimeSlot"
                  placeholder="Today 2–4pm"
                  className="mt-1 h-11 w-full rounded-lg border border-fs-green-pale/60 bg-white px-3 text-base text-fs-text transition focus:border-fs-green focus:outline-none focus:ring-2 focus:ring-fs-green/20"
                />
              </label>
            </div>

            <div>
              <label className="block">
                <span className="text-sm font-medium text-fs-muted">Notes</span>
                <textarea
                  name="notes"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-fs-green-pale/60 bg-white px-3 py-3 text-base text-fs-text transition focus:border-fs-green focus:outline-none focus:ring-2 focus:ring-fs-green/20"
                />
              </label>
            </div>
          </div>
        </section>

        {submitError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {submitError}
          </p>
        ) : null}

        {/* Submit button */}
        <button
          disabled={isSubmitting}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-fs-green px-6 text-base font-bold text-white shadow-lg shadow-fs-green/20 transition-all hover:bg-fs-green-light hover:shadow-xl hover:shadow-fs-green/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Placing Order..." : `Place Order — RM ${total.toFixed(2)}`}
        </button>
      </form>

      <p className="text-center text-xs text-fs-muted/60">
        By placing this order you agree to FreshStack's Terms of Service.
      </p>
    </div>
  );
}

// ─── Order Confirmation ──────────────────────────────────────

function OrderConfirmation({
  product,
  quantity,
  total,
  orderNumber,
  onReset,
}: {
  product: FruitProduct;
  quantity: number;
  total: number;
  orderNumber: string;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-fs-green-bg">
          <svg className="h-8 w-8 text-fs-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-fs-text">Order Placed! 🎉</h1>
        <p className="mt-2 text-fs-muted">
          Your order has been received by FreshStack. Please pay with <strong>Touch &apos;n Go</strong> and keep the screenshot ready.
        </p>
      </div>

      {/* Order card */}
      <div className="overflow-hidden rounded-2xl border border-fs-green-pale/50 bg-fs-card shadow-sm">
        <div className="bg-gradient-to-r from-fs-green to-fs-green-light p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Order Number</p>
          <p className="mt-1 text-xl font-bold tracking-wide text-white">{orderNumber}</p>
        </div>
        <div className="p-5">
          <div className="flex gap-4">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-20 w-20 rounded-xl object-cover shadow-sm"
            />
            <div className="flex-1">
              <p className="font-semibold text-fs-text">{product.name}</p>
              <p className="mt-0.5 text-sm text-fs-muted">Qty {quantity}</p>
              <p className="mt-2 text-xl font-black text-fs-orange">RM {total.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment instructions */}
      <div className="rounded-2xl border border-fs-gold/40 bg-fs-warm p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg">💳</span>
          <div>
            <p className="font-semibold text-fs-text">Payment Instructions</p>
            <p className="mt-1 text-sm leading-6 text-fs-muted">
              Pay <strong>RM {total.toFixed(2)}</strong> via Touch &apos;n Go to the number shown at the counter. Take a screenshot of your payment confirmation and upload it on the order tracking page.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-fs-green-pale/60 bg-fs-card text-base font-semibold text-fs-green transition hover:bg-fs-green-bg active:scale-[0.98]"
      >
        Place Another Order
      </button>
    </div>
  );
}
