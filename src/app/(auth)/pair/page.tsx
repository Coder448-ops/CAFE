import { cookies } from "next/headers";
import Link from "next/link";
import { TABLE_DEVICE_COOKIE } from "@/server/auth/session";
import { resolveDeviceToken } from "@/server/services/tables";
import { PairForm } from "@/modules/customer/components/pair-form";

export const dynamic = "force-dynamic";

export default async function PairPage() {
  const store = await cookies();
  const device = resolveDeviceToken(store.get(TABLE_DEVICE_COOKIE)?.value);

  if (device) {
    return (
      <div className="animate-fade-in text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-moss-100 text-2xl">✓</div>
        <h1 className="mt-4 font-display text-2xl font-semibold text-coffee-900">Qurilma ulangan</h1>
        <p className="mt-2 text-sm text-coffee-500">
          Bu qurilma <strong className="text-coffee-800">{device.tableLabel}</strong> ({device.tableCode},{" "}
          {device.zone}) stoliga biriktirilgan.
        </p>
        <Link
          href="/order"
          className="mt-6 inline-flex rounded-xl bg-moss-600 px-5 py-3 text-sm font-semibold text-cream-50 hover:bg-moss-700"
        >
          Buyurtma oynasini ochish
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-moss-600">Stol qurilmasi</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-coffee-900">Qurilmani ulash</h1>
      <p className="mt-2 text-sm text-coffee-500">
        Ofitsiant bergan 8 belgili bir martalik kodni kiriting. Kod 10 daqiqa amal qiladi va faqat bir marta
        ishlatiladi.
      </p>
      <PairForm />
      <p className="mt-8 text-center text-xs text-coffee-400">
        Xodimmisiz?{" "}
        <Link href="/login" className="font-semibold text-moss-600 hover:text-moss-700">
          Tizimga kirish
        </Link>
      </p>
    </div>
  );
}
