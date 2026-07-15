import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BrandsService } from "./brands.service";
import { UpsertBrandDto } from "./dto";
import { CurrentOrg, Public, Roles } from "../common/decorators";

@ApiTags("brands")
@Controller()
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  // ── Public (customer) ────────────────────────────────────────────────────────
  @Public()
  @Get("storefront/orgs/:orgId/brands")
  @ApiOperation({ summary: "Brands for the customer app (brand carousel)" })
  published(@Param("orgId") orgId: string) {
    return this.brands.list(orgId);
  }

  // ── Owner ────────────────────────────────────────────────────────────────────
  @Get("brands")
  @ApiBearerAuth()
  list(@CurrentOrg() orgId: string) {
    return this.brands.list(orgId);
  }

  @Post("brands")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  create(@CurrentOrg() orgId: string, @Body() dto: UpsertBrandDto) {
    return this.brands.create(orgId, dto);
  }

  @Patch("brands/:id")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpsertBrandDto) {
    return this.brands.update(orgId, id, dto);
  }

  @Delete("brands/:id")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.brands.remove(orgId, id);
  }
}
