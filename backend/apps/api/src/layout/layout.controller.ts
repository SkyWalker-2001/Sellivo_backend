import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { LayoutService } from "./layout.service";
import { CreateSectionDto, ReorderSectionsDto, UpdateSectionDto } from "./dto";
import { SECTION_TYPES } from "./default-layout";
import { CurrentOrg, Public, Roles } from "../common/decorators";

@ApiTags("layout")
@Controller()
export class LayoutController {
  constructor(private readonly layout: LayoutService) {}

  // ── Public: what the customer app renders ────────────────────────────────────
  @Public()
  @Get("storefront/orgs/:orgId/home-layout")
  @ApiOperation({ summary: "Published home layout for the customer app" })
  homeLayout(@Param("orgId") orgId: string, @Query("storeId") storeId?: string) {
    return this.layout.getPublished(orgId, storeId);
  }

  // ── Owner CMS ────────────────────────────────────────────────────────────────
  @Get("layout/section-types")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Available section types" })
  sectionTypes() {
    return SECTION_TYPES;
  }

  @Get("layout/draft")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Editable draft layout (owner)" })
  draft(@CurrentOrg() orgId: string, @Query("storeId") storeId?: string) {
    return this.layout.getDraft(orgId, storeId);
  }

  @Post("layout/sections")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  addSection(
    @CurrentOrg() orgId: string,
    @Body() dto: CreateSectionDto,
    @Query("storeId") storeId?: string,
  ) {
    return this.layout.addSection(orgId, storeId ?? null, dto);
  }

  @Patch("layout/sections/:id")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  updateSection(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.layout.updateSection(orgId, id, dto);
  }

  @Delete("layout/sections/:id")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  deleteSection(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.layout.deleteSection(orgId, id);
  }

  @Post("layout/sections/:id/duplicate")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  duplicateSection(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.layout.duplicateSection(orgId, id);
  }

  @Post("layout/reorder")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  reorder(
    @CurrentOrg() orgId: string,
    @Body() dto: ReorderSectionsDto,
    @Query("storeId") storeId?: string,
  ) {
    return this.layout.reorder(orgId, storeId ?? null, dto.orderedIds);
  }

  @Post("layout/publish")
  @Roles("owner", "manager")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Publish the draft so customers see it" })
  publish(@CurrentOrg() orgId: string, @Query("storeId") storeId?: string) {
    return this.layout.publish(orgId, storeId ?? null);
  }
}
