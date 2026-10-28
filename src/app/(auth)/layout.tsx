import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-coffee-800 p-10 text-cream-100 lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream-100 font-display text-lg font-bold text-coffee-900">
            LC
          </span>
          <span className="font-display text-lg font-semibold">LOLA CAFE</span>
        </Link>
        <div className="max-w-md">
          <p className="font-display text-3xl leading-snug">
            «Har bir buyurtma bir joyda: qabul qilinadi, tayyorlanadi va to&apos;lanadi.»
          </p>
          <p className="mt-4 text-sm text-cream-300">
            Kassir, oshxona va administrator uchun yagona baza. Barcha o&apos;zgarishlar serverda
            tasdiqlanadi.
          </p>
        </div>
        <div className="flex gap-6 text-xs text-cream-300">
          <span>Toshkent, O&apos;zbekiston</span>
          <span>Asia/Tashkent</span>
        </div>
        <div className="pointer-events-none absolute inset-0 grid-paper opacity-20" aria-hidden />
      </section>
      <section className="flex items-center justify-center bg-cream-100 px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
