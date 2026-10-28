import { notFound, redirect } from "next/navigation";
import { getCurrentStaff, POS_ROLES } from "@/server/auth/session";
import { findOrder } from "@/server/services/orders";
import { getSettings } from "@/server/services/settings";
import { formatUzs } from "@/shared/lib/money";
import { formatDateTime } from "@/shared/lib/datetime";
import { PAYMENT_METHOD_LABELS } from "@/shared/constants/orders";
import { PrintButton } from "@/modules/cashier/components/print-button";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (!POS_ROLES.includes(staff.user.role)) redirect("/kitchen");

  const { id } = await params;
  const order = findOrder(Number(id));
  if (!order) notFound();
  const settings = getSettings();

  return (
    <main className="min-h-dvh bg-cream-200 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-sm">
        <div className="mb-4 flex justify-center gap-2 no-print">
          <PrintButton />
        </div>

        <article className="print-area mx-auto rounded-lg bg-white p-6 font-mono text-[12px] leading-relaxed text-coffee-900 shadow-card print:shadow-none">
          <header className="text-center">
            <h1 className="font-display text-xl font-bold tracking-wide">{settings.restaurantName}</h1>
            <p className="mt-1 text-[11px]">{settings.address}</p>
            <p className="text-[11px]">{settings.phone}</p>
          </header>

          <div className="my-3 border-t border-dashed border-coffee-300" />

          <div className="space-y-0.5 text-[11px]">
            <p className="flex justify-between">
              <span>Buyurtma</span>
              <span className="font-bold">#{order.orderNumber}</span>
            </p>
            <p className="flex justify-between">
              <span>Stol</span>
              <span>
                {order.tableLabel} ({order.tableCode})
              </span>
            </p>
            <p className="flex justify-between">
              <span>Sana</span>
              <span>{formatDateTime(order.createdAt)}</span>
            </p>
            <p className="flex justify-between">
              <span>Kassir</span>
              <span>{staff.user.fullName}</span>
            </p>
          </div>

          <div className="my-3 border-t border-dashed border-coffee-300" />

          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left">
                <th className="pb-1 font-semibold">Nomi</th>
                <th className="pb-1 text-center font-semibold">Soni</th>
                <th className="pb-1 text-right font-semibold">Summa</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="py-0.5">
                    {item.productName}
                    {item.options.length > 0 ? (
                      <span className="block text-[10px] text-coffee-500">
                        {item.options.map((option) => option.optionName).join(", ")}
                      </span>
                    ) : null}
                    {item.note ? <span className="block text-[10px] italic">«{item.note}»</span> : null}
                  </td>
                  <td className="py-0.5 text-center">{item.quantity}</td>
                  <td className="py-0.5 text-right">{formatUzs(item.lineTotalTiyin, { withCurrency: false })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="my-3 border-t border-dashed border-coffee-300" />

          <div className="space-y-0.5 text-[11px]">
            <p className="flex justify-between">
              <span>Taomlar</span>
              <span>{formatUzs(order.subtotalTiyin)}</span>
            </p>
            {order.totalTiyin - order.subtotalTiyin > 0 ? (
              <p className="flex justify-between">
                <span>Xizmat haqi</span>
                <span>{formatUzs(order.totalTiyin - order.subtotalTiyin)}</span>
              </p>
            ) : null}
            <p className="flex justify-between text-sm font-bold">
              <span>JAMI</span>
              <span>{formatUzs(order.totalTiyin)}</span>
            </p>
            <p className="flex justify-between">
              <span>To&apos;langan</span>
              <span>{formatUzs(order.paidTiyin)}</span>
            </p>
            {order.dueTiyin > 0 ? (
              <p className="flex justify-between font-semibold">
                <span>QARZ</span>
                <span>{formatUzs(order.dueTiyin)}</span>
              </p>
            ) : null}
          </div>

          {order.payments.length > 0 ? (
            <>
              <div className="my-3 border-t border-dashed border-coffee-300" />
              <div className="space-y-0.5 text-[11px]">
                {order.payments.map((payment) => (
                  <p key={payment.id} className="flex justify-between">
                    <span>{PAYMENT_METHOD_LABELS[payment.method]}</span>
                    <span>{formatUzs(payment.amountTiyin)}</span>
                  </p>
                ))}
              </div>
            </>
          ) : null}

          <div className="my-3 border-t border-dashed border-coffee-300" />
          <p className="text-center text-[11px]">{settings.receiptFooter}</p>
          <p className="mt-2 text-center text-[10px] text-coffee-400">
            Bu chek emas, hisob-faktura nusxasi. Soliq organlari uchun rasmiy hujjat emas.
          </p>
        </article>
      </div>
    </main>
  );
}
