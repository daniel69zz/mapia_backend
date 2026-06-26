import 'dotenv/config';
import 'tsconfig-paths/register';
import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * DataSource usado por la CLI de TypeORM (migraciones).
 * La app en runtime usa DatabaseModule (forRootAsync), pero comparte la misma
 * configuración base para mantener consistencia.
 *
 * NOTA: NUNCA synchronize: true. El esquema se gobierna con migraciones.
 */
const toBool = (v: string | undefined, def = false): boolean =>
  v === undefined ? def : v === 'true' || v === '1';

const isTsRuntime = __filename.endsWith('.ts');

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'mapia_user',
  password: process.env.DB_PASSWORD ?? 'mapia_password',
  database: process.env.DB_DATABASE ?? 'mapia_db',
  ssl: toBool(process.env.DB_SSL, false) ? { rejectUnauthorized: false } : false,
  synchronize: false,
  // Globs: en dev (ts-node) toma .ts; tras compilar toma .js en dist/.
  entities: ['src/**/*.entity.{ts,js}', 'dist/**/*.entity.js'],
  migrations: [
    isTsRuntime
      ? 'src/core/database/migrations/*.{ts,js}'
      : 'dist/core/database/migrations/*.js',
  ],
  migrationsTableName: 'mapia_migrations',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
