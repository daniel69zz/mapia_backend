import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PostLocationNameAndShowOnMap1780000000000 implements MigrationInterface {
  name = 'PostLocationNameAndShowOnMap1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "location_name" varchar(300);`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "show_on_map" boolean NOT NULL DEFAULT true;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "show_on_map";`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "location_name";`);
  }
}
