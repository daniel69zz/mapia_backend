import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PostRadius1760000000000 implements MigrationInterface {
  name = 'PostRadius1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "radius_meters" integer;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "radius_meters";`);
  }
}
