import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { AssignOrderDto, CreateOrderDto, DeliverOrderDto, UpdateOrderStatusDto } from "./dto";
import { CurrentOrg, CurrentUser, Roles } from "../common/decorators";

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
  @ApiQuery({ name: "storeId", required: false, description: "Filter to one store" })
  @ApiQuery({ name: "q", required: false, description: "Search id / customer name / phone / address" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "skip", required: false, type: Number })
  @ApiQuery({ name: "take", required: false, type: Number })
  list(
    @CurrentOrg() orgId: string,
    @Query("storeId") storeId?: string,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    return this.orders.list(orgId, {
      storeId,
      q,
      status,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get("summary")
  @ApiOperation({ summary: "Order dashboard KPIs (today's counts, revenue, AOV, per-status)" })
  @ApiQuery({ name: "storeId", required: false })
  summary(@CurrentOrg() orgId: string, @Query("storeId") storeId?: string) {
    return this.orders.summary(orgId, storeId);
  }

  @Get("assigned")
  @Roles("delivery", "owner", "manager")
  @ApiOperation({ summary: "Current rider's active deliveries" })
  assigned(@CurrentOrg() orgId: string, @CurrentUser("userId") userId: string) {
    return this.orders.assignedOrders(orgId, userId);
  }

  @Get(":id")
  get(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.orders.get(orgId, id);
  }

  @Patch(":id/status")
  @Roles("owner", "manager", "cashier")
  @ApiOperation({ summary: "Update order fulfillment status" })
  updateStatus(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(orgId, id, dto.status, dto.note);
  }

  @Patch(":id/assign")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Assign an order to a delivery rider" })
  assign(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: AssignOrderDto) {
    return this.orders.assign(orgId, id, dto.staffId);
  }

  @Post(":id/deliver")
  @Roles("delivery", "owner", "manager")
  @ApiOperation({ summary: "Mark delivered by verifying the customer's 4-digit code" })
  deliver(
    @CurrentOrg() orgId: string,
    @CurrentUser("userId") userId: string,
    @Param("id") id: string,
    @Body() dto: DeliverOrderDto,
  ) {
    return this.orders.deliver(orgId, id, userId, dto.code);
  }
}
