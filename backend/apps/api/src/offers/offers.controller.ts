import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { OffersService } from "./offers.service";
import { UpsertCouponDto } from "./dto";
import { CurrentOrg, Roles } from "../common/decorators";

@ApiTags("offers")
@ApiBearerAuth()
@Controller("offers")
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  @ApiOperation({ summary: "List coupons (owner)" })
  list(@CurrentOrg() orgId: string) {
    return this.offers.list(orgId);
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentOrg() orgId: string, @Body() dto: UpsertCouponDto) {
    return this.offers.create(orgId, dto);
  }

  @Patch(":id")
  @Roles("owner", "manager")
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpsertCouponDto) {
    return this.offers.update(orgId, id, dto);
  }

  @Delete(":id")
  @Roles("owner", "manager")
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.offers.remove(orgId, id);
  }
}
