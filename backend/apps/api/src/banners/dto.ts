import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpsertBannerDto {
  @ApiProperty({ example: "/uploads/banners/sale.jpg" })
  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional({ enum: ["none", "category", "product", "offer", "url", "page"] })
  @IsOptional()
  @IsIn(["none", "category", "product", "offer", "url", "page"])
  actionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actionValue?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: "ISO date; null clears" })
  @IsOptional()
  @IsString()
  startAt?: string | null;

  @ApiPropertyOptional({ description: "ISO date; null clears" })
  @IsOptional()
  @IsString()
  endAt?: string | null;
}
