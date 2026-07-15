import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

export class UpsertCouponDto {
  @ApiProperty({ example: "SAVE10" })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ enum: ["percent", "flat"], example: "percent" })
  @IsIn(["percent", "flat"])
  type!: "percent" | "flat";

  @ApiProperty({ example: 10, description: "percent (1-100) or flat minor units" })
  @IsInt()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ example: 20000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minSubtotalCents?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
