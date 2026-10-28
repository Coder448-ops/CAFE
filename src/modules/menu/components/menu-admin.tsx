"use client";

import * as React from "react";
import { useApi } from "@/shared/hooks/useApi";
import { apiFetch, errorMessage } from "@/modules/shared/api";
import { useToast } from "@/shared/components/ui/toast";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Field, Input, Select, Switch, Textarea } from "@/shared/components/ui/field";
import { ConfirmDialog, Modal } from "@/shared/components/ui/modal";
import { EmptyState, ErrorState, Skeleton } from "@/shared/components/ui/empty-state";
import { formatUzs, parseSomInput } from "@/shared/lib/money";
import type { MenuCategory, Product } from "@/shared/types/domain";

type MenuResponse = { categories: MenuCategory[]; products: Product[] };
type ProductDraft = {
  id: number | null;
  nameUz: string;
  categoryId: number;
  descriptionUz: string;
  priceSom: string;
  imageUrl: string;
  station: "kitchen" | "bar" | "none";
  prepMinutes: string;
  isActive: boolean;
  isAvailable: boolean;
  sortOrder: string;
};
type CategoryDraft = {
  id: number | null;
  nameUz: string;
  slug: string;
  descriptionUz: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyProduct = (categoryId: number): ProductDraft => ({
  id: null,
  nameUz: "",
  categoryId,
  descriptionUz: "",
  priceSom: "",
  imageUrl: "",
  station: "kitchen",
  prepMinutes: "10",
  isActive: true,
  isAvailable: true,
  sortOrder: "0",
});

export function MenuAdmin() {
  const toast = useToast();
  const menu = useApi<MenuResponse>("/api/staff/menu");
  const [productDraft, setProductDraft] = React.useState<ProductDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = React.useState<CategoryDraft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<Product | null>(null);
  const [filterCategory, setFilterCategory] = React.useState<number | "all">("all");

  const categories = menu.data?.categories ?? [];
  const products = (menu.data?.products ?? []).filter(
    (product) => filterCategory === "all" || product.categoryId === filterCategory,
  );

  function openProduct(product?: Product) {
    setFormError(null);
    if (!product) {
      setProductDraft(emptyProduct(categories[0]?.id ?? 0));
      return;
    }
    setProductDraft({
      id: product.id,
      nameUz: product.nameUz,
      categoryId: product.categoryId,
      descriptionUz: product.descriptionUz ?? "",
      priceSom: String(Math.round(product.priceTiyin / 100)),
      imageUrl: product.imageUrl ?? "",
      station: product.station,
      prepMinutes: String(product.prepMinutes),
      isActive: product.isActive,
      isAvailable: product.isAvailable,
      sortOrder: String(product.sortOrder),
    });
  }

  async function saveProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!productDraft) return;
    setFormError(null);
    const priceTiyin = parseSomInput(productDraft.priceSom);
    if (priceTiyin === null) {
      setFormError("Narxni to'g'ri kiriting (masalan: 32000)");
      return;
    }
    if (!productDraft.categoryId) {
      setFormError("Kategoriyani tanlang");
      return;
    }
    setSaving(true);
    try {
      const body = {
        categoryId: productDraft.categoryId,
        nameUz: productDraft.nameUz,
        descriptionUz: productDraft.descriptionUz || null,
        priceTiyin,
        imageUrl: productDraft.imageUrl || null,
        station: productDraft.station,
        prepMinutes: Number(productDraft.prepMinutes) || 0,
        isActive: productDraft.isActive,
        isAvailable: productDraft.isAvailable,
        sortOrder: Number(productDraft.sortOrder) || 0,
      };
      if (productDraft.id) {
        await apiFetch(`/api/staff/menu/products/${productDraft.id}`, { method: "PATCH", body });
        toast.success("Mahsulot saqlandi. Oldingi buyurtmalar narxi o'zgarmaydi.");
      } else {
        await apiFetch("/api/staff/menu/products", { method: "POST", body });
        toast.success("Mahsulot qo'shildi");
      }
      setProductDraft(null);
      await menu.refresh({ silent: true });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(product: Product) {
    try {
      await apiFetch(`/api/staff/menu/products/${product.id}/availability`, {
        method: "POST",
        body: { isAvailable: !product.isAvailable },
      });
      await menu.refresh({ silent: true });
      toast.success(`${product.nameUz} ${product.isAvailable ? "sotuvdan olindi" : "sotuvga qaytdi"}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function archiveProduct() {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/api/staff/menu/products/${archiveTarget.id}`, { method: "DELETE" });
      toast.success("Mahsulot arxivlandi");
      setArchiveTarget(null);
      await menu.refresh({ silent: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!categoryDraft) return;
    setFormError(null);
    setSaving(true);
    try {
      const body = {
        nameUz: categoryDraft.nameUz,
        slug: categoryDraft.slug,
        descriptionUz: categoryDraft.descriptionUz || null,
        sortOrder: Number(categoryDraft.sortOrder) || 0,
        isActive: categoryDraft.isActive,
      };
      if (categoryDraft.id) {
        await apiFetch(`/api/staff/menu/categories/${categoryDraft.id}`, { method: "PATCH", body });
        toast.success("Kategoriya saqlandi");
      } else {
        await apiFetch("/api/staff/menu/categories", { method: "POST", body });
        toast.success("Kategoriya qo'shildi");
      }
      setCategoryDraft(null);
      await menu.refresh({ silent: true });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-coffee-900">Menyu boshqaruvi</h1>
          <p className="text-sm text-coffee-500">
            Narx o&apos;zgarishi faqat yangi buyurtmalarga ta&apos;sir qiladi — tarix saqlanadi
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setCategoryDraft({ id: null, nameUz: "", slug: "", descriptionUz: "", sortOrder: "0", isActive: true })
            }
          >
            Kategoriya qo&apos;shish
          </Button>
          <Button onClick={() => openProduct()} disabled={categories.length === 0}>
            Mahsulot qo&apos;shish
          </Button>
        </div>
      </div>

      {menu.error ? <ErrorState message={menu.error} onRetry={() => void menu.refresh()} /> : null}
      {menu.loading && !menu.data ? <Skeleton className="h-72" /> : null}

      {categories.length === 0 && menu.data ? (
        <EmptyState
          title="Kategoriya yo'q"
          description="Avval kategoriya yarating, keyin mahsulot qo'shing."
          action={<Button onClick={() => setCategoryDraft({ id: null, nameUz: "", slug: "", descriptionUz: "", sortOrder: "0", isActive: true })}>Kategoriya qo&apos;shish</Button>}
        />
      ) : null}

      {menu.data ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterCategory("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                filterCategory === "all" ? "bg-coffee-800 text-cream-50" : "bg-cream-200 text-coffee-600"
              }`}
            >
              Barchasi
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setFilterCategory(category.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  filterCategory === category.id ? "bg-coffee-800 text-cream-50" : "bg-cream-200 text-coffee-600"
                }`}
              >
                {category.nameUz} · {category.productCount}
              </button>
            ))}
          </div>

          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-coffee-500">
                <tr>
                  <th className="px-4 py-3">Mahsulot</th>
                  <th className="px-4 py-3">Kategoriya</th>
                  <th className="px-4 py-3 text-right">Narx</th>
                  <th className="px-4 py-3">Stansiya</th>
                  <th className="px-4 py-3">Sotuvda</th>
                  <th className="px-4 py-3">Holat</th>
                  <th className="px-4 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t border-coffee-100">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-coffee-900">{product.nameUz}</p>
                      <p className="text-xs text-coffee-400">
                        {product.prepMinutes} daq · {product.optionGroups.length} qo&apos;shimcha guruh
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-coffee-600">
                      {categories.find((category) => category.id === product.categoryId)?.nameUz ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatUzs(product.priceTiyin)}</td>
                    <td className="px-4 py-2.5 text-coffee-600">
                      {product.station === "bar" ? "Bar" : product.station === "kitchen" ? "Oshxona" : "Yo'q"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Switch
                        checked={product.isAvailable}
                        onChange={() => void toggleAvailability(product)}
                        label={`${product.nameUz} sotuvda`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      {product.isActive ? <Badge tone="success">Faol</Badge> : <Badge tone="muted">Arxiv</Badge>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openProduct(product)}>
                          Tahrir
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setArchiveTarget(product)}>
                          Arxiv
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-coffee-400">
                      Bu kategoriyada mahsulot yo&apos;q.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <section className="mt-5">
            <h2 className="mb-2 font-display text-lg font-semibold text-coffee-900">Kategoriyalar</h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => (
                <div key={category.id} className="surface flex items-center justify-between gap-2 p-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-coffee-900">{category.nameUz}</p>
                    <p className="text-xs text-coffee-400">
                      /{category.slug} · {category.productCount} mahsulot
                      {category.isActive ? "" : " · arxiv"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setCategoryDraft({
                        id: category.id,
                        nameUz: category.nameUz,
                        slug: category.slug,
                        descriptionUz: category.descriptionUz ?? "",
                        sortOrder: String(category.sortOrder),
                        isActive: category.isActive,
                      })
                    }
                  >
                    Tahrir
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <Modal
        open={Boolean(productDraft)}
        onClose={() => setProductDraft(null)}
        title={productDraft?.id ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setProductDraft(null)} disabled={saving}>
              Bekor qilish
            </Button>
            <Button type="submit" form="product-form" loading={saving}>
              Saqlash
            </Button>
          </>
        }
      >
        {productDraft ? (
          <form id="product-form" onSubmit={saveProduct} className="grid gap-3 sm:grid-cols-2">
            <Field label="Nomi" htmlFor="p-name" className="sm:col-span-2">
              <Input
                id="p-name"
                required
                minLength={2}
                value={productDraft.nameUz}
                onChange={(event) => setProductDraft({ ...productDraft, nameUz: event.target.value })}
              />
            </Field>
            <Field label="Kategoriya" htmlFor="p-category">
              <Select
                id="p-category"
                value={productDraft.categoryId}
                onChange={(event) => setProductDraft({ ...productDraft, categoryId: Number(event.target.value) })}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nameUz}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Narx (so'm)" htmlFor="p-price">
              <Input
                id="p-price"
                required
                inputMode="numeric"
                value={productDraft.priceSom}
                onChange={(event) => setProductDraft({ ...productDraft, priceSom: event.target.value })}
                placeholder="32000"
              />
            </Field>
            <Field label="Tavsif" htmlFor="p-description" className="sm:col-span-2">
              <Textarea
                id="p-description"
                value={productDraft.descriptionUz}
                onChange={(event) => setProductDraft({ ...productDraft, descriptionUz: event.target.value })}
                className="min-h-16"
              />
            </Field>
            <Field label="Rasm manzili (ixtiyoriy)" htmlFor="p-image" className="sm:col-span-2" hint="/menu/... yoki https://...">
              <Input
                id="p-image"
                value={productDraft.imageUrl}
                onChange={(event) => setProductDraft({ ...productDraft, imageUrl: event.target.value })}
              />
            </Field>
            <Field label="Tayyorlash bo'limi" htmlFor="p-station">
              <Select
                id="p-station"
                value={productDraft.station}
                onChange={(event) =>
                  setProductDraft({ ...productDraft, station: event.target.value as ProductDraft["station"] })
                }
              >
                <option value="kitchen">Oshxona</option>
                <option value="bar">Bar</option>
                <option value="none">Biletsiz (tayyor)</option>
              </Select>
            </Field>
            <Field label="Tayyorlash vaqti (daqiqa)" htmlFor="p-prep">
              <Input
                id="p-prep"
                inputMode="numeric"
                value={productDraft.prepMinutes}
                onChange={(event) => setProductDraft({ ...productDraft, prepMinutes: event.target.value })}
              />
            </Field>
            <div className="flex items-center gap-3">
              <Switch
                checked={productDraft.isActive}
                onChange={(value) => setProductDraft({ ...productDraft, isActive: value })}
                label="Faol"
              />
              <span className="text-sm text-coffee-700">Faol</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={productDraft.isAvailable}
                onChange={(value) => setProductDraft({ ...productDraft, isAvailable: value })}
                label="Sotuvda"
              />
              <span className="text-sm text-coffee-700">Sotuvda mavjud</span>
            </div>
            {formError ? (
              <p role="alert" className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            ) : null}
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(categoryDraft)}
        onClose={() => setCategoryDraft(null)}
        title={categoryDraft?.id ? "Kategoriyani tahrirlash" : "Yangi kategoriya"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCategoryDraft(null)} disabled={saving}>
              Bekor qilish
            </Button>
            <Button type="submit" form="category-form" loading={saving}>
              Saqlash
            </Button>
          </>
        }
      >
        {categoryDraft ? (
          <form id="category-form" onSubmit={saveCategory} className="space-y-3">
            <Field label="Nomi" htmlFor="c-name">
              <Input
                id="c-name"
                required
                minLength={2}
                value={categoryDraft.nameUz}
                onChange={(event) => setCategoryDraft({ ...categoryDraft, nameUz: event.target.value })}
              />
            </Field>
            <Field label="Slug" htmlFor="c-slug" hint="Faqat kichik lotin harflari va '-'">
              <Input
                id="c-slug"
                required
                pattern="[a-z0-9-]+"
                value={categoryDraft.slug}
                onChange={(event) => setCategoryDraft({ ...categoryDraft, slug: event.target.value })}
              />
            </Field>
            <Field label="Tavsif" htmlFor="c-description">
              <Input
                id="c-description"
                value={categoryDraft.descriptionUz}
                onChange={(event) => setCategoryDraft({ ...categoryDraft, descriptionUz: event.target.value })}
              />
            </Field>
            <div className="flex items-center gap-3">
              <Switch
                checked={categoryDraft.isActive}
                onChange={(value) => setCategoryDraft({ ...categoryDraft, isActive: value })}
                label="Faol"
              />
              <span className="text-sm text-coffee-700">Faol</span>
            </div>
            {formError ? (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            ) : null}
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Mahsulotni arxivlash"
        description={`"${archiveTarget?.nameUz ?? ""}" sotuvdan olib tashlanadi. Tarixiy buyurtmalar o'zgarmaydi.`}
        confirmLabel="Arxivlash"
        destructive
        loading={saving}
        onConfirm={() => void archiveProduct()}
        onClose={() => setArchiveTarget(null)}
      />
    </div>
  );
}
