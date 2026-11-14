import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";

export const metadata: Metadata = {
  title: "Bill splitter",
  description: "Scan the receipt, share the dishes and settle up together.",
  icons: {
    icon: "/favicon.svg?v=2",
    shortcut: "/favicon.svg?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
