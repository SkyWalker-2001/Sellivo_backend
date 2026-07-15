import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { InventoryService } from "./inventory.service";
import { CreateMovementDto } from "./dto";
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

  @Get("stores/:id/inventory")
  @ApiOperation({ summary: "Current on-hand per variant for a store" })
  storeInventory(@CurrentOrg() orgId: string, @Param("id") storeId: string) {
    return this.inventory.storeInventory(orgId, storeId);
  }
}
