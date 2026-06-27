import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportCandidates1730000000000 implements MigrationInterface {
  name = 'ReportCandidates1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_candidates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "post_id" uuid,
        "title" text NOT NULL,
        "summary" text NOT NULL,
        "category" text NOT NULL DEFAULT 'otro_problema_urbano',
        "status" text NOT NULL DEFAULT 'pendiente_revision',
        "priority" text NOT NULL DEFAULT 'media',
        "location_text" text,
        "lat" double precision,
        "lng" double precision,
        "evidence_urls" text[] NOT NULL DEFAULT '{}',
        "citizen_support_count" integer NOT NULL DEFAULT 0,
        "comments_count" integer NOT NULL DEFAULT 0,
        "ai_summary" text,
        "suggested_solution" text,
        "rejection_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_report_candidates" PRIMARY KEY ("id"),
        CONSTRAINT "fk_report_candidates_post" FOREIGN KEY ("post_id")
          REFERENCES "posts"("id") ON DELETE SET NULL,
        CONSTRAINT "chk_report_candidates_status" CHECK ("status" IN (
          'pendiente_revision', 'aprobado_para_informe', 'rechazado',
          'incluido_en_informe', 'enviado', 'resuelto'
        )),
        CONSTRAINT "chk_report_candidates_priority" CHECK ("priority" IN (
          'baja', 'media', 'alta', 'urgente'
        ))
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_report_candidates_status" ON "report_candidates" ("status");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_report_candidates_post" ON "report_candidates" ("post_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_report_candidates_created_at" ON "report_candidates" ("created_at");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_candidates";`);
  }
}
