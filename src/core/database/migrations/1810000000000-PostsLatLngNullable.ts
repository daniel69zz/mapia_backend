import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase grande (etapa 2, NO destructiva): permite contenido sin coordenadas
 * (noticias no geolocalizadas) en `posts`. El trigger posts_set_location
 * tolera lat/lng nulos (ST_MakePoint(NULL,NULL) -> NULL).
 */
export class PostsLatLngNullable1810000000000 implements MigrationInterface {
  name = 'PostsLatLngNullable1810000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "latitude" DROP NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "longitude" DROP NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "longitude" SET NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "posts" ALTER COLUMN "latitude" SET NOT NULL;`);
  }
}
