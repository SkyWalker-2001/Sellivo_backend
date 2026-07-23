import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UpsertCouponDto {
  @ApiProperty({ example: "SAVE10" })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ enum: ["percent", "flat", "free_delivery"], example: "percent" })
  @IsIn(["percent", "flat", "free_delivery"])
  type!: "percent" | "flat" | "free_delivery";

  @ApiPropertyOptional({
    example: 10,
    description: "percent (1-100) or flat minor units; ignored for free_delivery",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ example: 20000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minSubtotalCents?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: 100, description: "Total redemptions across all customers. Null = unlimited." })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number | null;

  @ApiPropertyOptional({ example: 1, description: "Redemptions allowed per customer. Null = unlimited." })
  @IsOptional()
  @IsInt()
  @Min(1)
  perCustomerLimit?: number | null;

  @ApiPropertyOptional({ example: "2026-08-31T23:59:59.000Z", description: "Expiry timestamp (ISO 8601). Null = never." })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;
}
