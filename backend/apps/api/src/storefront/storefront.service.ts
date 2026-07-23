import { randomInt } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { PaymentsService } from "../payments/payments.service";
import { SmsService } from "./sms.service";
import type { AddressDto, CheckoutDto, CustomerLoginDto, CustomerRegisterDto, SetCartDto } from "./dto";
import type { CustomerTokenPayload } from "./customer-auth";

interface OtpEntry {
  code: string;
  expiresAt: number;
}

@Injectable()
export class StorefrontService {
  private readonly logger = new Logger(StorefrontService.name);
  // Dev OTP store. Swap for Redis/SMS provider (Twilio/MSG91) in production.
  private readonly otps = new Map<string, OtpEntry>();
  private static readonly otpTtlMs = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly sms: SmsService,
  ) {}

  /** Default storefront tenant + its stores. One org per storefront deployment. */
  async bootstrap() {
    // A real deployment pins the storefront tenant via config (STOREFRONT_ORG_ID) —
    // e.g. one org per custom domain. If set and valid, that org wins.
    const pinnedId = this.config.get<string>("STOREFRONT_ORG_ID");
    const pinned = pinnedId
      ? await this.prisma.organization.findUnique({ where: { id: pinnedId } })
      : null;
    // Otherwise prefer an org that actually has a catalog (so the storefront isn't
    // empty); fall back to the earliest org.
    const org =
      pinned ??
      (await this.prisma.organization.findFirst({
        where: { products: { some: {} }, stores: { some: {} } },
        orderBy: { createdAt: "asc" },
      })) ?? (await this.prisma.organization.findFirst({ orderBy: { createdAt: "asc" } }));
    if (!org) throw new NotFoundException("No organization configured");
    const stores = await this.prisma.store.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, address: true, currency: true, config: true },
      orderBy: { createdAt: "asc" },
    });
    return { org: { id: org.id, name: org.name }, stores };
  }

  // ── Customer auth ────────────────────────────────────────────────────────────
  async register(organizationId: string, dto: CustomerRegisterDto) {
    await this.assertOrg(organizationId);
    const existing = await this.prisma.customer.findFirst({
      where: { organizationId, email: dto.email },
    });
    if (existing) throw new ConflictException("Email already registered");
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const customer = await this.prisma.customer.create({
      data: { organizationId, name: dto.name, email: dto.email, passwordHash },
    });
    return this.issueToken(customer.id, organizationId);
  }

  async login(organizationId: string, dto: CustomerLoginDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { organizationId, email: dto.email },
    });
    if (!customer?.passwordHash) throw new UnauthorizedException("Invalid credentials");
    const ok = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    return this.issueToken(customer.id, organizationId);
  }

  // ── Phone OTP (mobile customers) ───────────────────────────────────────────
  /** Generate + send an OTP by SMS to the phone. Only the "console" provider
   *  surfaces the code back to the client (devCode) — real providers do not. */
  async requestOtp(organizationId: string, phone: string) {
    await this.assertOrg(organizationId);
    const normalized = phone.trim();
    const code = randomInt(100000, 1000000).toString(); // 6 digits
    this.otps.set(this.otpKey(organizationId, normalized), {
      code,
      expiresAt: Date.now() + StorefrontService.otpTtlMs,
    });
    this.logger.log(`OTP for ${normalized}: ${code}`);

    const result = await this.sms.send(
      normalized,
      `Your Sellivo verification code is ${code}. It expires in 5 minutes.`,
    );
    if (!result.sent) {
      // Surface a clear error to the client instead of silently "succeeding".
      throw new BadRequestException(
        `Couldn't send the code via SMS (${result.provider}): ${result.error ?? "unknown error"}`,
      );
    }
    // Only the console (no-real-SMS) provider reveals the code for dev sign-in.
    return { sent: true, ...(this.sms.isConsole ? { devCode: code } : {}) };
  }

  /** Verify an OTP; find-or-create the customer by phone, then issue a token. */
  async verifyOtp(organizationId: string, phone: string, code: string, name?: string) {
    const normalized = phone.trim();
    const key = this.otpKey(organizationId, normalized);
    const entry = this.otps.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new UnauthorizedException("Code expired — request a new one");
    }
    if (entry.code !== code.trim()) throw new BadRequestException("Invalid code");
    this.otps.delete(key);

    let customer = await this.prisma.customer.findFirst({
      where: { organizationId, phone: normalized },
    });
    customer ??= await this.prisma.customer.create({
      data: { organizationId, phone: normalized, name: name?.trim() || null },
    });
    return this.issueToken(customer.id, organizationId);
  }

  private otpKey(organizationId: string, phone: string) {
    return `${organizationId}:${phone}`;
  }

  // ── Google sign-in (customer) ──────────────────────────────────────────────
  /** Verify a Google ID token, then find-or-create the customer by email. */
  async googleSignIn(organizationId: string, idToken: string) {
    await this.assertOrg(organizationId);

    // Verify the token with Google. This endpoint checks the signature and
    // expiry server-side and returns the claims.
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) throw new UnauthorizedException("Invalid Google token");
    const claims = (await res.json()) as {
      aud?: string;
      iss?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      sub?: string;
    };

    const iss = claims.iss ?? "";
    if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
      throw new UnauthorizedException("Untrusted token issuer");
    }
    // Audience must be one of our configured OAuth client IDs.
    const allowed = (this.config.get<string>("GOOGLE_CLIENT_IDS") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(claims.aud ?? "")) {
      throw new UnauthorizedException("Token audience not allowed");
    }
    const emailVerified =
      claims.email_verified === true || claims.email_verified === "true";
    if (!claims.email || !emailVerified) {
      throw new UnauthorizedException("Google account email not verified");
    }

    const email = claims.email.toLowerCase();
    let customer = await this.prisma.customer.findFirst({
      where: { organizationId, email },
    });
    customer ??= await this.prisma.customer.create({
      data: { organizationId, email, name: claims.name?.trim() || null },
    });
    return this.issueToken(customer.id, organizationId);
  }

  async me(customerId: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, email: true, phone: true, organizationId: true },
    });
    if (!c) throw new UnauthorizedException();
    return c;
  }

  // ── Catalog (public) ─────────────────────────────────────────────────────────
  /**
   * Public catalog listing. All params are optional so existing callers
   * (storefront-web) keep working with no arguments. Returns a plain array
   * ordered/filtered/paginated; the client requests successive pages via
   * skip/take (offset pagination) and stops when it receives < take items.
   * Each variant is augmented with a computed `stock` total across the org's
   * stores so the storefront can show availability badges.
   */
  async listProducts(
    organizationId: string,
    opts: {
      q?: string;
      categoryId?: string;
      sort?: "newest" | "price_asc" | "price_desc" | "name";
      minPrice?: number;
      maxPrice?: number;
      inStock?: boolean;
      discountOnly?: boolean;
      skip?: number;
      take?: number;
    } = {},
  ) {
    const q = opts.q?.trim();
    const orderBy =
      opts.sort === "name"
        ? { name: "asc" as const }
        : opts.sort === "price_asc" || opts.sort === "price_desc"
          ? undefined // price ordering handled post-fetch (price lives on variants)
          : { createdAt: "desc" as const };

    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts.minPrice != null || opts.maxPrice != null
          ? {
              variants: {
                some: {
                  priceCents: {
                    ...(opts.minPrice != null ? { gte: opts.minPrice } : {}),
                    ...(opts.maxPrice != null ? { lte: opts.maxPrice } : {}),
                  },
                },
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { brand: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { category: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: { variants: true, category: { select: { id: true, name: true } } },
      ...(orderBy ? { orderBy } : {}),
    });

    let withStock = await this.attachStock(organizationId, products);

    // In-stock filter runs post-fetch since stock is summed from inventory.
    if (opts.inStock) {
      withStock = withStock.filter((p) =>
        p.variants.some((v: { stock?: number }) => (v.stock ?? 0) > 0),
      );
    }

    // Discounted-only (any variant whose mrp exceeds its price) — post-fetch
    // since it compares two columns.
    if (opts.discountOnly) {
      withStock = withStock.filter((p) =>
        p.variants.some((v) => v.mrpCents != null && v.mrpCents > v.priceCents),
      );
    }

    // Price sort operates on the cheapest variant, so it must run after fetch.
    if (opts.sort === "price_asc" || opts.sort === "price_desc") {
      const minPrice = (p: (typeof withStock)[number]) =>
        p.variants.reduce(
          (m, v) => Math.min(m, v.priceCents),
          Number.POSITIVE_INFINITY,
        );
      withStock.sort((a, b) =>
        opts.sort === "price_asc"
          ? minPrice(a) - minPrice(b)
          : minPrice(b) - minPrice(a),
      );
    }

    const skip = opts.skip ?? 0;
    const take = opts.take ?? withStock.length;
    return this.attachRatings(withStock.slice(skip, skip + take));
  }

  /** Distinct categories that have at least one product, with product counts. */
  async listCategories(organizationId: string) {
    const categories = await this.prisma.category.findMany({
      where: { organizationId, products: { some: {} } },
      select: {
        id: true,
        name: true,
        parentId: true,
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    });
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      productCount: c._count.products,
    }));
  }

  async getProduct(organizationId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
      include: { variants: true, category: { select: { id: true, name: true } } },
    });
    if (!product) throw new NotFoundException("Product not found");
    const [withStock] = await this.attachStock(organizationId, [product]);
    const [withRatings] = await this.attachRatings([withStock]);
    return withRatings;
  }

  /**
   * Attach `rating` (avg, 1dp) and `reviewCount` to each product via a single
   * grouped query over reviews.
   */
  private async attachRatings<P extends { id: string }>(products: P[]) {
    if (products.length === 0) return products;
    const grouped = await this.prisma.productReview.groupBy({
      by: ["productId"],
      where: { productId: { in: products.map((p) => p.id) } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const byProduct = new Map(
      grouped.map((g) => [
        g.productId,
        { rating: g._avg.rating ?? 0, reviewCount: g._count.rating },
      ]),
    );
    return products.map((p) => ({
      ...p,
      rating: Math.round((byProduct.get(p.id)?.rating ?? 0) * 10) / 10,
      reviewCount: byProduct.get(p.id)?.reviewCount ?? 0,
    }));
  }

  // ── Reviews (public read, customer write) ──────────────────────────────────
  async listReviews(organizationId: string, productId: string) {
    await this.assertProduct(organizationId, productId);
    const reviews = await this.prisma.productReview.findMany({
      where: { productId },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of reviews) {
      distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
      sum += r.rating;
    }
    return {
      summary: {
        average: reviews.length ? Math.round((sum / reviews.length) * 10) / 10 : 0,
        count: reviews.length,
        distribution,
      },
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        authorName: r.customer.name ?? "Verified buyer",
        createdAt: r.createdAt,
      })),
    };
  }

  async createReview(
    organizationId: string,
    customerId: string,
    productId: string,
    dto: { rating: number; title?: string; body?: string },
  ) {
    await this.assertProduct(organizationId, productId);
    const rating = Math.max(1, Math.min(5, Math.round(dto.rating)));
    return this.prisma.productReview.upsert({
      where: { productId_customerId: { productId, customerId } },
      create: {
        organizationId,
        productId,
        customerId,
        rating,
        title: dto.title?.trim() || null,
        body: dto.body?.trim() || null,
      },
      update: {
        rating,
        title: dto.title?.trim() || null,
        body: dto.body?.trim() || null,
      },
    });
  }

  private async assertProduct(organizationId: string, productId: string) {
    const p = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
      select: { id: true },
    });
    if (!p) throw new NotFoundException("Product not found");
  }

  /**
   * Sum on-hand inventory across all of the org's stores per variant and attach
   * a `stock` field to each variant in the given products. Single grouped query.
   */
  private async attachStock<
    P extends { variants: { id: string }[] },
  >(organizationId: string, products: P[]) {
    const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
    if (variantIds.length === 0) return products.map((p) => ({ ...p, variants: [] }));
    const sums = await this.prisma.inventory.groupBy({
      by: ["variantId"],
      where: { variantId: { in: variantIds } },
      _sum: { onHand: true },
    });
    const stockByVariant = new Map(sums.map((s) => [s.variantId, s._sum.onHand ?? 0]));
    return products.map((p) => ({
      ...p,
      variants: p.variants.map((v) => ({ ...v, stock: stockByVariant.get(v.id) ?? 0 })),
    }));
  }

  // ── Checkout & orders (customer) ──────────────────────────────────────────────
  async checkout(organizationId: string, customerId: string, dto: CheckoutDto) {
    // Resolve the chosen address (if any) to a formatted, stored snapshot.
    let deliveryAddress: string | undefined;
    if (dto.addressId) {
      const addr = await this.prisma.customerAddress.findFirst({
        where: { id: dto.addressId, customerId },
      });
      if (addr) {
        deliveryAddress = [
          addr.name,
          [addr.line1, addr.line2].filter(Boolean).join(", "),
          `${addr.city} ${addr.pincode}`,
          addr.phone,
        ].join("\n");
      }
    }

    const order = await this.orders.create(organizationId, {
      storeId: dto.storeId,
      customerId,
      fulfillmentType: dto.fulfillmentType,
      items: dto.items,
      couponCode: dto.couponCode,
      deliveryAddress,
      deliverySlot: dto.slot,
      notes: dto.notes,
    });
    const payment = await this.payments.createIntent(organizationId, {
      target: "order",
      orderId: order.id,
      method: "online",
    });
    // Order placed — empty the persisted cart.
    await this.clearCart(customerId);
    return { order, payment };
  }

  /** Validate a promo code against a subtotal, returning the discount. */
  async validateCoupon(organizationId: string, code: string, subtotalCents: number) {
    const { discountCents, freeDelivery } = await this.orders.resolveCoupon(
      organizationId,
      code,
      subtotalCents,
    );
    const valid = discountCents > 0 || freeDelivery;
    return {
      code: code.trim().toUpperCase(),
      valid,
      discountCents,
      freeDelivery,
      message: freeDelivery
        ? "Free delivery unlocked 🎉"
        : discountCents > 0
          ? `You saved ₹${(discountCents / 100).toFixed(0)}`
          : "This code isn't valid for your cart.",
    };
  }

  /** Computed delivery slots for the next two days (no DB needed). */
  deliverySlots() {
    const windows = ["9:00–11:00 AM", "11:00 AM–1:00 PM", "1:00–4:00 PM", "4:00–7:00 PM", "7:00–9:00 PM"];
    const days = ["Today", "Tomorrow"];
    const slots: { id: string; day: string; window: string; label: string }[] = [];
    for (const day of days) {
      for (const window of windows) {
        slots.push({ id: `${day}-${window}`, day, window, label: `${day}, ${window}` });
      }
    }
    return slots;
  }

  // ── Customer addresses ─────────────────────────────────────────────────────
  listAddresses(customerId: string) {
    return this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async createAddress(organizationId: string, customerId: string, dto: AddressDto) {
    if (dto.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }
    // First address becomes the default automatically.
    const count = await this.prisma.customerAddress.count({ where: { customerId } });
    return this.prisma.customerAddress.create({
      data: {
        organizationId,
        customerId,
        label: dto.label,
        name: dto.name,
        phone: dto.phone,
        line1: dto.line1,
        line2: dto.line2 ?? null,
        city: dto.city,
        pincode: dto.pincode,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        isDefault: dto.isDefault ?? count === 0,
      },
    });
  }

  async updateAddress(customerId: string, id: string, dto: AddressDto) {
    const existing = await this.prisma.customerAddress.findFirst({
      where: { id, customerId },
    });
    if (!existing) throw new NotFoundException("Address not found");
    if (dto.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }
    return this.prisma.customerAddress.update({
      where: { id },
      data: {
        label: dto.label,
        name: dto.name,
        phone: dto.phone,
        line1: dto.line1,
        line2: dto.line2 ?? null,
        city: dto.city,
        pincode: dto.pincode,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        isDefault: dto.isDefault ?? existing.isDefault,
      },
    });
  }

  async deleteAddress(customerId: string, id: string) {
    const existing = await this.prisma.customerAddress.findFirst({
      where: { id, customerId },
    });
    if (!existing) throw new NotFoundException("Address not found");
    await this.prisma.customerAddress.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Server-side cart ───────────────────────────────────────────────────────
  /** The customer's persisted cart, hydrated with live product/price details. */
  async getCart(customerId: string) {
    const rows = await this.prisma.cartItem.findMany({
      where: { customerId },
      orderBy: { createdAt: "asc" },
      include: { variant: { include: { product: true } } },
    });
    // Drop rows whose variant/product vanished from the catalog.
    const live = rows.filter((r) => r.variant && r.variant.product);

    // On-hand stock per variant (summed across the org's stores) so the cart can
    // show an in-stock badge and cap quantities. One grouped query.
    const variantIds = live.map((r) => r.variantId);
    const stockByVariant = new Map<string, number>();
    if (variantIds.length > 0) {
      const sums = await this.prisma.inventory.groupBy({
        by: ["variantId"],
        where: { variantId: { in: variantIds } },
        _sum: { onHand: true },
      });
      for (const s of sums) stockByVariant.set(s.variantId, s._sum.onHand ?? 0);
    }

    return live.map((r) => ({
      variantId: r.variantId,
      productId: r.variant.productId,
      name: r.variant.product.name,
      priceCents: r.variant.priceCents,
      mrpCents: r.variant.mrpCents ?? null,
      weight: r.variant.weight ?? null,
      unit: r.variant.unit ?? null,
      stock: stockByVariant.get(r.variantId) ?? null,
      quantity: r.quantity,
      images: Array.isArray(r.variant.product.images)
        ? (r.variant.product.images as string[])
        : [],
    }));
  }

  /** Replace the whole cart with [dto.items] (client is the source of truth). */
  async setCart(organizationId: string, customerId: string, dto: SetCartDto) {
    // Collapse duplicate variant lines by summing quantity.
    const merged = new Map<string, number>();
    for (const item of dto.items) {
      if (item.quantity <= 0) continue;
      merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity);
    }
    // Keep only variants that actually belong to this org's catalog.
    const validVariants = await this.prisma.productVariant.findMany({
      where: {
        id: { in: [...merged.keys()] },
        product: { organizationId },
      },
      select: { id: true },
    });
    const validIds = new Set(validVariants.map((v) => v.id));

    await this.prisma.$transaction([
      this.prisma.cartItem.deleteMany({ where: { customerId } }),
      this.prisma.cartItem.createMany({
        data: [...merged.entries()]
          .filter(([variantId]) => validIds.has(variantId))
          .map(([variantId, quantity]) => ({
            organizationId,
            customerId,
            variantId,
            quantity,
          })),
      }),
    ]);
    return this.getCart(customerId);
  }

  async clearCart(customerId: string) {
    await this.prisma.cartItem.deleteMany({ where: { customerId } });
    return { cleared: true };
  }

  /** Dev helper standing in for the Razorpay webhook during local testing. */
  confirmPayment(gatewayRef: string, status: "paid" | "failed") {
    return this.payments.handleWebhook({ gatewayRef, status });
  }

  // The proof-of-delivery code is only meaningful (and only shown) once the
  // order is out for delivery — mask it otherwise.
  private maskOtp<T extends { status: string; deliveryOtp: string | null }>(o: T): T {
    return o.status === "out_for_delivery" ? o : { ...o, deliveryOtp: null };
  }

  async listOrders(organizationId: string, customerId: string) {
    const rows = await this.prisma.order.findMany({
      where: { organizationId, customerId },
      include: { items: true, payments: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((o) => this.maskOtp(o));
  }

  async getOrder(organizationId: string, customerId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId, customerId },
      include: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    return this.maskOtp(order);
  }

  /** Customer-initiated cancellation, allowed only in early statuses. */
  async cancelOrder(organizationId: string, customerId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId, customerId },
    });
    if (!order) throw new NotFoundException("Order not found");
    const cancellable = ["pending", "confirmed"];
    if (!cancellable.includes(order.status)) {
      throw new BadRequestException("This order can no longer be cancelled");
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: "cancelled" },
      include: { items: true, payments: true },
    });
  }

  /** Public list of active promo codes (for the Offers screen). */
  listOffers(organizationId: string) {
    return this.prisma.coupon.findMany({
      where: { organizationId, active: true },
      select: {
        code: true,
        type: true,
        value: true,
        minSubtotalCents: true,
      },
      orderBy: { minSubtotalCents: "asc" },
    });
  }

  private async issueToken(customerId: string, organizationId: string) {
    const payload: CustomerTokenPayload = { sub: customerId, org: organizationId, typ: "customer" };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>("JWT_CUSTOMER_SECRET"),
      expiresIn: (this.config.get<string>("JWT_CUSTOMER_TTL") ?? "30d") as `${number}d`,
    });
    return { accessToken };
  }

  private async assertOrg(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException("Organization not found");
  }
}
