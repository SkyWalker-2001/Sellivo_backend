import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({ example: "Beverages" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: "Parent category id for nesting" })
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CreateProductDto {
  @ApiProperty({ example: "Cola 500ml" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "Acme Drinks" })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: "Brand id (first-class brand reference)" })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ description: "Supplier id" })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ type: [String], description: "Free-form tags" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: [String], description: "Image URLs" })
  @IsOptional()
  @IsArray()
  images?: string[];

  @ApiPropertyOptional({ description: "Free-form base attributes" })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class CreateVariantDto {
  @ApiProperty({ example: "COLA-500-RED" })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiPropertyOptional({ example: "8901234567890", description: "Barcode for POS scanning" })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ example: 4000, description: "Price in minor units (paise)" })
  @IsInt()
  @Min(0)
  priceCents!: number;

  @ApiPropertyOptional({ example: 5000, description: "MRP / list price in minor units (paise)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  mrpCents?: number;

  @ApiPropertyOptional({ example: 2500, description: "Cost in minor units (paise)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  costCents?: number;

  @ApiPropertyOptional({ example: "500", description: "Pack weight/size value" })
  @IsOptional()
  @IsString()
  weight?: string;

  @ApiPropertyOptional({ example: "g", description: "Unit (g, kg, ml, l, pcs)" })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 5, description: "GST rate percent" })
  @IsOptional()
  @IsInt()
  @Min(0)
  taxRatePct?: number;

  @ApiPropertyOptional({ example: "22021010", description: "HSN/SAC code" })
  @IsOptional()
  @IsString()
  hsnCode?: string;

  @ApiPropertyOptional({ example: { size: "500ml", color: "red" } })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class UpdateVariantDto extends PartialType(CreateVariantDto) {}

export class UpsertBrandDto {
  @ApiProperty({ example: "Acme Drinks" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: "/uploads/brands/acme.png" })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class UpsertSupplierDto {
  @ApiProperty({ example: "Metro Wholesale" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;
}

export class ImportProductRowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  priceCents!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  mrpCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  costCents?: number;
}

export class ImportProductsDto {
  @ApiProperty({ type: [ImportProductRowDto] })
  @IsArray()
  rows!: ImportProductRowDto[];
}
