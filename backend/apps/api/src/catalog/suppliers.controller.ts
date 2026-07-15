import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SuppliersService } from "./suppliers.service";
import { UpsertSupplierDto } from "./dto";
import { CurrentOrg, Roles } from "../common/decorators";

@ApiTags("suppliers")
@ApiBearerAuth()
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list(@CurrentOrg() orgId: string) {
    return this.suppliers.list(orgId);
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentOrg() orgId: string, @Body() dto: UpsertSupplierDto) {
    return this.suppliers.create(orgId, dto);
  }

  @Patch(":id")
  @Roles("owner", "manager")
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpsertSupplierDto) {
    return this.suppliers.update(orgId, id, dto);
  }

  @Delete(":id")
  @Roles("owner", "manager")
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.suppliers.remove(orgId, id);
  }
}
