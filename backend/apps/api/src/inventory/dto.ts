import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

/** Manual stock movement from the owner app: restock, adjustment, or return. */
export class CreateMovementDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storeId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ example: 50, description: "Signed change: +restock, -correction" })
  @IsInt()
  delta!: number;

  @ApiProperty({ enum: ["restock", "adjustment", "return"], example: "restock" })
  @IsIn(["restock", "adjustment", "return"])
  reason!: "restock" | "adjustment" | "return";
}

/** Set (or clear, with null) the per-store low-stock alert threshold for a variant. */
export class SetThresholdDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storeId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiPropertyOptional({
    example: 5,
    description: "Alert when on-hand <= this. null clears the alert.",
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  threshold?: number | null;
}
