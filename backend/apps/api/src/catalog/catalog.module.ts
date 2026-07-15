import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { BrandsController } from "./brands.controller";
import { BrandsService } from "./brands.service";
import { SuppliersController } from "./suppliers.controller";
import { SuppliersService } from "./suppliers.service";

@Module({
  controllers: [CatalogController, BrandsController, SuppliersController],
  providers: [CatalogService, BrandsService, SuppliersService],
  exports: [CatalogService],
})
export class CatalogModule {}
