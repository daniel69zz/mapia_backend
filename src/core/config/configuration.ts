/**
 * Configuración tipada derivada de las variables de entorno (ya validadas por Joi).
 * Se consume vía ConfigService.get<...>('app'|'database'|...).
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  isProduction: boolean;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  runMigrations: boolean;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

export interface StorageConfig {
  driver: 'local' | 'gcs' | 'supabase';
  localDir: string;
  publicUrl: string;
  gcsBucket: string;
  gcpProjectId: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseBucket: string;
}

export interface MapsConfig {
  apiKey: string;
  geocodingEnabled: boolean;
  placesEnabled: boolean;
}

export interface AiConfig {
  enabled: boolean;
  useVertex: boolean;
  project: string;
  location: string;
  model: string;
  apiKey: string; // solo para AI Studio (fallback)
  autoPublishThreshold: number;
  reviewThreshold: number;
}

export interface GeoConfig {
  defaultRadiusKm: number;
  maxRadiusKm: number;
}

export interface ThrottleConfig {
  ttl: number;
  limit: number;
}

const toBool = (v: string | undefined, def = false): boolean =>
  v === undefined ? def : v === 'true' || v === '1';

export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    isProduction: process.env.NODE_ENV === 'production',
  } as AppConfig,

  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'mapia_user',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'mapia_db',
    ssl: toBool(process.env.DB_SSL, false),
    runMigrations: toBool(process.env.DB_RUN_MIGRATIONS, true),
  } as DatabaseConfig,

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change_me_access',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change_me_refresh',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  } as JwtConfig,

  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 'gcs' | 'supabase',
    localDir: process.env.STORAGE_LOCAL_DIR ?? 'uploads',
    publicUrl: process.env.STORAGE_PUBLIC_URL ?? 'http://localhost:3000/static',
    gcsBucket: process.env.GCS_BUCKET_NAME ?? 'mapia-media',
    gcpProjectId: process.env.GCP_PROJECT_ID ?? '',
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'alert-images',
  } as StorageConfig,

  maps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
    geocodingEnabled: toBool(process.env.GOOGLE_MAPS_GEOCODING_ENABLED, true),
    placesEnabled: toBool(process.env.GOOGLE_MAPS_PLACES_ENABLED, true),
  } as MapsConfig,

  ai: {
    enabled: toBool(process.env.AI_VISION_ENABLED, false),
    useVertex: toBool(process.env.GOOGLE_GENAI_USE_VERTEXAI, true),
    project: process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT_ID ?? '',
    location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
    apiKey: process.env.GEMINI_API_KEY ?? '',
    autoPublishThreshold: parseFloat(process.env.AI_AUTO_PUBLISH_THRESHOLD ?? '0.85'),
    reviewThreshold: parseFloat(process.env.AI_REVIEW_THRESHOLD ?? '0.6'),
  } as AiConfig,

  geo: {
    defaultRadiusKm: parseFloat(process.env.DEFAULT_RADIUS_KM ?? '3'),
    maxRadiusKm: parseFloat(process.env.MAX_RADIUS_KM ?? '50'),
  } as GeoConfig,

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  } as ThrottleConfig,
});
