import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { UPLOAD_DIR } from "./media/media.controller";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Honor X-Forwarded-Proto/Host from the reverse proxy (ngrok, load balancer)
  // so req.protocol is "https" and uploaded-media URLs are built as https://…
  // rather than http://… (Android blocks cleartext image URLs).
  app.set("trust proxy", true);

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  // Serve uploaded media at /uploads/* (outside the /api prefix).
  app.useStaticAssets(join(process.cwd(), UPLOAD_DIR), { prefix: `/${UPLOAD_DIR}/` });

  // OpenAPI — this is the contract the Flutter api_client is generated from (PLAN.md §2).
  const config = new DocumentBuilder()
    .setTitle("Sellivo API")
    .setDescription("Multi-tenant retail platform — central API")
    .setVersion("0.0.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document, {
    jsonDocumentUrl: "docs/openapi.json",
  });

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  Logger.log(`Sellivo API listening on http://localhost:${port}`, "Bootstrap");
  Logger.log(`OpenAPI docs at http://localhost:${port}/docs`, "Bootstrap");
}

void bootstrap();
