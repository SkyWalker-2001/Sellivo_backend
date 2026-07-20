import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { InventoryService } from "./inventory.service";
import { CreateMovementDto, SetThresholdDto } from "./dto";
import { CurrentOrg, Roles } from "../common/decorators";

@ApiTags("inventory")
@ApiBearerAuth()
@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post("inventory/movements")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Record a stock movement (restock/adjustment/return)" })
  createMovement(@CurrentOrg() orgId: string, @Body() dto: CreateMovementDto) {
    return this.inventory.createMovement(orgId, dto);
  }

  @Put("inventory/threshold")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Set/clear a variant's per-store low-stock alert threshold" })
  setThreshold(@CurrentOrg() orgId: string, @Body() dto: SetThresholdDto) {
    return this.inventory.setThreshold(orgId, dto.storeId, dto.variantId, dto.threshold ?? null);
  }

  @Get("stores/:id/inventory")
  @ApiOperation({ summary: "Current on-hand per variant for a store" })
  storeInventory(@CurrentOrg() orgId: string, @Param("id") storeId: string) {
    return this.inventory.storeInventory(orgId, storeId);
  }

  @Get("stores/:id/inventory/movements")
  @ApiOperation({ summary: "Stock movement ledger/history for a store" })
  movements(
    @CurrentOrg() orgId: string,
    @Param("id") storeId: string,
    @Query("variantId") variantId?: string,
  ) {
    return this.inventory.movements(orgId, storeId, { variantId });
  }
}
