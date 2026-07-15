import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class CreateStaffDto {
  @ApiProperty({ example: "Ravi Manager" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "ravi@acme.test" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "staffpass123", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: ["manager", "cashier"], example: "manager" })
  @IsIn(["manager", "cashier"])
  role!: "manager" | "cashier";

  @ApiPropertyOptional({ description: "Store the manager/cashier is scoped to" })
  @IsOptional()
  @IsString()
  storeId?: string;
}

export class UpdateStaffDto extends PartialType(CreateStaffDto) {}
