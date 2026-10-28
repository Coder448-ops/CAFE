"use client";

import * as React from "react";
import Link from "next/link";
import { useApi } from "@/shared/hooks/useApi";
import { useRealtime } from "@/shared/hooks/useRealtime";
import { apiFetch, errorMessage } from "@/modules/shared/api";
import { useToast } from "@/shared/components/ui/toast";
import { ConnectionBadge } from "@/shared/components/ui/connection-badge";
import { Button } from "@/shared/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/shared/components/ui/empty-state";
import { formatUzs } from "@/shared/lib/money";
import { newRequestId } from "@/shared/lib/requestId";
import type { MenuCategory, Product, TableDeviceContext } from "@/shared/types/domain";
import {
  addLine,
  cartCount,
  cartSubtotal,
  changeQuantity,
  isEmpty,
  lineKey,
  removeLine,
  toOrderItems,
  type CartLine,
} from "@/modules/customer/lib/cart";
import { ProductDialog } from "@/modules/customer/components/product-dialog";
import { CartDrawer } from "@/modules/customer/components/cart-drawer";
import { CustomerOrders } from "@/modules/customer/components/customer-orders";

type MenuResponse = { categories: MenuCategory[]; products: Product[] };
type ContextResponse = { context: TableDeviceContext; settings: { restaurantName: string } };

