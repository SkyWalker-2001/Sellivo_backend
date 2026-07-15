import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { ApiKeysService } from "./api-keys.service";
import { BackupService } from "./backup.service";
import { CurrentOrg, Roles } from "../common/decorators";

class CreateApiKeyDto {
  @IsString() @IsNotEmpty() name!: string;
}

@ApiTags("admin")
@ApiBearerAuth()
@Roles("owner")
@Controller()
export class AdminController {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly backup: BackupService,
  ) {}

  @Get("api-keys")
  @ApiOperation({ summary: "List API keys (owner)" })
  listKeys(@CurrentOrg() orgId: string) {
    return this.apiKeys.list(orgId);
  }

  @Post("api-keys")
  @ApiOperation({ summary: "Create an API key — the secret is returned once" })
  createKey(@CurrentOrg() orgId: string, @Body() dto: CreateApiKeyDto) {
    return this.apiKeys.create(orgId, dto.name);
  }

  @Delete("api-keys/:id")
  @ApiOperation({ summary: "Revoke an API key" })
  revokeKey(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.apiKeys.revoke(orgId, id);
  }

  @Get("admin/backup")
  @ApiOperation({ summary: "Export a full JSON backup of this organization's data" })
  exportBackup(@CurrentOrg() orgId: string) {
    return this.backup.export(orgId);
  }
}
