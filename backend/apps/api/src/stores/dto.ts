import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class CreateStoreDto {
  @ApiProperty({ example: "Acme — MG Road" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: "12 MG Road, Bengaluru" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "Asia/Kolkata" })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: "INR" })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateStoreDto extends PartialType(CreateStoreDto) {}

export class UpdateStoreConfigDto {
  @ApiProperty({
    description: "Arbitrary branding/config JSON (logo, colors, hours, delivery).",
    example: { logoUrl: "https://cdn/x.png", primaryColor: "#0af", deliveryEnabled: true },
  })
  @IsObject()
  config!: Record<string, unknown>;
}
