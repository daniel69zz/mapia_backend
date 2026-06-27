import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PostDislikesAndReputation1770000000000 implements MigrationInterface {
  name = 'PostDislikesAndReputation1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "dislikes_count" integer NOT NULL DEFAULT 0;`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "reputation_score" integer NOT NULL DEFAULT 0;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "reputation_score";`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "dislikes_count";`);
  }
}
