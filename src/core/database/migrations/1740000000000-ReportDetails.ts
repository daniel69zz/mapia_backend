import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportDetails1740000000000 implements MigrationInterface {
  name = 'ReportDetails1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "details" jsonb;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "details";`);
  }
}
