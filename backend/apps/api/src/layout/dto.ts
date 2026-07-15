import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import { SECTION_TYPES } from "./default-layout";

export class CreateSectionDto {
  @ApiProperty({ enum: SECTION_TYPES })
  @IsIn(SECTION_TYPES as unknown as string[])
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  dataSource?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateSectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  dataSource?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: "ISO date; null clears" })
  @IsOptional()
  @IsString()
  startAt?: string | null;

  @ApiPropertyOptional({ description: "ISO date; null clears" })
  @IsOptional()
  @IsString()
  endAt?: string | null;
}

export class ReorderSectionsDto {
  @ApiProperty({ type: [String], description: "Section ids in the new order" })
  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}
