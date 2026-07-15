import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsNotEmpty, IsString } from "class-validator";

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
