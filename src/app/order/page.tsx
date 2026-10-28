import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TABLE_DEVICE_COOKIE } from "@/server/auth/session";
import { resolveDeviceToken } from "@/server/services/tables";
import { CustomerApp } from "@/modules/customer/components/customer-app";

export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const store = await cookies();
  const device = resolveDeviceToken(store.get(TABLE_DEVICE_COOKIE)?.value);
  if (!device) redirect("/pair");
  if (!device.tableIsActive) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-cream-100 px-6">
        <div className="surface max-w-md p-8 text-center">
          <h1 className="font-display text-2xl font-semibold text-coffee-900">Stol xizmatda emas</h1>
          <p className="mt-2 text-sm text-coffee-500">
            {device.tableLabel} hozircha faol emas. Iltimos, ofitsiantga murojaat qiling.
          </p>
        </div>
      </main>
    );
  }

  return <CustomerApp tableLabel={device.tableLabel} tableCode={device.tableCode} />;
}
