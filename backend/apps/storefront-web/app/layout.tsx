import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: {
    default: "Sellivo Store",
    template: "%s · Sellivo Store",
  },
  description: "Shop the Sellivo catalog — fast checkout, pickup or delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <CartProvider>
            <Header />
            <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
