-- =====================================================================
-- MAPIA · Unificación de contenido en una sola tabla (`posts`)
-- Fusiona reports (incidencias) y generated_news (noticias) en `posts`.
--
-- EJECUTAR EN ESTE ORDEN, con BACKUP previo de la BD:
--   SECCIÓN 1: esquema (idempotente, no destructivo)
--   SECCIÓN 2: migración de datos (idempotente por marcador en details)
--   SECCIÓN 3: limpieza/DROPS  -> SOLO después de desplegar el backend
--              repointed (que ya NO lee reports/generated_news).
-- Es seguro re-ejecutar las secciones 1 y 2.
-- =====================================================================

-- =====================================================================
-- SECCIÓN 1 · Esquema unificado en `posts` (idempotente)
-- =====================================================================
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "content_type"   text NOT NULL DEFAULT 'EVENT';
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "author_type"    text NOT NULL DEFAULT 'USER';
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "severity"       text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "source_name"    varchar(120);
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "source_url"     text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "details"        jsonb;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "location_name"  varchar(300);
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "radius_meters"  integer;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "show_on_map"    boolean NOT NULL DEFAULT true;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "dislikes_count" integer NOT NULL DEFAULT 0;

-- Contenido sin usuario (noticias/IA) y sin coordenadas (noticias no geolocalizadas).
ALTER TABLE "posts" ALTER COLUMN "author_id" DROP NOT NULL;
ALTER TABLE "posts" ALTER COLUMN "latitude"  DROP NOT NULL;
ALTER TABLE "posts" ALTER COLUMN "longitude" DROP NOT NULL;

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "reputation_score" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "idx_posts_content_type" ON "posts" ("content_type");
CREATE INDEX IF NOT EXISTS "idx_posts_author_type"  ON "posts" ("author_type");

-- =====================================================================
-- SECCIÓN 2 · Migración de datos -> `posts`  (idempotente)
-- =====================================================================

-- 2.a) reports (incidencias) -> posts (content_type='INCIDENT')
INSERT INTO "posts" (
  "id","author_id","title","description","type","content_type","author_type",
  "severity","latitude","longitude","address","location_name","show_on_map",
  "visibility","status","details","created_at","updated_at"
)
SELECT
  gen_random_uuid(),
  r."user_id",
  r."title",
  COALESCE(r."description", r."source_text", r."title"),
  (CASE
     WHEN r."category"='bloqueo' OR r."alert_type"='bloqueo' OR r."category"='marcha' THEN 'BLOCKADE'
     WHEN r."category"='accidente' THEN 'ACCIDENT'
     WHEN r."category" IN ('incendio','emergencia','seguridad') THEN 'SECURITY'
     WHEN r."category"='corte_servicio' OR r."category"='servicio_publico' THEN 'SERVICE_CUT'
     WHEN r."category"='transporte' THEN 'TRAFFIC'
     WHEN r."category" IN ('venta','venta_irregular','descuento','promocion')
          OR r."alert_type" IN ('sobreprecio','stock_bajo','producto_no_disponible') THEN 'SALE'
     WHEN r."category" IN ('fiesta','celebracion','evento_comunitario','concierto_libre',
                           'feria','entrada_folklorica','cultura','deporte') THEN 'PARTY'
     ELSE 'OTHER'
   END)::post_type_enum,
  'INCIDENT',
  (CASE WHEN r."user_id" IS NOT NULL THEN 'USER' ELSE 'AI' END),
  r."severity",
  r."latitude",
  r."longitude",
  COALESCE(r."zone", r."municipality", r."department"),
  r."zone",
  true,
  'PUBLIC'::post_visibility_enum,
  'PUBLISHED'::post_status_enum,
  (jsonb_build_object(
     'migratedFromReportId', r."id"::text,
     'alertType', r."alert_type",
     'category', r."category",
     'department', r."department",
     'municipality', r."municipality",
     'zone', r."zone",
     'product', r."product",
     'price', r."price",
     'confidence', r."confidence"
   ) || COALESCE(r."details", '{}'::jsonb)),
  r."created_at",
  r."updated_at"
FROM "reports" r
WHERE NOT EXISTS (
  SELECT 1 FROM "posts" p WHERE p."details"->>'migratedFromReportId' = r."id"::text
);

-- 2.b) report_images -> post_media (enlazando por el marcador)
INSERT INTO "post_media" ("id","post_id","url","type","storage_key","created_at")
SELECT gen_random_uuid(), p."id", ri."url", 'IMAGE', COALESCE(ri."path", ri."url"), ri."created_at"
FROM "report_images" ri
JOIN "posts" p ON p."details"->>'migratedFromReportId' = ri."report_id"::text
WHERE NOT EXISTS (
  SELECT 1 FROM "post_media" pm WHERE pm."post_id" = p."id" AND pm."url" = ri."url"
);

-- 2.c) generated_news (noticias) -> posts (content_type='NEWS', author_type='AI')
INSERT INTO "posts" (
  "id","author_id","title","description","type","content_type","author_type",
  "latitude","longitude","location_name","show_on_map",
  "source_name","source_url","visibility","status","details","created_at","updated_at"
)
SELECT
  gen_random_uuid(),
  NULL,
  g."title",
  COALESCE(g."content", g."title"),
  'NEWS'::post_type_enum,
  'NEWS',
  'AI',
  g."lat",
  g."lng",
  g."location_text",
  (g."lat" IS NOT NULL AND g."lng" IS NOT NULL),
  g."source",
  g."original_url",
  'PUBLIC'::post_visibility_enum,
  'PUBLISHED'::post_status_enum,
  jsonb_build_object(
    'migratedFromNewsId', g."id"::text,
    'category', g."category",
    'locationText', g."location_text",
    'isAiGenerated', true
  ),
  g."created_at",
  g."updated_at"
FROM "generated_news" g
WHERE NOT EXISTS (
  SELECT 1 FROM "posts" p WHERE p."details"->>'migratedFromNewsId' = g."id"::text
);

-- =====================================================================
-- SECCIÓN 3 · LIMPIEZA / DROPS  ⚠️ DESTRUCTIVO ⚠️
-- EJECUTAR SOLO DESPUÉS de desplegar el backend que ya NO usa estas tablas.
-- (Si lo corres antes, el mapa/incidencias/noticias dejarán de funcionar.)
-- Descomenta cuando el código repointed esté en producción:
-- =====================================================================
-- DROP TABLE IF EXISTS "report_images";
-- DROP TABLE IF EXISTS "report_ai_analysis";
-- DROP TABLE IF EXISTS "moderation_logs";
-- DROP TABLE IF EXISTS "reports";
-- DROP TABLE IF EXISTS "generated_news";
-- (Opcional) renombrar denuncias de moderación para evitar confusión:
-- ALTER TABLE "content_reports" RENAME TO "content_flags";
