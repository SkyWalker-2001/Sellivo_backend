// The fallback home layout used when an org/store hasn't customised one yet.
// Mirrors the customer app's original hand-built home so a fresh store looks
// good out of the box. The owner can edit/reorder from here.

export interface DefaultSection {
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  dataSource: Record<string, unknown>;
}

export const DEFAULT_LAYOUT: DefaultSection[] = [
  {
    type: "hero_banner",
    enabled: true,
    config: {},
    dataSource: { kind: "banners" },
  },
  {
    type: "category_grid",
    enabled: true,
    config: { title: "Shop by category" },
    dataSource: { kind: "categories" },
  },
  {
    type: "flash_sale",
    enabled: true,
    config: { title: "Flash deals", icon: "bolt" },
    dataSource: { kind: "products", discountOnly: true, sort: "price_asc", limit: 10 },
  },
  {
    type: "recently_viewed",
    enabled: true,
    config: { title: "Recently viewed", icon: "history" },
    dataSource: { kind: "recently_viewed", limit: 10 },
  },
  {
    type: "trending",
    enabled: true,
    config: { title: "Trending now", icon: "trending_up" },
    dataSource: { kind: "products", sort: "newest", limit: 10 },
  },
  {
    type: "recommended",
    enabled: true,
    config: { title: "Recommended for you", icon: "recommend" },
    dataSource: { kind: "products", sort: "name", limit: 10 },
  },
  {
    type: "product_feed",
    enabled: true,
    config: { title: "Explore all products" },
    dataSource: { kind: "products", sort: "newest" },
  },
];

/// Section types the CMS/owner app can add. Kept in sync with the customer
/// SectionRegistry.
export const SECTION_TYPES = [
  "hero_banner",
  "category_grid",
  "horizontal_category",
  "flash_sale",
  "todays_deals",
  "best_seller",
  "featured",
  "trending",
  "recommended",
  "recently_viewed",
  "continue_shopping",
  "brand_carousel",
  "offer_banner",
  "coupons",
  "video_banner",
  "recipe_banner",
  "festival_banner",
  "product_carousel",
  "ad_banner",
  "single_image",
  "grid_banner",
  "text_banner",
  "product_feed",
  "spacer",
  "divider",
] as const;
