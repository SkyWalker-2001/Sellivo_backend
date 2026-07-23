import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CustomersService } from "./customers.service";
import { BlockCustomerDto, UpdateCustomerDto } from "./dto";
import { CurrentOrg, Roles } from "../common/decorators";

@ApiTags("customers")
@ApiBearerAuth()
@Roles("owner", "manager")
@Controller("customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({ summary: "Customer directory (owner)" })
  list(@CurrentOrg() orgId: string) {
    return this.customers.list(orgId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Customer detail + order history" })
  get(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.customers.get(orgId, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit a customer's contact details / note" })
  update(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(orgId, id, dto);
  }

  @Post(":id/block")
  @ApiOperation({ summary: "Block or unblock a customer" })
  setBlocked(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: BlockCustomerDto,
  ) {
    return this.customers.setBlocked(orgId, id, dto.blocked);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a customer (orders are kept)" })
  remove(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.customers.remove(orgId, id);
  }
}
