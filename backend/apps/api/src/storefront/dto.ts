import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CustomerRegisterDto {
  @ApiProperty({ example: "Asha Shopper" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "asha@shop.test" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "shopperpass", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class CustomerLoginDto {
  @ApiProperty({ example: "asha@shop.test" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "shopperpass" })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class GoogleAuthDto {
  @ApiProperty({ description: "Google ID token (JWT) obtained on the device" })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

export class CheckoutItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CheckoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storeId!: string;

  @ApiProperty({ enum: ["delivery", "pickup"], example: "pickup" })
  @IsIn(["delivery", "pickup"])
  fulfillmentType!: "delivery" | "pickup";

  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ description: "Chosen delivery address id" })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({ description: "Chosen delivery slot label" })
  @IsOptional()
  @IsString()
  slot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ValidateCouponDto {
  @ApiProperty({ example: "SAVE10" })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 50000 })
  @IsInt()
  @Min(0)
  subtotalCents!: number;
}

export class AddressDto {
  @ApiProperty({ example: "Home" })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ example: "Asha Shopper" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "+919876543210" })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: "12 MG Road" })
  @IsString()
  @IsNotEmpty()
  line1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty({ example: "Bengaluru" })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiProperty({ example: "560001" })
  @IsString()
  @IsNotEmpty()
  pincode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  isDefault?: boolean;
}

export class OtpRequestDto {
  @ApiProperty({ example: "+919876543210" })
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

export class OtpVerifyDto {
  @ApiProperty({ example: "+919876543210" })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ description: "Display name, used when creating a new customer" })
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateReviewDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: "Great value" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: "Fresh and well packaged." })
  @IsOptional()
  @IsString()
  body?: string;
}

export class ConfirmPaymentDto {
  @ApiProperty({ description: "gatewayRef returned by checkout" })
  @IsString()
  @IsNotEmpty()
  gatewayRef!: string;

  @ApiPropertyOptional({ enum: ["paid", "failed"], example: "paid" })
  @IsOptional()
  @IsIn(["paid", "failed"])
  status?: "paid" | "failed";
}
