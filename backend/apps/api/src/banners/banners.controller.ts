import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BannersService } from "./banners.service";
import { UpsertBannerDto } from "./dto";
import { CurrentOrg, Public, Roles } from "../common/decorators";

@ApiTags("banners")
@Controller()
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  // ── Public (customer) ────────────────────────────────────────────────────────
  @Public()
  @Get("storefront/orgs/:orgId/banners")
  @ApiOperation({ summary: "Active banners for the customer app" })
  published(@Param("orgId") orgId: string, @Query("storeId") storeId?: string) {
    return this.banners.published(orgId, storeId);
  }

  @Public()
  @Post("storefront/banners/:id/track")
  @ApiOperation({ summary: "Record a banner impression/click" })
  track(@Param("id") id: string, @Query("kind") kind?: string) {
    return this.banners.track(id, kind === "click" ? "click" : "impression");
  }

  // ── Owner ────────────────────────────────────────────────────────────────────
  @Get("banners")
  @ApiBearerAuth()
  list(@CurrentOrg() orgId: string) {
    return this.banners.list(orgId);
  }

  @Post("banners")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  create(@CurrentOrg() orgId: string, @Body() dto: UpsertBannerDto) {
    return this.banners.create(orgId, dto);
  }

  @Patch("banners/:id")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpsertBannerDto) {
    return this.banners.update(orgId, id, dto);
  }

  @Delete("banners/:id")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.banners.remove(orgId, id);
  }
}
