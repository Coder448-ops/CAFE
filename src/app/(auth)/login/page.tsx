import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/server/auth/session";
import { config } from "@/server/config";
import { ROLE_HOME } from "@/shared/constants/orders";
import { DEMO_PASSWORDS } from "../../../../database/seeds/demo";
import { LoginForm } from "@/modules/authentication/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const staff = await getCurrentStaff();
  if (staff) redirect(ROLE_HOME[staff.user.role]);

  return (
    <div className="animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-moss-600">Xodimlar paneli</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-coffee-900">Tizimga kirish</h1>
      <p className="mt-2 text-sm text-coffee-500">
        Hisobingizga kiring. Rollar serverda tekshiriladi — ruxsat bo&apos;lmagan bo&apos;limlar ochilmaydi.
      </p>

      <LoginForm />

      {!config.isProduction ? (
        <div className="mt-8 rounded-xl border border-dashed border-coffee-200 bg-cream-50 p-4 text-xs text-coffee-500">
          <p className="font-semibold uppercase tracking-wide text-coffee-600">Demo hisoblar (faqat lokal)</p>
          <ul className="mt-2 space-y-1">
            <li>admin@lolacafe.uz · {DEMO_PASSWORDS.admin}</li>
            <li>kassir@lolacafe.uz · {DEMO_PASSWORDS.cashier}</li>
            <li>oshxona@lolacafe.uz · {DEMO_PASSWORDS.kitchen}</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
