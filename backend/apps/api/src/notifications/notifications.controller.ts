import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { NotificationsService } from "./notifications.service";
import { CurrentOrg, Public, Roles } from "../common/decorators";

class SendNotificationDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() body!: string;
  @IsOptional() @IsIn(["all", "customers"]) audience?: string;
  @IsOptional() @IsString() storeId?: string;
}

@ApiTags("notifications")
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Public()
  @Get("storefront/orgs/:orgId/notifications")
  @ApiOperation({ summary: "Customer notification feed" })
  feed(@Param("orgId") orgId: string, @Query("storeId") storeId?: string) {
    return this.notifications.feed(orgId, storeId);
  }

  @Get("notifications")
  @ApiBearerAuth()
  list(@CurrentOrg() orgId: string) {
    return this.notifications.list(orgId);
  }

  @Post("notifications")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Send a store notification" })
  send(@CurrentOrg() orgId: string, @Body() dto: SendNotificationDto) {
    return this.notifications.send(orgId, dto);
  }
}
