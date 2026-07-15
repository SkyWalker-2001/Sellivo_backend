import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { CreateOrderDto, UpdateOrderStatusDto } from "./dto";
import { CurrentOrg, Roles } from "../common/decorators";

@ApiTags("orders")
@ApiBearerAuth()
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({ summary: "Create an online order (decrements stock)" })
  create(@CurrentOrg() orgId: string, @Body() dto: CreateOrderDto) {
    return this.orders.create(orgId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List orders" })
  list(@CurrentOrg() orgId: string) {
    return this.orders.list(orgId);
  }

  @Get(":id")
  get(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.orders.get(orgId, id);
  }

  @Patch(":id/status")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Update order fulfillment status" })
  updateStatus(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(orgId, id, dto.status);
  }
}
