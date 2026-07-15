import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class PosSaleItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 4000, description: "Unit price in paise" })
  @IsInt()
  @Min(0)
  unitPriceCents!: number;

  @ApiProperty({ example: 8000 })
  @IsInt()
  @Min(0)
  totalCents!: number;

  @ApiPropertyOptional({
    description: "Client-supplied UUID for this line's stock movement (offline idempotency)",
  })
  @IsOptional()
  @IsString()
  movementId?: string;
}

export class PosSaleDto {
  @ApiProperty({ description: "Client-generated idempotency key for the sale" })
  @IsString()
  @IsNotEmpty()
  clientUuid!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storeId!: string;

  @ApiProperty({ example: 8000 })
  @IsInt()
  @Min(0)
  subtotalCents!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  discountCents?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  taxCents?: number;

  @ApiProperty({ example: 8000 })
  @IsInt()
  @Min(0)
  totalCents!: number;

  @ApiProperty({ description: "When the sale was rung up offline (ISO 8601)" })
  @IsDateString()
  offlineCreatedAt!: string;

  @ApiPropertyOptional({ example: "cash", description: "cash | upi | card" })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: "Walk-in customer name (optional)" })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: "Walk-in customer phone (optional)" })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({ type: [PosSaleItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemDto)
  items!: PosSaleItemDto[];
}

export class SyncPushDto {
  @ApiProperty({ description: "POS device identifier" })
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @ApiProperty({ type: [PosSaleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosSaleDto)
  sales!: PosSaleDto[];
}
