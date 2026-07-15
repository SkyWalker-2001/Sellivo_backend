import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import type { Request } from "express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../common/decorators";

export const UPLOAD_DIR = "uploads";
const ALLOWED = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

/**
 * Local-disk media upload for MVP (PLAN.md §2 targets S3-compatible storage;
 * swapping the storage driver here is a Phase 3+ change). Files are served
 * statically from /uploads (configured in main.ts).
 */
@ApiTags("media")
@ApiBearerAuth()
@Controller("media")
export class MediaController {
  @Post("upload")
  @Roles("owner", "manager")
  @ApiOperation({ summary: "Upload an image, returns its public URL" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: `./${UPLOAD_DIR}`,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          if (!ALLOWED.has(ext)) return cb(new BadRequestException("Unsupported file type"), "");
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: Request) {
    if (!file) throw new BadRequestException("No file uploaded");
    const base = `${req.protocol}://${req.get("host")}`;
    return { url: `${base}/${UPLOAD_DIR}/${file.filename}`, filename: file.filename };
  }
}
