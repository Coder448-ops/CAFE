import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { ToastProvider } from "@/shared/components/ui/toast";

export const metadata: Metadata = {
  title: "LOLA CAFE — Restoran boshqaruv tizimi",
  description:
    "LOLA CAFE uchun mijoz buyurtmalari, kassir terminali, oshxona ekrani va administrator paneli.",
  applicationName: "LOLA CAFE",
};

export const viewport: Viewport = {
  themeColor: "#3F2E1C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
