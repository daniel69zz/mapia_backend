import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertReports1710000000000 implements MigrationInterface {
  name = 'AlertReports1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" text NOT NULL,
        "description" text,
        "product" text,
        "alert_type" text NOT NULL,
        "severity" text NOT NULL,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "department" text,
        "municipality" text,
        "zone" text,
        "price" numeric,
        "source_text" text,
        "confidence" numeric,
        "status" text NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_reports" PRIMARY KEY ("id"),
        CONSTRAINT "chk_reports_severity" CHECK ("severity" IN ('normal', 'low', 'medium', 'high')),
        CONSTRAINT "chk_reports_bolivia_bounds" CHECK (
          "latitude" >= -22.9 AND "latitude" <= -9.6 AND
          "longitude" >= -69.7 AND "longitude" <= -57.4
        )
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "report_id" uuid NOT NULL,
        "url" text NOT NULL,
        "path" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_report_images" PRIMARY KEY ("id"),
        CONSTRAINT "fk_report_images_report" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reports_location" ON "reports" ("latitude", "longitude");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reports_department" ON "reports" ("department");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reports_product" ON "reports" ("product");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reports_alert_type" ON "reports" ("alert_type");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reports_severity" ON "reports" ("severity");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reports_created_at" ON "reports" ("created_at");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_report_images_report" ON "report_images" ("report_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_images";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reports";`);
  }
}
