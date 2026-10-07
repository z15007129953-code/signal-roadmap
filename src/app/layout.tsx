import type { Metadata } from "next";
import { connection } from "next/server";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Roadmap — a clear place for feedback",
  description:
    "Share ideas, find related feedback, and follow visible product decisions.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every document needs the fresh request CSP nonce, including the home page.
  await connection();
  const locale = await getLocale();
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
