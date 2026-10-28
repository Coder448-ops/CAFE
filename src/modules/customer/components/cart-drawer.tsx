"use client";

import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { formatUzs } from "@/shared/lib/money";
import { cartSubtotal, type CartLine } from "@/modules/customer/lib/cart";

export function CartDrawer({
  open,
  cart,
  submitting,
  onClose,
  onChangeQuantity,
  onRemove,
  onSubmit,
}: {
  open: boolean;
  cart: CartLine[];
  submitting: boolean;
  onClose: () => void;
  onChangeQuantity: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onSubmit: () => void;
}) {
  if (!open) return null;
  const subtotal = cartSubtotal(cart);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Savatni yopish"
        onClick={onClose}
        className="absolute inset-0 bg-coffee-900/40 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Savat"
        className="relative flex h-full w-full max-w-md flex-col bg-cream-50 shadow-float animate-slide-up"
      >
        <header className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-coffee-900">Savat</h2>
            <p className="text-xs text-coffee-500">Narxlar serverda qayta tekshiriladi</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Yopish">
            ✕
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-slim">
          {cart.length === 0 ? (
            <EmptyState
              title="Savat bo'sh"
              description="Menyudan taom tanlab, savatga qo'shing."
              icon="🍽"
            />
          ) : (
            <ul className="space-y-3">
              {cart.map((line) => (
                <li key={line.key} className="surface p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-coffee-900">{line.nameUz}</p>
                      {line.optionNames.length > 0 ? (
                        <p className="mt-0.5 text-xs text-coffee-500">{line.optionNames.join(" · ")}</p>
                      ) : null}
                      {line.note ? (
                        <p className="mt-0.5 text-xs italic text-coffee-400">«{line.note}»</p>
                      ) : null}
                      <p className="mt-1 text-xs text-coffee-500">{formatUzs(line.unitPriceTiyin)} dan</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(line.key)}
                      className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-coffee-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`${line.nameUz} ni savatdan olib tashlash`}
                    >
                      O&apos;chirish
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Kamaytirish"
                        onClick={() => onChangeQuantity(line.key, -1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-semibold text-coffee-700 ring-1 ring-coffee-200"
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center font-bold" aria-live="polite">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Ko'paytirish"
                        onClick={() => onChangeQuantity(line.key, 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-semibold text-coffee-700 ring-1 ring-coffee-200"
                      >
                        +
                      </button>
                    </div>
                    <p className="font-semibold text-coffee-900">
                      {formatUzs(line.unitPriceTiyin * line.quantity)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-coffee-100 px-5 pb-[calc(1rem+var(--safe-bottom))] pt-4">
          <div className="flex items-center justify-between text-sm text-coffee-600">
            <span>Jami</span>
            <span className="font-display text-2xl font-semibold text-coffee-900">{formatUzs(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-coffee-400">
            Buyurtma yuborilgandan so&apos;ng narxlar serverda tasdiqlanadi. To&apos;lov kassada amalga oshiriladi.
          </p>
          <Button
            className="mt-4"
            size="xl"
            fullWidth
            loading={submitting}
            disabled={cart.length === 0}
            onClick={onSubmit}
          >
            Buyurtmani yuborish
          </Button>
        </footer>
      </aside>
    </div>
  );
}
