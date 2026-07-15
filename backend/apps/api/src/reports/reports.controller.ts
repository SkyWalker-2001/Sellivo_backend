import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { CurrentOrg, Roles } from "../common/decorators";

@ApiTags("reports")
@ApiBearerAuth()
@Roles("owner", "manager")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("sales-summary")
  @ApiOperation({ summary: "Sales totals + per-day breakdown (POS + online)" })
  @ApiQuery({ name: "days", required: false, example: 7 })
  @ApiQuery({ name: "storeId", required: false })
  salesSummary(
    @CurrentOrg() orgId: string,
    @Query("days", new DefaultValuePipe(7), ParseIntPipe) days: number,
    @Query("storeId") storeId?: string,
  ) {
    return this.reports.salesSummary(orgId, days, storeId);
  }

  @Get("dashboard")
  @ApiOperation({ summary: "Owner dashboard analytics (KPIs, top lists, series)" })
  @ApiQuery({ name: "days", required: false, example: 30 })
  @ApiQuery({ name: "storeId", required: false })
  dashboard(
    @CurrentOrg() orgId: string,
    @Query("days", new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query("storeId") storeId?: string,
  ) {
    return this.reports.dashboard(orgId, days, storeId);
  }

  @Get("low-stock")
  @ApiOperation({ summary: "Variants at or below a stock threshold" })
  @ApiQuery({ name: "threshold", required: false, example: 10 })
  @ApiQuery({ name: "storeId", required: false })
  lowStock(
    @CurrentOrg() orgId: string,
    @Query("threshold", new DefaultValuePipe(10), ParseIntPipe) threshold: number,
    @Query("storeId") storeId?: string,
  ) {
    return this.reports.lowStock(orgId, threshold, storeId);
  }
}
