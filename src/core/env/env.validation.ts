import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ORIGINS: Joi.string().default('*'),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().default('mapia_user'),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_DATABASE: Joi.string().default('mapia_db'),
  DB_SSL: Joi.boolean().truthy('true').truthy('1').falsy('false').falsy('0').default(false),
  DB_RUN_MIGRATIONS: Joi.boolean()
    .truthy('true')
    .truthy('1')
    .falsy('false')
    .falsy('0')
    .default(true),

  JWT_ACCESS_SECRET: Joi.string().min(8).default('change_me_access'),
  JWT_REFRESH_SECRET: Joi.string().min(8).default('change_me_refresh'),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  STORAGE_DRIVER: Joi.string().valid('local', 'gcs', 'supabase').default('local'),
  STORAGE_LOCAL_DIR: Joi.string().default('uploads'),
  STORAGE_PUBLIC_URL: Joi.string()
    .uri({ allowRelative: false })
    .default('http://localhost:3000/static'),
  GCS_BUCKET_NAME: Joi.string().allow('').default('mapia-media'),
  GCP_PROJECT_ID: Joi.string().allow('').default(''),

  GOOGLE_MAPS_API_KEY: Joi.string().allow('').default(''),
  GOOGLE_MAPS_SERVER_API_KEY: Joi.string().allow('').default(''),
  GOOGLE_MAPS_GEOCODING_ENABLED: Joi.boolean()
    .truthy('true')
    .truthy('1')
    .falsy('false')
    .falsy('0')
    .default(true),
  GOOGLE_MAPS_PLACES_ENABLED: Joi.boolean()
    .truthy('true')
    .truthy('1')
    .falsy('false')
    .falsy('0')
    .default(true),

  // IA de visión (Vertex AI / Gemini). Apagado por defecto: si está OFF el endpoint
  // responde 503 en vez de romper el arranque cuando no hay credenciales.
  AI_VISION_ENABLED: Joi.boolean()
    .truthy('true')
    .truthy('1')
    .falsy('false')
    .falsy('0')
    .default(false),
  GOOGLE_GENAI_USE_VERTEXAI: Joi.boolean()
    .truthy('true')
    .truthy('1')
    .falsy('false')
    .falsy('0')
    .default(true),
  GOOGLE_CLOUD_PROJECT: Joi.string().allow('').default(''),
  GOOGLE_CLOUD_LOCATION: Joi.string().allow('').default('us-central1'),
  GEMINI_MODEL: Joi.string().allow('').default('gemini-2.0-flash'),
  GEMINI_API_KEY: Joi.string().allow('').default(''),
  AI_AUTO_PUBLISH_THRESHOLD: Joi.number().min(0).max(1).default(0.85),
  AI_REVIEW_THRESHOLD: Joi.number().min(0).max(1).default(0.6),

  SUPABASE_URL: Joi.string().allow('').default(''),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().allow('').default(''),
  SUPABASE_ANON_KEY: Joi.string().allow('').default(''),
  SUPABASE_STORAGE_BUCKET: Joi.string().allow('').default('alert-images'),

  DEFAULT_RADIUS_KM: Joi.number().positive().default(3),
  MAX_RADIUS_KM: Joi.number().positive().default(50),
  THROTTLE_TTL: Joi.number().integer().positive().default(60),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(120),
}).unknown(true);
