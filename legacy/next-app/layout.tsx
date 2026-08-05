import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Investment Case Generator",
  description:
    "Identify source-grounded investable concepts and draft investment case materials.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
