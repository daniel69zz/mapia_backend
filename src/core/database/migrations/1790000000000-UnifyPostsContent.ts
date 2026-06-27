import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase grande (etapa 1, NO destructiva): convierte `posts` en la tabla de
 * contenido unificado. Agrega columnas para representar también incidencias
 * (severity) y noticias (source_*, author_type=AI) además de eventos.
 * No borra nada; las etapas de migración de datos y eliminación de tablas
 * (reports / generated_news) van en migraciones posteriores.
 */
export class UnifyPostsContent1790000000000 implements MigrationInterface {
  name = 'UnifyPostsContent1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "content_type" text NOT NULL DEFAULT 'EVENT';`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "author_type" text NOT NULL DEFAULT 'USER';`,
    );
    await queryRunner.query(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "severity" text;`);
    await queryRunner.query(
      `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "source_name" varchar(120);`,
    );
    await queryRunner.query(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "source_url" text;`);
    await queryRunner.query(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "details" jsonb;`);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_posts_content_type" ON "posts" ("content_type");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_posts_author_type" ON "posts" ("author_type");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_author_type";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_content_type";`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "details";`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "source_url";`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "source_name";`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "severity";`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "author_type";`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "content_type";`);
  }
}
