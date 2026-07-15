import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { ApiKeysService } from "./api-keys.service";
import { BackupService } from "./backup.service";

@Module({
  controllers: [AdminController],
  providers: [ApiKeysService, BackupService],
  exports: [ApiKeysService],
})
export class AdminModule {}
