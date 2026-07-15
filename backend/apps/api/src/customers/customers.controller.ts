import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CustomersService } from "./customers.service";
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
}
