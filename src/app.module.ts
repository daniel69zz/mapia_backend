import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ValidationPipe } from '@nestjs/common';

import configuration from '@core/config/configuration';
import { envValidationSchema } from '@core/env/env.validation';
import { DatabaseModule } from '@core/database/database.module';
import { SecurityModule } from '@core/security/security.module';
import { StorageModule } from '@core/storage/storage.module';

import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';

import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { ProfilesModule } from '@modules/profiles/profiles.module';
import { PostsModule } from '@modules/posts/posts.module';
import { PostMediaModule } from '@modules/post-media/post-media.module';
import { CommentsModule } from '@modules/comments/comments.module';
import { ReactionsModule } from '@modules/reactions/reactions.module';
import { MapModule } from '@modules/map/map.module';
import { AlertsModule } from '@modules/alerts/alerts.module';
import { LocationsModule } from '@modules/locations/locations.module';
import { SettingsModule } from '@modules/settings/settings.module';
import { LanguagesModule } from '@modules/languages/languages.module';
import { ReportsModule } from '@modules/reports/reports.module';
import { ReportCandidatesModule } from '@modules/report-candidates/report-candidates.module';
import { NewsModule } from '@modules/news/news.module';
import { ChatbotModule } from '@modules/chatbot/chatbot.module';
import { FollowsModule } from '@modules/follows/follows.module';
import { HealthModule } from '@modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl', 60) * 1000,
          limit: config.get<number>('throttle.limit', 120),
        },
      ],
    }),

    // Infraestructura
    DatabaseModule,
    SecurityModule,
    StorageModule,

    // Módulos MVP
    AuthModule,
    UsersModule,
    ProfilesModule,
    PostsModule,
    PostMediaModule,
    CommentsModule,
    ReactionsModule,
    MapModule,
    AlertsModule,
    LocationsModule,
    SettingsModule,
    LanguagesModule,
    ReportsModule,
    ReportCandidatesModule,
    NewsModule,
    ChatbotModule,
    FollowsModule,
    HealthModule,
  ],
  providers: [
    // Validación global de DTOs.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    // Rate limiting global.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Autenticación global (rutas se abren con @Public()).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Autorización por rol (@Roles()).
    { provide: APP_GUARD, useClass: RolesGuard },
    // Manejo uniforme de errores.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Logging de requests.
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
