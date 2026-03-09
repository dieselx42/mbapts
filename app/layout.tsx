import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Funnel Dashboard",
  description: "Prioritized lead queue and funnel analytics from local CSV data."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
