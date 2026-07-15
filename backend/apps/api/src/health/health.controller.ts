import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../common/decorators";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({
    description: "Liveness probe — confirms the API process is up.",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        service: { type: "string", example: "sellivo-api" },
      },
    },
  })
  check(): { status: string; service: string } {
    return { status: "ok", service: "sellivo-api" };
  }

  @Get("ready")
  @ApiOkResponse({ description: "Readiness probe — confirms the database is reachable." })
  @ApiServiceUnavailableResponse({ description: "Database is not reachable." })
  async ready(): Promise<{ status: string; db: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", db: "up" };
  }
}
