import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

/** Bootstrap a new organization together with its first owner user. */
export class RegisterDto {
  @ApiProperty({ example: "Acme Retail Pvt Ltd" })
  @IsString()
  @IsNotEmpty()
  organizationName!: string;

  @ApiProperty({ example: "Priya Owner" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "owner@acme.test" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "supersecret", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: "owner@acme.test" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "supersecret" })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class TokensDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}
