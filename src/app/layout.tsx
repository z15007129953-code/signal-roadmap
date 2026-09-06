import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Roadmap — a clear place for feedback",
  description:
    "Share ideas, find related feedback, and follow visible product decisions.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
