"use client";

import * as React from "react";
import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/field";
import { formatUzs } from "@/shared/lib/money";
import { lineKey, MAX_QUANTITY_PER_LINE, type CartLine } from "@/modules/customer/lib/cart";
import type { Product } from "@/shared/types/domain";

export function ProductDialog({
  product,
  onClose,
  onAdd,
}: {
  product: Product | null;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
}) {
  const [selected, setSelected] = React.useState<number[]>([]);
  const [quantity, setQuantity] = React.useState(1);
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (!product) return;
    const defaults = product.optionGroups.flatMap((group) =>
      group.options.filter((option) => option.isDefault).map((option) => option.id),
    );
    setSelected(defaults);
    setQuantity(1);
    setNote("");
  }, [product]);

  if (!product) return null;

  const selectedOptions = product.optionGroups.flatMap((group) =>
    group.options.filter((option) => selected.includes(option.id)),
  );
  const delta = selectedOptions.reduce((total, option) => total + option.priceDeltaTiyin, 0);
  const unitPrice = product.priceTiyin + delta;

  const missingRequired = product.optionGroups.filter(
    (group) => group.required && !group.options.some((option) => selected.includes(option.id)),
  );

  function toggle(groupId: number, optionId: number, maxSelect: number) {
    setSelected((current) => {
      const group = product!.optionGroups.find((candidate) => candidate.id === groupId);
      if (!group) return current;
      const groupOptionIds = group.options.map((option) => option.id);
      const alreadySelected = current.includes(optionId);

      if (maxSelect === 1) {
        return [...current.filter((id) => !groupOptionIds.includes(id)), optionId];
      }
      if (alreadySelected) return current.filter((id) => id !== optionId);
      const selectedInGroup = current.filter((id) => groupOptionIds.includes(id));
      if (selectedInGroup.length >= maxSelect) return current;
      return [...current, optionId];
    });
  }

  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      title={product.nameUz}
      description={product.descriptionUz ?? undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            onClick={() =>
              onAdd({
                key: lineKey(product.id, selected, note.trim() || null),
                productId: product.id,
                nameUz: product.nameUz,
                unitPriceTiyin: unitPrice,
                quantity,
                optionIds: selected,
                optionNames: selectedOptions.map((option) => option.nameUz),
                note: note.trim() || null,
              })
            }
            disabled={missingRequired.length > 0}
          >
            Savatga — {formatUzs(unitPrice * quantity)}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {product.optionGroups.map((group) => (
          <fieldset key={group.id}>
            <legend className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-coffee-800">
              <span>
                {group.nameUz}
                {group.required ? <span className="text-terracotta-500"> *</span> : null}
              </span>
              <span className="text-xs font-normal text-coffee-400">
                {group.maxSelect > 1 ? `Ko'pi bilan ${group.maxSelect} ta` : "Bittasini tanlang"}
              </span>
            </legend>
            <div className="space-y-2">
              {group.options.map((option) => {
                const active = selected.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role={group.maxSelect > 1 ? "checkbox" : "radio"}
                    aria-checked={active}
                    onClick={() => toggle(group.id, option.id, group.maxSelect)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition ${
                      active
                        ? "border-moss-500 bg-moss-50 text-coffee-900"
                        : "border-coffee-200 bg-white text-coffee-700 hover:border-coffee-300"
                    }`}
                  >
                    <span className="font-medium">{option.nameUz}</span>
                    <span className="text-xs text-coffee-500">
                      {option.priceDeltaTiyin > 0 ? `+ ${formatUzs(option.priceDeltaTiyin)}` : "0 so'm"}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div>
          <label className="label-base" htmlFor="item-note">
            Izoh (ixtiyoriy)
          </label>
          <Textarea
            id="item-note"
            value={note}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Masalan: shakarsiz, alohida sous bilan"
            className="min-h-16"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-cream-100 px-3 py-2.5">
          <span className="text-sm font-semibold text-coffee-700">Miqdor</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Kamaytirish"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-semibold text-coffee-700 ring-1 ring-coffee-200 disabled:opacity-40"
              disabled={quantity <= 1}
            >
              −
            </button>
            <span className="min-w-6 text-center text-base font-bold" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Ko'paytirish"
              onClick={() => setQuantity((current) => Math.min(MAX_QUANTITY_PER_LINE, current + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-semibold text-coffee-700 ring-1 ring-coffee-200 disabled:opacity-40"
              disabled={quantity >= MAX_QUANTITY_PER_LINE}
            >
              +
            </button>
          </div>
        </div>

        {missingRequired.length > 0 ? (
          <p role="alert" className="text-xs font-medium text-terracotta-600">
            Tanlash kerak: {missingRequired.map((group) => group.nameUz).join(", ")}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
