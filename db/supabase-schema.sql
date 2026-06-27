-- ============================================================
-- Mapia - Esquema completo para SUPABASE (ejecución MANUAL)
-- ------------------------------------------------------------
-- Pegar y ejecutar en: Supabase Dashboard -> SQL Editor -> New query.
-- Es IDEMPOTENTE: se puede correr varias veces sin error.
--
-- En Supabase NO se corren migraciones TypeORM. Este archivo es la ÚNICA
-- fuente del esquema en Supabase. En tu .env de Supabase deja:
--   DB_RUN_MIGRATIONS=false
--
-- (Las migraciones TypeORM en src/core/database/migrations/ son SOLO para el
--  desarrollo local con PostgreSQL nativo.)
-- ============================================================

-- ---------- Extensiones ----------
-- Si el editor las restringe, habilítalas también en
-- Dashboard -> Database -> Extensions (postgis, uuid-ossp, pgcrypto).
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Enums (idempotentes) ----------
DO $$ BEGIN
  CREATE TYPE "role_enum" AS ENUM ('USER','MODERATOR','ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "user_status_enum" AS ENUM ('ACTIVE','SUSPENDED','DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "post_type_enum" AS ENUM
    ('NEWS','NOVELTY','PARTY','FOOD_DEAL','SALE','TRAFFIC','BLOCKADE','ACCIDENT','SERVICE_CUT','SECURITY','LOST_FOUND','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "post_status_enum" AS ENUM
    ('PUBLISHED','IN_REVIEW','VERIFIED','RESOLVED','REJECTED','DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "post_visibility_enum" AS ENUM ('PUBLIC','HIDDEN','DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "report_reason_enum" AS ENUM ('SPAM','FALSE_INFO','OFFENSIVE','DANGEROUS','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- users ----------
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "email" varchar(255) NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "hashed_refresh_token" varchar(255),
  "role" "role_enum" NOT NULL DEFAULT 'USER',
  "status" "user_status_enum" NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "pk_users" PRIMARY KEY ("id"),
  CONSTRAINT "uq_users_email" UNIQUE ("email")
);

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS "profiles" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "user_id" uuid NOT NULL,
  "first_name" varchar(80) NOT NULL,
  "last_name" varchar(80) NOT NULL,
  "name" varchar(160) NOT NULL,
  "username" varchar(40) NOT NULL,
  "phone" varchar(20),
  "phone_verified" boolean NOT NULL DEFAULT false,
  "bio" varchar(280),
  "avatar_url" varchar(500),
  "avatar_key" varchar(500),
  "followers_count" int NOT NULL DEFAULT 0,
  "following_count" int NOT NULL DEFAULT 0,
  "posts_count" int NOT NULL DEFAULT 0,
  "likes_count" int NOT NULL DEFAULT 0,
  CONSTRAINT "pk_profiles" PRIMARY KEY ("id"),
  CONSTRAINT "uq_profiles_user" UNIQUE ("user_id"),
  CONSTRAINT "uq_profiles_username" UNIQUE ("username"),
  CONSTRAINT "fk_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- ---------- user_settings ----------
CREATE TABLE IF NOT EXISTS "user_settings" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "user_id" uuid NOT NULL,
  "language_code" varchar(8) NOT NULL DEFAULT 'es',
  "default_radius_km" numeric(5,2) NOT NULL DEFAULT 3,
  "notifications_enabled" boolean NOT NULL DEFAULT true,
  CONSTRAINT "pk_user_settings" PRIMARY KEY ("id"),
  CONSTRAINT "uq_user_settings_user" UNIQUE ("user_id"),
  CONSTRAINT "fk_user_settings_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- ---------- posts ----------
CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "author_id" uuid NOT NULL,
  "title" varchar(160) NOT NULL,
  "description" text NOT NULL,
  "type" "post_type_enum" NOT NULL,
  "status" "post_status_enum" NOT NULL DEFAULT 'PUBLISHED',
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "address" varchar(300),
  "is_verified" boolean NOT NULL DEFAULT false,
  "visibility" "post_visibility_enum" NOT NULL DEFAULT 'PUBLIC',
  "likes_count" int NOT NULL DEFAULT 0,
  "comments_count" int NOT NULL DEFAULT 0,
  "reports_count" int NOT NULL DEFAULT 0,
  CONSTRAINT "pk_posts" PRIMARY KEY ("id"),
  CONSTRAINT "fk_posts_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Columna geográfica + índices + trigger de sincronización con lat/lng.
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "location" geography(Point,4326);
CREATE INDEX IF NOT EXISTS "idx_posts_location"   ON "posts" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "idx_posts_type"       ON "posts" ("type");
CREATE INDEX IF NOT EXISTS "idx_posts_status"     ON "posts" ("status");
CREATE INDEX IF NOT EXISTS "idx_posts_visibility" ON "posts" ("visibility");
CREATE INDEX IF NOT EXISTS "idx_posts_author"     ON "posts" ("author_id");

CREATE OR REPLACE FUNCTION posts_set_location() RETURNS trigger AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_posts_set_location ON "posts";
CREATE TRIGGER trg_posts_set_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON "posts"
FOR EACH ROW EXECUTE FUNCTION posts_set_location();

-- ---------- post_media ----------
CREATE TABLE IF NOT EXISTS "post_media" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "post_id" uuid NOT NULL,
  "url" varchar(500) NOT NULL,
  "type" varchar(10) NOT NULL,
  "storage_key" varchar(500) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pk_post_media" PRIMARY KEY ("id"),
  CONSTRAINT "fk_post_media_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_post_media_post" ON "post_media" ("post_id");

-- ---------- comments ----------
CREATE TABLE IF NOT EXISTS "comments" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "post_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "content" text NOT NULL,
  "parent_id" uuid,
  CONSTRAINT "pk_comments" PRIMARY KEY ("id"),
  CONSTRAINT "fk_comments_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_comments_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_comments_parent" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_comments_post" ON "comments" ("post_id");

-- ---------- reactions ----------
CREATE TABLE IF NOT EXISTS "reactions" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "post_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "type" varchar(10) NOT NULL DEFAULT 'LIKE',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pk_reactions" PRIMARY KEY ("id"),
  CONSTRAINT "uq_reaction_post_user" UNIQUE ("post_id","user_id"),
  CONSTRAINT "fk_reactions_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_reactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_reactions_post" ON "reactions" ("post_id");

-- ---------- content_reports (reportes de moderación sobre posts) ----------
CREATE TABLE IF NOT EXISTS "content_reports" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "reporter_id" uuid NOT NULL,
  "post_id" uuid NOT NULL,
  "reason" "report_reason_enum" NOT NULL,
  "description" varchar(500),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pk_content_reports" PRIMARY KEY ("id"),
  CONSTRAINT "uq_report_reporter_post" UNIQUE ("reporter_id","post_id"),
  CONSTRAINT "fk_content_reports_reporter" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_content_reports_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_content_reports_post" ON "content_reports" ("post_id");

-- ---------- follows ----------
CREATE TABLE IF NOT EXISTS "follows" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "follower_id" uuid NOT NULL,
  "following_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pk_follows" PRIMARY KEY ("id"),
  CONSTRAINT "uq_follow_pair" UNIQUE ("follower_id","following_id"),
  CONSTRAINT "chk_follow_not_self" CHECK ("follower_id" <> "following_id"),
  CONSTRAINT "fk_follows_follower" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_follows_following" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_follows_follower"  ON "follows" ("follower_id");
CREATE INDEX IF NOT EXISTS "idx_follows_following" ON "follows" ("following_id");

-- ============================================================
-- Reportes ciudadanos (mapa de alertas de abastecimiento + IA de imagen)
-- ============================================================

-- ---------- reports ----------
-- Una sola tabla cubre dos flujos:
--   * Alertas de abastecimiento (alert_type/severity/product/price...).
--   * Reportes por imagen analizados con IA (category/tags + analisis en
--     report_ai_analysis). alert_type/severity quedan NULL en ese flujo.
CREATE TABLE IF NOT EXISTS "reports" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "title" text NOT NULL,
  "description" text,
  "category" text,
  "tags" text[] NOT NULL DEFAULT '{}',
  "product" text,
  "alert_type" text,
  "severity" text,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "location" geography(Point,4326),
  "department" text,
  "municipality" text,
  "zone" text,
  "price" numeric,
  "source_text" text,
  "confidence" numeric,
  "status" text NOT NULL DEFAULT 'active',
  "details" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pk_reports" PRIMARY KEY ("id"),
  CONSTRAINT "chk_reports_severity" CHECK ("severity" IN ('normal','low','medium','high')),
  CONSTRAINT "chk_reports_bolivia_bounds" CHECK (
    "latitude" >= -22.9 AND "latitude" <= -9.6 AND
    "longitude" >= -69.7 AND "longitude" <= -57.4
  )
);

-- Si "reports" ya existía de una versión anterior (sin las columnas de la IA de
-- visión), el CREATE de arriba se omite por IF NOT EXISTS. Estos ALTER garantizan
-- que las columnas existan igual (también idempotentes) antes de crear sus índices.
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "user_id"  uuid;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "tags"     text[] NOT NULL DEFAULT '{}';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "location" geography(Point,4326);
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "details"  jsonb;
ALTER TABLE "reports" ALTER COLUMN "alert_type" DROP NOT NULL;
ALTER TABLE "reports" ALTER COLUMN "severity"   DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_reports_location"      ON "reports" ("latitude","longitude");
CREATE INDEX IF NOT EXISTS "idx_reports_location_gist" ON "reports" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "idx_reports_department"    ON "reports" ("department");
CREATE INDEX IF NOT EXISTS "idx_reports_product"       ON "reports" ("product");
CREATE INDEX IF NOT EXISTS "idx_reports_alert_type"    ON "reports" ("alert_type");
CREATE INDEX IF NOT EXISTS "idx_reports_severity"      ON "reports" ("severity");
CREATE INDEX IF NOT EXISTS "idx_reports_category"      ON "reports" ("category");
CREATE INDEX IF NOT EXISTS "idx_reports_user"          ON "reports" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_reports_created_at"    ON "reports" ("created_at");

-- ---------- report_images ----------
CREATE TABLE IF NOT EXISTS "report_images" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "report_id" uuid NOT NULL,
  "url" text NOT NULL,
  "path" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pk_report_images" PRIMARY KEY ("id"),
  CONSTRAINT "fk_report_images_report" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_report_images_report" ON "report_images" ("report_id");

-- ---------- report_ai_analysis (respuesta cruda del modelo, auditoría) ----------
CREATE TABLE IF NOT EXISTS "report_ai_analysis" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "report_id" uuid NOT NULL,
  "image_id" uuid,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "category" text,
  "title" text,
  "description" text,
  "confidence" numeric,
  "tags" text[] NOT NULL DEFAULT '{}',
  "requires_review" boolean NOT NULL DEFAULT false,
  "detected_text" text,
  "safety_notes" text,
  "raw_response" jsonb NOT NULL,
  "latency_ms" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pk_report_ai_analysis" PRIMARY KEY ("id"),
  CONSTRAINT "fk_ai_analysis_report" FOREIGN KEY ("report_id")
    REFERENCES "reports"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_ai_analysis_image" FOREIGN KEY ("image_id")
    REFERENCES "report_images"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "idx_ai_analysis_report" ON "report_ai_analysis" ("report_id");

-- ---------- moderation_logs (bitácora de transiciones de estado) ----------
CREATE TABLE IF NOT EXISTS "moderation_logs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "report_id" uuid NOT NULL,
  "actor_id" uuid,
  "action" text NOT NULL,
  "from_status" text,
  "to_status" text,
  "reason" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pk_moderation_logs" PRIMARY KEY ("id"),
  CONSTRAINT "fk_moderation_logs_report" FOREIGN KEY ("report_id")
    REFERENCES "reports"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_moderation_report" ON "moderation_logs" ("report_id");

-- ---------- languages (catálogo + seed) ----------
CREATE TABLE IF NOT EXISTS "languages" (
  "code" varchar(8) NOT NULL,
  "name" varchar(60) NOT NULL,
  "native_name" varchar(60) NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  CONSTRAINT "pk_languages" PRIMARY KEY ("code")
);

INSERT INTO "languages" ("code","name","native_name","enabled") VALUES
  ('es','Spanish','Español',true),
  ('en','English','English',true),
  ('ay','Aymara','Aymar aru',true),
  ('qu','Quechua','Runa simi',true)
ON CONFLICT ("code") DO UPDATE
  SET "name" = EXCLUDED."name",
      "native_name" = EXCLUDED."native_name",
      "enabled" = EXCLUDED."enabled";

-- ---------- Neutralizar el runner de migraciones de TypeORM ----------
-- Registramos las migraciones como YA aplicadas. Así, aunque alguien arranque
-- la app con DB_RUN_MIGRATIONS=true por error, NO intentará recrear el esquema.
CREATE TABLE IF NOT EXISTS "mapia_migrations" (
  "id" SERIAL PRIMARY KEY,
  "timestamp" bigint NOT NULL,
  "name" varchar NOT NULL
);
INSERT INTO "mapia_migrations" ("timestamp","name")
SELECT v.ts, v.name FROM (VALUES
  (1700000000000, 'InitialSchema1700000000000'),
  (1710000000000, 'AlertReports1710000000000'),
  (1720000000000, 'AiVisionReports1720000000000'),
  (1730000000000, 'ReportCandidates1730000000000'),
  (1740000000000, 'ReportDetails1740000000000')
) AS v(ts, name)
WHERE NOT EXISTS (
  SELECT 1 FROM "mapia_migrations" m WHERE m."name" = v.name
);

-- Listo. Verificación:
SELECT PostGIS_Version() AS postgis, current_database() AS db;
