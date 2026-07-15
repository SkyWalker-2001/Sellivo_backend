import { getBootstrap, getProducts } from "@/lib/api";
import Catalog from "@/components/Catalog";

// Server component — products are server-rendered for SEO.
export default async function HomePage() {
  let products = [];
  let orgName = "Store";
  try {
    const boot = await getBootstrap();
    orgName = boot.org.name;
    products = await getProducts(boot.org.id);
  } catch {
    return (
      <p className="py-16 text-center text-gray-500">
        Storefront is warming up — make sure the API is running and has a catalog.
      </p>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{orgName}</h1>
      <p className="mb-6 text-gray-500">Browse the catalog and check out in seconds.</p>
      <Catalog products={products} />
    </div>
  );
}
