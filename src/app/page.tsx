import Link from "next/link";
import { getCurrentStaff } from "@/server/auth/session";
import { ROLE_HOME } from "@/shared/constants/orders";

const FEATURES = [
  {
    title: "Mijoz buyurtmalari",
    description: "Stol ekranidan menyu, savat va buyurtma holatini kuzatish.",
    icon: "☕",
    href: "/order",
    cta: "Buyurtma oynasi",
  },
  {
    title: "Kassir terminali",
    description: "Buyurtmalarni qabul qilish, to'lov qayd etish va chek chop etish.",
    icon: "🧾",
    href: "/cashier",
    cta: "Kassaga o'tish",
  },
  {
    title: "Oshxona ekrani",
    description: "Navbatdagi biletlar, tayyorlash holati va kutish vaqti.",
    icon: "🍳",
    href: "/kitchen",
    cta: "Oshxonaga o'tish",
  },
  {
    title: "Administrator",
    description: "Menyu, stollar, xodimlar, hisobotlar va audit jurnali.",
    icon: "⚙️",
    href: "/admin",
    cta: "Panelni ochish",
  },
];

export default async function HomePage() {
  const staff = await getCurrentStaff();

  return (
    <main className="min-h-dvh bg-cream-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-coffee-800 font-display text-lg font-bold text-cream-50">
            LC
          </span>
          <div>
            <p className="font-display text-lg font-semibold leading-tight text-coffee-900">LOLA CAFE</p>
            <p className="text-xs uppercase tracking-[0.2em] text-coffee-400">Restoran tizimi</p>
          </div>
        </div>
        <nav className="flex items-center gap-2 text-sm font-semibold">
          {staff ? (
            <Link
              href={ROLE_HOME[staff.user.role]}
              className="rounded-xl bg-moss-600 px-4 py-2.5 text-cream-50 hover:bg-moss-700"
            >
              {staff.user.fullName} — panelga o&apos;tish
            </Link>
          ) : (
            <Link href="/login" className="rounded-xl bg-coffee-800 px-4 py-2.5 text-cream-50 hover:bg-coffee-900">
              Xodimlar kirishi
            </Link>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-6 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
        <div className="animate-fade-in">
          <p className="inline-flex items-center gap-2 rounded-full bg-cream-200 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-coffee-600">
            Toshkent · Asia/Tashkent
          </p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] text-coffee-900 sm:text-5xl">
            Bitta tizim — mijoz, kassa, oshxona va boshqaruv uchun.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-coffee-600">
            LOLA CAFE platformasi buyurtmalarni serverda qabul qiladi, narxlarni serverda tekshiradi va
            barcha qurilmalar o&apos;rtasida real vaqtda sinxronlaydi. Ma&apos;lumotlar SQLite bazasida
            doimiy saqlanadi.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/pair"
              className="rounded-xl bg-moss-600 px-5 py-3.5 text-sm font-semibold text-cream-50 shadow-card transition hover:bg-moss-700"
            >
              Stol qurilmasini ulash
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-coffee-200 bg-white px-5 py-3.5 text-sm font-semibold text-coffee-800 transition hover:border-coffee-300"
            >
              Xodimlar uchun kirish
            </Link>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-coffee-100 pt-6 text-sm">
            <div>
              <dt className="text-coffee-400">Valyuta</dt>
              <dd className="font-semibold text-coffee-800">UZS (tiyin)</dd>
            </div>
            <div>
              <dt className="text-coffee-400">Til</dt>
              <dd className="font-semibold text-coffee-800">O&apos;zbek (lotin)</dd>
            </div>
            <div>
              <dt className="text-coffee-400">Realtime</dt>
              <dd className="font-semibold text-coffee-800">SSE + replay</dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group surface animate-slide-up p-5 transition hover:-translate-y-0.5 hover:border-moss-300"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span className="text-2xl" aria-hidden>
                {feature.icon}
              </span>
              <h2 className="mt-3 font-display text-lg font-semibold text-coffee-900">{feature.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-coffee-500">{feature.description}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-moss-600 group-hover:text-moss-700">
                {feature.cta} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-coffee-100 px-6 py-6 text-center text-xs text-coffee-400">
        LOLA CAFE · Ichki foydalanish uchun restoran boshqaruv tizimi
      </footer>
    </main>
  );
}
