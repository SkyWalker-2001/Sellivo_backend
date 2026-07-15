import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CatalogService } from "./catalog.service";
import {
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  ImportProductsDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from "./dto";
import { CurrentOrg, Roles } from "../common/decorators";

@ApiTags("catalog")
@ApiBearerAuth()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // Categories
  @Post("categories")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Create category" })
  createCategory(@CurrentOrg() orgId: string, @Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(orgId, dto);
  }

  @Get("categories")
  @ApiOperation({ summary: "List categories" })
  listCategories(@CurrentOrg() orgId: string) {
    return this.catalog.listCategories(orgId);
  }

  @Patch("categories/:id")
  @Roles("owner", "manager")
  updateCategory(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.catalog.updateCategory(orgId, id, dto);
  }

  // Products
  @Post("products")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Create product" })
  createProduct(@CurrentOrg() orgId: string, @Body() dto: CreateProductDto) {
    return this.catalog.createProduct(orgId, dto);
  }

  @Get("products")
  @ApiOperation({ summary: "List products with variants" })
  listProducts(@CurrentOrg() orgId: string) {
    return this.catalog.listProducts(orgId);
  }

  @Get("products/export")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Export catalog as CSV" })
  async exportProducts(@CurrentOrg() orgId: string) {
    return { csv: await this.catalog.exportProductsCsv(orgId) };
  }

  @Post("products/import")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Bulk import products from parsed CSV rows" })
  importProducts(@CurrentOrg() orgId: string, @Body() dto: ImportProductsDto) {
    return this.catalog.importProducts(orgId, dto.rows);
  }

  @Get("products/:id")
  getProduct(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.catalog.getProduct(orgId, id);
  }

  @Patch("products/:id")
  @Roles("owner", "manager")
  updateProduct(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(orgId, id, dto);
  }

  // Variants
  @Post("products/:id/variants")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Add a variant (SKU/barcode/price) to a product" })
  createVariant(
    @CurrentOrg() orgId: string,
    @Param("id") productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.catalog.createVariant(orgId, productId, dto);
  }

  @Patch("variants/:id")
  @Roles("owner", "manager")
  updateVariant(
    @CurrentOrg() orgId: string,
    @Param("id") id: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.catalog.updateVariant(orgId, id, dto);
  }

  @Delete("products/:id")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Delete a product (refused if it has sales history)" })
  deleteProduct(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.catalog.deleteProduct(orgId, id);
  }

  @Delete("variants/:id")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Delete a variant (refused if it has sales history)" })
  deleteVariant(@CurrentOrg() orgId: string, @Param("id") id: string) {
    return this.catalog.deleteVariant(orgId, id);
  }

  @Get("variants/by-barcode/:code")
  @ApiOperation({ summary: "POS barcode lookup — resolve a scan to a variant" })
  byBarcode(@CurrentOrg() orgId: string, @Param("code") code: string) {
    return this.catalog.findByBarcode(orgId, code);
  }
}
