"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";

export default function Header() {
  const { count } = useCart();
  const { customer, logout, ready } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-xl font-bold text-brand">
          Sellivo
        </Link>
        <nav className="ml-auto flex items-center gap-4 text-sm">
          <Link href="/" className="hover:text-brand">
            Shop
          </Link>
          {ready && customer ? (
            <>
              <Link href="/account" className="hover:text-brand">
                My orders
              </Link>
              <button onClick={logout} className="text-gray-500 hover:text-brand">
                Sign out ({customer.name.split(" ")[0]})
              </button>
            </>
          ) : (
            <Link href="/login" className="hover:text-brand">
              Sign in
            </Link>
          )}
          <Link
            href="/cart"
            className="relative rounded-md bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-dark"
          >
            Cart
            {count > 0 && (
              <span className="ml-1 rounded-full bg-white px-1.5 text-xs text-brand">{count}</span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
