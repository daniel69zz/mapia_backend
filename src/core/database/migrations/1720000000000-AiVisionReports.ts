import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reportes ciudadanos con análisis de imágenes por IA (Vertex AI / Gemini).
 * Extiende la tabla `reports` y agrega auditoría (report_ai_analysis) y
 * bitácora de moderación (moderation_logs). Usa PostGIS para cercanía.
 */
export class AiVisionReports1720000000000 implements MigrationInterface {
  name = 'AiVisionReports1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    // ── reports: columnas nuevas para el flujo IA ──────────────────────────
    await queryRunner.query(`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "user_id" uuid;`);
    await queryRunner.query(`ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "category" text;`);
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT '{}';`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "location" geography(Point, 4326);`,
    );

    // alert_type/severity dejan de ser obligatorios (los reportes por imagen no los usan)
    await queryRunner.query(`ALTER TABLE "reports" ALTER COLUMN "alert_type" DROP NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "reports" ALTER COLUMN "severity" DROP NOT NULL;`);

    // backfill de location desde lat/lng existentes
    await queryRunner.query(`
      UPDATE "reports"
         SET "location" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)
       WHERE "location" IS NULL AND "longitude" IS NOT NULL AND "latitude" IS NOT NULL;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reports_location_gist" ON "reports" USING GIST ("location");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reports_category" ON "reports" ("category");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reports_user" ON "reports" ("user_id");`,
    );

    // ── report_ai_analysis: respuesta cruda del modelo (auditoría) ─────────
    await queryRunner.query(`
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
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_analysis_report" ON "report_ai_analysis" ("report_id");`,
    );

    // ── moderation_logs: bitácora de transiciones de estado ────────────────
    await queryRunner.query(`
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
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_moderation_report" ON "moderation_logs" ("report_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "moderation_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "report_ai_analysis";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reports_user";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reports_category";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reports_location_gist";`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "location";`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "tags";`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "category";`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "user_id";`);
  }
}
