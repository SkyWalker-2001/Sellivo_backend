import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import type { OrderStatus } from "@prisma/client";

export class OrderItemInputDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ enum: ["delivery", "pickup"], example: "pickup" })
  @IsIn(["delivery", "pickup"])
  fulfillmentType!: "delivery" | "pickup";

  @ApiProperty({ type: [OrderItemInputDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @ApiPropertyOptional({ description: "Promo code to apply" })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ description: "Formatted delivery address" })
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @ApiPropertyOptional({ description: "Chosen delivery slot label" })
  @IsOptional()
  @IsString()
  deliverySlot?: string;

  @ApiPropertyOptional({ description: "Order notes" })
  @IsOptional()
  @IsString()
  notes?: string;
}

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "packed",
  "ready",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "refund_requested",
  "refund_approved",
  "refunded",
];

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ORDER_STATUSES })
  @IsIn(ORDER_STATUSES)
  status!: OrderStatus;

  @ApiPropertyOptional({ description: "Optional note recorded in the status history" })
  @IsOptional()
  @IsString()
  note?: string;
}

export class AssignOrderDto {
  @ApiProperty({ description: "Delivery-role staff user id" })
  @IsString()
  @IsNotEmpty()
  staffId!: string;
}

export class DeliverOrderDto {
  @ApiProperty({ example: "1234", description: "4-digit code the customer reads out" })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
