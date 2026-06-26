import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from '../config/configuration';

const isTsRuntime = __filename.endsWith('.ts');

/**
 * Conexión a PostgreSQL (Cloud SQL / PostGIS).
 *
 * Estrategia de host:
 *  - dev local / Cloud SQL Auth Proxy -> DB_HOST=localhost, DB_SSL=false
 *  - Cloud Run + IP privada            -> DB_HOST=<ip-privada>, DB_SSL según red
 *  - Cloud Run + socket                -> DB_HOST=/cloudsql/PROJECT:REGION:INSTANCE
 *  - IP pública                        -> DB_SSL=true
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.get<DatabaseConfig>('database')!;
        const isSocket = db.host.startsWith('/cloudsql');
        return {
          type: 'postgres',
          host: db.host,
          port: isSocket ? undefined : db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          ssl: db.ssl ? { rejectUnauthorized: false } : false,
          extra: isSocket ? { socketPath: db.host } : undefined,
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: db.runMigrations,
          migrations: [
            isTsRuntime
              ? 'src/core/database/migrations/*.ts'
              : 'dist/core/database/migrations/*.js',
          ],
          migrationsTableName: 'mapia_migrations',
          logging: configService.get<string>('app.nodeEnv') === 'development',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
