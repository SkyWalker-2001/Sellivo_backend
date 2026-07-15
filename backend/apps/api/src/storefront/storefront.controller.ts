import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { StorefrontService } from "./storefront.service";
import {
  AddressDto,
  CheckoutDto,
  ConfirmPaymentDto,
  CreateReviewDto,
  CustomerLoginDto,
  CustomerRegisterDto,
  GoogleAuthDto,
  OtpRequestDto,
  OtpVerifyDto,
  ValidateCouponDto,
} from "./dto";
import { Public } from "../common/decorators";
import { CurrentCustomer, CustomerAuthGuard } from "./customer-auth";
import type { AuthCustomer } from "./customer-auth";

@ApiTags("storefront")
@Controller("storefront")
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  // ── Public ───────────────────────────────────────────────────────────────────
  @Public()
  @Get("bootstrap")
  @ApiOperation({ summary: "Default storefront org + stores" })
  bootstrap() {
    return this.storefront.bootstrap();
  }

  @Public()
  @Get("orgs/:orgId/products")
  @ApiOperation({ summary: "Public catalog listing (search + sort + pagination)" })
  listProducts(
    @Param("orgId") orgId: string,
    @Query("q") q?: string,
    @Query("categoryId") categoryId?: string,
    @Query("sort") sort?: "newest" | "price_asc" | "price_desc" | "name",
    @Query("minPrice") minPrice?: string,
    @Query("maxPrice") maxPrice?: string,
    @Query("inStock") inStock?: string,
    @Query("discountOnly") discountOnly?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    return this.storefront.listProducts(orgId, {
      q,
      categoryId,
      sort,
      minPrice: minPrice != null ? Number(minPrice) : undefined,
      maxPrice: maxPrice != null ? Number(maxPrice) : undefined,
      inStock: inStock === "true",
      discountOnly: discountOnly === "true",
      skip: skip != null ? Number(skip) : undefined,
      take: take != null ? Number(take) : undefined,
    });
  }

  @Public()
  @Get("orgs/:orgId/categories")
  @ApiOperation({ summary: "Public category list (with product counts)" })
  listCategories(@Param("orgId") orgId: string) {
    return this.storefront.listCategories(orgId);
  }

  @Public()
  @Get("orgs/:orgId/products/:id")
  @ApiOperation({ summary: "Public product detail" })
  getProduct(@Param("orgId") orgId: string, @Param("id") id: string) {
    return this.storefront.getProduct(orgId, id);
  }

  @Public()
  @Get("orgs/:orgId/products/:id/reviews")
  @ApiOperation({ summary: "Product reviews + rating summary" })
  listReviews(@Param("orgId") orgId: string, @Param("id") id: string) {
    return this.storefront.listReviews(orgId, id);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Post("orgs/:orgId/products/:id/reviews")
  @ApiOperation({ summary: "Create or update the customer's review" })
  createReview(
    @CurrentCustomer() customer: AuthCustomer,
    @Param("id") id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.storefront.createReview(customer.organizationId, customer.customerId, id, dto);
  }

  @Public()
  @Post("orgs/:orgId/auth/register")
  @ApiOperation({ summary: "Customer registration" })
  register(@Param("orgId") orgId: string, @Body() dto: CustomerRegisterDto) {
    return this.storefront.register(orgId, dto);
  }

  @Public()
  @Post("orgs/:orgId/auth/login")
  @HttpCode(200)
  @ApiOperation({ summary: "Customer login" })
  login(@Param("orgId") orgId: string, @Body() dto: CustomerLoginDto) {
    return this.storefront.login(orgId, dto);
  }

  @Public()
  @Post("orgs/:orgId/auth/otp/request")
  @HttpCode(200)
  @ApiOperation({ summary: "Request a phone OTP (dev returns the code)" })
  requestOtp(@Param("orgId") orgId: string, @Body() dto: OtpRequestDto) {
    return this.storefront.requestOtp(orgId, dto.phone);
  }

  @Public()
  @Post("orgs/:orgId/auth/otp/verify")
  @HttpCode(200)
  @ApiOperation({ summary: "Verify OTP — signs in, creating the account if new" })
  verifyOtp(@Param("orgId") orgId: string, @Body() dto: OtpVerifyDto) {
    return this.storefront.verifyOtp(orgId, dto.phone, dto.code, dto.name);
  }

  @Public()
  @Post("orgs/:orgId/auth/google")
  @HttpCode(200)
  @ApiOperation({ summary: "Sign in with Google — verifies ID token, creates account if new" })
  googleSignIn(@Param("orgId") orgId: string, @Body() dto: GoogleAuthDto) {
    return this.storefront.googleSignIn(orgId, dto.idToken);
  }

  @Public()
  @Post("payments/confirm")
  @HttpCode(200)
  @ApiOperation({ summary: "Dev payment confirm (stands in for the gateway webhook)" })
  confirm(@Body() dto: ConfirmPaymentDto) {
    return this.storefront.confirmPayment(dto.gatewayRef, dto.status ?? "paid");
  }

  // ── Customer-authenticated ─────────────────────────────────────────────────────
  @Public()
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Get("auth/me")
  me(@CurrentCustomer("customerId") customerId: string) {
    return this.storefront.me(customerId);
  }

  @Public()
  @Post("orgs/:orgId/coupons/validate")
  @HttpCode(200)
  @ApiOperation({ summary: "Validate a promo code against a subtotal" })
  validateCoupon(@Param("orgId") orgId: string, @Body() dto: ValidateCouponDto) {
    return this.storefront.validateCoupon(orgId, dto.code, dto.subtotalCents);
  }

  @Public()
  @Get("slots")
  @ApiOperation({ summary: "Available delivery slots" })
  slots() {
    return this.storefront.deliverySlots();
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Post("checkout")
  @ApiOperation({ summary: "Place an order + create a payment intent" })
  checkout(@CurrentCustomer() customer: AuthCustomer, @Body() dto: CheckoutDto) {
    return this.storefront.checkout(customer.organizationId, customer.customerId, dto);
  }

  // ── Addresses (customer) ────────────────────────────────────────────────────
  @Public()
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Get("addresses")
  listAddresses(@CurrentCustomer() customer: AuthCustomer) {
    return this.storefront.listAddresses(customer.customerId);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Post("addresses")
  createAddress(@CurrentCustomer() customer: AuthCustomer, @Body() dto: AddressDto) {
    return this.storefront.createAddress(customer.organizationId, customer.customerId, dto);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Patch("addresses/:id")
  updateAddress(
    @CurrentCustomer() customer: AuthCustomer,
    @Param("id") id: string,
    @Body() dto: AddressDto,
  ) {
    return this.storefront.updateAddress(customer.customerId, id, dto);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Delete("addresses/:id")
  deleteAddress(@CurrentCustomer() customer: AuthCustomer, @Param("id") id: string) {
    return this.storefront.deleteAddress(customer.customerId, id);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Get("orders")
  listOrders(@CurrentCustomer() customer: AuthCustomer) {
    return this.storefront.listOrders(customer.organizationId, customer.customerId);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Get("orders/:id")
  getOrder(@CurrentCustomer() customer: AuthCustomer, @Param("id") id: string) {
    return this.storefront.getOrder(customer.organizationId, customer.customerId, id);
  }

  @Public()
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Post("orders/:id/cancel")
  @HttpCode(200)
  @ApiOperation({ summary: "Cancel an order (early statuses only)" })
  cancelOrder(@CurrentCustomer() customer: AuthCustomer, @Param("id") id: string) {
    return this.storefront.cancelOrder(customer.organizationId, customer.customerId, id);
  }

  @Public()
  @Get("orgs/:orgId/offers")
  @ApiOperation({ summary: "Active promo codes" })
  offers(@Param("orgId") orgId: string) {
    return this.storefront.listOffers(orgId);
  }
}
