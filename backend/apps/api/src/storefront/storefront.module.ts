import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { StorefrontController } from "./storefront.controller";
import { StorefrontService } from "./storefront.service";
import { SmsService } from "./sms.service";
import { CustomerJwtStrategy } from "./customer-auth";
import { OrdersModule } from "../orders/orders.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [PassportModule, JwtModule.register({}), OrdersModule, PaymentsModule],
  controllers: [StorefrontController],
  providers: [StorefrontService, SmsService, CustomerJwtStrategy],
})
export class StorefrontModule {}
