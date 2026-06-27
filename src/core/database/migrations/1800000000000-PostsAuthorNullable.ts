import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase grande (etapa 2, NO destructiva): permite contenido sin usuario
 * (noticias/IA) en `posts` haciendo `author_id` nullable. La FK sigue intacta
 * (un null es válido). No borra ni transforma datos existentes.
 */
export class PostsAuthorNullable1800000000000 implements MigrationInterface {
  name = 'PostsAuthorNullable1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "author_id" DROP NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reponer NOT NULL solo si no quedaron filas con author_id nulo.
    await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "author_id" SET NOT NULL;`);
  }
}
