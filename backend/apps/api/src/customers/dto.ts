import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: "Aditi Sharma" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "+919876543210" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: "Private note, not shown to the shopper" })
  @IsOptional()
  @IsString()
  ownerNote?: string;
}

export class BlockCustomerDto {
  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  blocked!: boolean;
}
