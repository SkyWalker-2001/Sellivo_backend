import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard, RolesGuard } from "./auth/guards";
import { StoresModule } from "./stores/stores.module";
import { CatalogModule } from "./catalog/catalog.module";
import { InventoryModule } from "./inventory/inventory.module";
import { PosModule } from "./pos/pos.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { StaffModule } from "./staff/staff.module";
import { MediaModule } from "./media/media.module";
import { ReportsModule } from "./reports/reports.module";
import { StorefrontModule } from "./storefront/storefront.module";
import { LayoutModule } from "./layout/layout.module";
import { OffersModule } from "./offers/offers.module";
import { BannersModule } from "./banners/banners.module";
import { CustomersModule } from "./customers/customers.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { EventsModule } from "./events/events.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Runs from apps/api in dev and from repo root in some tooling — load both.
      envFilePath: [".env", "../../.env"],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    StoresModule,
    CatalogModule,
    InventoryModule,
    PosModule,
    OrdersModule,
    PaymentsModule,
    StaffModule,
    MediaModule,
    ReportsModule,
    StorefrontModule,
    LayoutModule,
    OffersModule,
    BannersModule,
    CustomersModule,
    NotificationsModule,
    EventsModule,
  ],
  providers: [
    // Auth is enforced globally; opt out per-route with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
