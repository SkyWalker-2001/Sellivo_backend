import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { StaffService } from "./staff.service";
import { CreateStaffDto, UpdateStaffDto } from "./dto";
import { CurrentOrg, Roles } from "../common/decorators";

@ApiTags("staff")
@ApiBearerAuth()
@Roles("owner")
@Controller("staff")
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @ApiOperation({ summary: "List organization staff (owner only)" })
  list(@CurrentOrg() orgId: string) {
    return this.staff.list(orgId);
  }

  @Post()
  @ApiOperation({ summary: "Create a manager or cashier" })
  create(@CurrentOrg() orgId: string, @Body() dto: CreateStaffDto) {
    return this.staff.create(orgId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update staff (role, store, password)" })
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpdateStaffDto) {
    return this.staff.update(orgId, id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Remove staff" })
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.staff.remove(orgId, id);
  }
}