export function CustomerApp({ tableLabel, tableCode }: { tableLabel: string; tableCode: string }) {
  const toast = useToast();
  const menu = useApi<MenuResponse>("/api/table/menu");
  const table = useApi<ContextResponse>("/api/table/context", { pollMs: 45_000 });

  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [activeCategory, setActiveCategory] = React.useState<number | "all">("all");
  const [dialogProduct, setDialogProduct] = React.useState<Product | null>(null);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [ordersOpen, setOrdersOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const requestIdRef = React.useRef(newRequestId());

  // Customer devices must subscribe to their own table scope, never the staff stream.
  const { state: connectionState } = useRealtime(
    () => {
      void table.refresh({ silent: true });
    },
    { path: "/api/table/events" },
  );

  // Restore the cart from this browser tab only (never used as the source of truth).
  React.useEffect(() => {
    const saved = sessionStorage.getItem("lola.cart");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as CartLine[];
      if (Array.isArray(parsed)) setCart(parsed.filter((line) => line.quantity > 0));
    } catch {
      sessionStorage.removeItem("lola.cart");
    }
  }, []);

  React.useEffect(() => {
    sessionStorage.setItem("lola.cart", JSON.stringify(cart));
  }, [cart]);

  const products = React.useMemo(() => menu.data?.products ?? [], [menu.data]);
  const categories = React.useMemo(() => menu.data?.categories ?? [], [menu.data]);
  const visibleProducts =
    activeCategory === "all" ? products : products.filter((product) => product.categoryId === activeCategory);
  const grouped = React.useMemo(() => {
    return categories
      .map((category) => ({
        category,
        products: visibleProducts.filter((product) => product.categoryId === category.id),
      }))
      .filter((group) => group.products.length > 0);
  }, [categories, visibleProducts]);

  const count = cartCount(cart);
  const subtotal = cartSubtotal(cart);
  const orders = (table.data?.context.orders ?? []).filter((order) => order.status !== "cancelled");
  const activeOrders = orders.filter(
    (order) => !["completed", "cancelled"].includes(order.status),
  );

  function quickAdd(product: Product) {
    if (product.optionGroups.length > 0) {
      setDialogProduct(product);
      return;
    }
    setCart((current) =>
      addLine(current, {
        key: lineKey(product.id, [], null),
        productId: product.id,
        nameUz: product.nameUz,
        unitPriceTiyin: product.priceTiyin,
        quantity: 1,
        optionIds: [],
        optionNames: [],
        note: null,
      }),
    );
    toast.push(`${product.nameUz} savatga qo'shildi`);
  }

  function addConfigured(line: CartLine) {
    setCart((current) => addLine(current, line));
    toast.push(`${line.nameUz} savatga qo'shildi`);
  }

  async function submitOrder() {
    if (isEmpty(cart)) {
      toast.error("Savat bo'sh — avval taom tanlang");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<{ order: { orderNumber: number }; message: string }>(
        "/api/table/orders",
        {
          method: "POST",
          body: {
            items: toOrderItems(cart),
            clientRequestId: requestIdRef.current,
          },
        },
      );
      toast.success(result.message);
      setCart([]);
      requestIdRef.current = newRequestId();
      setCartOpen(false);
      setOrdersOpen(true);
      await table.refresh({ silent: true });
    } catch (error) {
      toast.error(errorMessage(error));
      await table.refresh({ silent: true });
    } finally {
      setSubmitting(false);
    }
  }

  async function requestBill() {
    try {
      const result = await apiFetch<{ message: string }>("/api/table/bill-request", { method: "POST" });
      toast.success(result.message);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const unauthorised = table.error?.includes("ulanmagan") || menu.error?.includes("ulanmagan");

  return (
    <div className="min-h-dvh bg-cream-100 pb-32">
      <header className="sticky top-0 z-30 border-b border-coffee-100 bg-cream-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-coffee-800 font-display text-sm font-bold text-cream-50">
              LC
            </span>
            <div>
              <p className="font-display text-base font-semibold leading-tight text-coffee-900">LOLA CAFE</p>
              <p className="text-xs text-coffee-500">
                {tableLabel} · {tableCode}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionBadge state={connectionState} />
            <Button variant="outline" size="sm" onClick={() => setOrdersOpen(true)}>
              Buyurtmalarim
              {activeOrders.length > 0 ? (
                <span className="ml-1 rounded-full bg-moss-600 px-1.5 text-[11px] font-bold text-white">
                  {activeOrders.length}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-5 sm:px-6">
        {unauthorised ? (
          <ErrorState
            message="Bu qurilma stolga ulanmagan. Iltimos, qayta ulang."
            onRetry={() => window.location.assign("/pair")}
          />
        ) : null}

        {menu.error && !unauthorised ? (
          <ErrorState message={menu.error} onRetry={() => void menu.refresh()} />
        ) : null}

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-slim" role="tablist" aria-label="Menyu bo'limlari">
          <CategoryChip
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
            label="Barchasi"
          />
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              active={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
              label={category.nameUz}
            />
          ))}
        </div>

        {menu.loading && !menu.data ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-40" />
            ))}
          </div>
        ) : null}

        {!menu.loading && visibleProducts.length === 0 ? (
          <EmptyState
            className="mt-6"
            title="Bu bo'limda taomlar yo'q"
            description="Boshqa bo'limni tanlang yoki birozdan so'ng qayta tekshiring."
          />
        ) : null}

        <div className="space-y-8 pt-2">
          {grouped.map((group) => (
            <section key={group.category.id} aria-labelledby={`cat-${group.category.id}`}>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 id={`cat-${group.category.id}`} className="font-display text-xl font-semibold text-coffee-900">
                    {group.category.nameUz}
                  </h2>
                  {group.category.descriptionUz ? (
                    <p className="text-sm text-coffee-400">{group.category.descriptionUz}</p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.products.map((product) => (
                  <ProductCard key={product.id} product={product} onAdd={() => quickAdd(product)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-coffee-100 bg-cream-50/95 px-4 pb-[calc(0.75rem+var(--safe-bottom))] pt-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div>
              <p className="text-xs text-coffee-400">{count} ta mahsulot</p>
              <p className="font-display text-lg font-semibold text-coffee-900">{formatUzs(subtotal)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={requestBill}>
                Hisobni so&apos;rash
              </Button>
              <Button onClick={() => setCartOpen(true)}>Savatni ko&apos;rish</Button>
            </div>
          </div>
        </div>
      ) : null}

      <ProductDialog
        product={dialogProduct}
        onClose={() => setDialogProduct(null)}
        onAdd={(line) => {
          addConfigured(line);
          setDialogProduct(null);
        }}
      />

      <CartDrawer
        open={cartOpen}
        cart={cart}
        submitting={submitting}
        onClose={() => setCartOpen(false)}
        onChangeQuantity={(key, delta) => setCart((current) => changeQuantity(current, key, delta))}
        onRemove={(key) => setCart((current) => removeLine(current, key))}
        onSubmit={submitOrder}
      />

      <CustomerOrders
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        orders={orders}
        loading={table.loading && !table.data}
        dueTiyin={table.data?.context.dueTiyin ?? 0}
        totalTiyin={table.data?.context.totalTiyin ?? 0}
        paidTiyin={table.data?.context.paidTiyin ?? 0}
        onRefresh={() => void table.refresh()}
        onRequestBill={requestBill}
      />

      <footer className="mx-auto mt-10 max-w-5xl px-4 text-center text-xs text-coffee-400 sm:px-6">
        {table.data?.settings.restaurantName ?? "LOLA CAFE"} · Narxlar UZS da ·{" "}
        <Link href="/pair" className="underline hover:text-coffee-600">
          qurilmani almashtirish
        </Link>
      </footer>
    </div>
  );
}

function CategoryChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "shrink-0 rounded-full bg-coffee-800 px-4 py-2 text-sm font-semibold text-cream-50"
          : "shrink-0 rounded-full bg-cream-50 px-4 py-2 text-sm font-semibold text-coffee-600 ring-1 ring-coffee-200 hover:bg-cream-200"
      }
    >
      {label}
    </button>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const [imageFailed, setImageFailed] = React.useState(false);
  return (
    <article className="group surface flex overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="font-display text-base font-semibold leading-snug text-coffee-900">{product.nameUz}</h3>
          {product.descriptionUz ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-coffee-500">{product.descriptionUz}</p>
          ) : null}
          {!product.isAvailable ? (
            <p className="mt-2 inline-block rounded bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
              Vaqtincha mavjud emas
            </p>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-coffee-900">{formatUzs(product.priceTiyin)}</p>
          <button
            type="button"
            onClick={onAdd}
            disabled={!product.isAvailable}
            aria-label={`${product.nameUz} savatga qo'shish`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-moss-600 text-xl font-semibold text-white transition hover:bg-moss-700 disabled:cursor-not-allowed disabled:bg-coffee-200"
          >
            +
          </button>
        </div>
      </div>
      <div className="relative hidden w-28 shrink-0 overflow-hidden bg-cream-200 sm:block">
        {product.imageUrl && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.nameUz}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-2xl text-coffee-300" aria-hidden>
            {product.nameUz.slice(0, 1)}
          </div>
        )}
      </div>
    </article>
  );
}
