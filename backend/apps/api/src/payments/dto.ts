import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateIntentDto {
  @ApiProperty({ enum: ["order", "pos_sale"], example: "order" })
  @IsIn(["order", "pos_sale"])
  target!: "order" | "pos_sale";

  @ApiPropertyOptional({ description: "Required when target=order" })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: "Required when target=pos_sale" })
  @IsOptional()
  @IsString()
  posSaleId?: string;

  @ApiProperty({ enum: ["cash", "card", "upi", "online"], example: "online" })
  @IsIn(["cash", "card", "upi", "online"])
  method!: "cash" | "card" | "upi" | "online";
}

/** Shape of the (stubbed) gateway webhook. Real Razorpay signs the raw body. */
export class WebhookDto {
  @ApiProperty({ description: "Gateway reference returned by the intent" })
  @IsString()
  @IsNotEmpty()
  gatewayRef!: string;

  @ApiProperty({ enum: ["paid", "failed"], example: "paid" })
  @IsIn(["paid", "failed"])
  status!: "paid" | "failed";
}
