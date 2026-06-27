import type { MigrationInterface, QueryRunner } from 'typeorm';

export class GeneratedNews1750000000000 implements MigrationInterface {
  name = 'GeneratedNews1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "generated_news" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" text NOT NULL,
        "content" text NOT NULL,
        "source" text NOT NULL,
        "original_url" text NOT NULL,
        "category" text NOT NULL DEFAULT 'noticia',
        "status" text NOT NULL DEFAULT 'published',
        "generated_by" text NOT NULL DEFAULT 'rss_polling',
        "is_ai_generated" boolean NOT NULL DEFAULT true,
        "map_item_id" uuid,
        "location_text" text,
        "lat" double precision,
        "lng" double precision,
        "published_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_generated_news" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_generated_news_url" ON "generated_news" ("original_url");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_generated_news_created_at" ON "generated_news" ("created_at");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "generated_news";`);
  }
}
