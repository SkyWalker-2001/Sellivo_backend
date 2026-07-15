import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBootstrap, getProduct } from "@/lib/api";
import { money } from "@/lib/config";
import AddToCart from "@/components/AddToCart";

async function load(id: string) {
  const boot = await getBootstrap();
  const product = await getProduct(boot.org.id, id);
  return product;
}

// SEO: product-specific title/description generated server-side.
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  try {
    const { id } = await params;
    const p = await load(id);
    return {
      title: p.name,
      description: p.description ?? `${p.name} by ${p.brand ?? "Sellivo"}`,
      openGraph: { title: p.name, images: p.images },
    };
  } catch {
    return { title: "Product" };
  }
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let product;
  try {
    product = await load(id);
  } catch {
    notFound();
  }
  const price = product.variants[0]?.priceCents ?? 0;

  return (
    <div>
      <Link href="/" className="text-sm text-brand hover:underline">
        ← Back to shop
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl text-gray-300">🛍️</div>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500">{product.brand ?? ""}</p>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="mt-2 text-2xl font-semibold text-brand">{money(price)}</p>
          {product.description && (
            <p className="mt-4 text-gray-600">{product.description}</p>
          )}
          <div className="mt-6">
            <AddToCart product={product} />
          </div>
          <dl className="mt-8 space-y-1 text-sm text-gray-500">
            {product.variants[0] && <div>SKU: {product.variants[0].sku}</div>}
            {product.category && <div>Category: {product.category.name}</div>}
          </dl>
        </div>
      </div>
    </div>
  );
}
