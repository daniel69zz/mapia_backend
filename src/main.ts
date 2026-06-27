import { NestFactory } from '@nestjs/core';
import { Logger, VersioningType, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { AppConfig, StorageConfig } from '@core/config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });
  const config = app.get(ConfigService);
  const appCfg = config.get<AppConfig>('app')!;
  const storageCfg = config.get<StorageConfig>('storage')!;
  const logger = new Logger('Bootstrap');

  // Seguridad HTTP. Se desactiva la CSP/COEP por defecto de helmet porque
  // bloquean los assets inline que Swagger UI (/docs) necesita para renderizar.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.enableCors({
    origin: appCfg.corsOrigins.includes('*') ? true : appCfg.corsOrigins,
    credentials: true,
  });

  // Prefijo global /api/v1.
  app.setGlobalPrefix(appCfg.apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // Servir archivos locales (solo dev con STORAGE_DRIVER=local).
  if (storageCfg.driver === 'local') {
    app.useStaticAssets(join(process.cwd(), storageCfg.localDir), { prefix: '/static/' });
  }

  // Swagger en /docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mapia API')
    .setDescription('API del mapa social ciudadano de Mapia (La Paz, Bolivia)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(appCfg.port);
  logger.log(`Mapia API en http://localhost:${appCfg.port}/${appCfg.apiPrefix}`);
  logger.log(`Swagger en http://localhost:${appCfg.port}/docs`);
}

void bootstrap();
