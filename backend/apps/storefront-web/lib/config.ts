/// Storefront runtime config. NEXT_PUBLIC_API_URL is used on both server and client.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export function money(cents: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : "$";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}
