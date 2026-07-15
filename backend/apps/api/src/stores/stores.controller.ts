import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { StoresService } from "./stores.service";
import { CreateStoreDto, UpdateStoreConfigDto, UpdateStoreDto } from "./dto";
import { CurrentOrg, Roles } from "../common/decorators";

@ApiTags("stores")
@ApiBearerAuth()
@Controller("stores")
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Post()
  @Roles("owner")
  @ApiOperation({ summary: "Create a store (owner only)" })
  create(@CurrentOrg() orgId: string, @Body() dto: CreateStoreDto) {
    return this.stores.create(orgId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List stores in the organization" })
  list(@CurrentOrg() orgId: string) {
    return this.stores.list(orgId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one store" })
  get(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.stores.get(orgId, id);
  }

  @Patch(":id")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Update store details" })
  update(@CurrentOrg() orgId: string, @Param("id") id: string, @Body() dto: UpdateStoreDto) {
    return this.stores.update(orgId, id, dto);
  }

  @Patch(":id/config")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Update store branding/config JSON" })
  updateConfig(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateStoreConfigDto,
  ) {
    return this.stores.updateConfig(orgId, id, dto.config);
  }
}
