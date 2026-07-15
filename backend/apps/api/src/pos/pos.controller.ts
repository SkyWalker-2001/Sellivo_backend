import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { PosService } from "./pos.service";
import { SyncPushDto } from "./dto";
import { CurrentUser, Roles } from "../common/decorators";
import type { AuthUser } from "../common/auth-user";

@ApiTags("pos-sync")
@ApiBearerAuth()
@Controller("pos/sync")
export class PosController {
  constructor(private readonly pos: PosService) {}

  @Post("push")
  @Roles("cashier", "manager", "owner")
  @ApiOperation({ summary: "Push a batch of offline sales (idempotent by clientUuid)" })
  push(@CurrentUser() user: AuthUser, @Body() dto: SyncPushDto) {
    return this.pos.push(user, dto);
  }

  @Get("pull")
  @Roles("cashier", "manager", "owner")
  @ApiOperation({ summary: "Pull catalog + price + stock deltas since a cursor" })
  @ApiQuery({ name: "storeId", required: true })
  @ApiQuery({ name: "cursor", required: false, description: "ISO 8601 timestamp" })
  pull(
    @CurrentUser() user: AuthUser,
    @Query("storeId") storeId: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.pos.pull(user, storeId, cursor);
  }
}
