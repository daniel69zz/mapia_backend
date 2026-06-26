import { NestFactory } from '@nestjs/core';
import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppConfig } from '@core/config/configuration';
import { RssAppModule } from './rss-app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(RssAppModule, {
    bufferLogs: false,
  });
  const config = app.get(ConfigService);
  const appCfg = config.get<AppConfig>('app')!;
  const logger = new Logger('RssBootstrap');

  app.use(helmet());
  app.enableCors({
    origin: appCfg.corsOrigins.includes('*') ? true : appCfg.corsOrigins,
    credentials: true,
  });

  app.setGlobalPrefix(appCfg.apiPrefix);
  app.enableVersioning({ type: VersioningType.URI });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mapia RSS Experimental API')
    .setDescription('Proxy experimental de noticias RSS sin conexion a base de datos')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(appCfg.port);
  logger.log(
    `Mapia RSS experimental en http://localhost:${appCfg.port}/${appCfg.apiPrefix}/experimental/news/el-deber`,
  );
}

void bootstrap();
