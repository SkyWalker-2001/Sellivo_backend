import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { CreateIntentDto, WebhookDto } from "./dto";
import { CurrentOrg, Public } from "../common/decorators";

@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("intent")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a payment intent for an order or POS sale" })
  createIntent(@CurrentOrg() orgId: string, @Body() dto: CreateIntentDto) {
    return this.payments.createIntent(orgId, dto);
  }

  @Public()
  @Post("webhook")
  @HttpCode(200)
  @ApiOperation({ summary: "Gateway webhook — settles a payment (source of truth)" })
  webhook(@Body() dto: WebhookDto) {
    return this.payments.handleWebhook(dto);
  }
}
