import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración inicial de Mapia (MVP).
 * - Activa PostGIS (+ uuid-ossp para uuid por defecto).
 * - Crea enums, tablas, FKs e índices.
 * - Columna geográfica posts.location geography(Point,4326) con índice GIST
 *   y trigger que la deriva de latitude/longitude.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Extensiones ---
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // --- Enums ---
    await queryRunner.query(`CREATE TYPE "role_enum" AS ENUM ('USER','MODERATOR','ADMIN');`);
    await queryRunner.query(
      `CREATE TYPE "user_status_enum" AS ENUM ('ACTIVE','SUSPENDED','DELETED');`,
    );
    await queryRunner.query(
      `CREATE TYPE "post_type_enum" AS ENUM ('NEWS','NOVELTY','PARTY','FOOD_DEAL','SALE','TRAFFIC','BLOCKADE','ACCIDENT','SERVICE_CUT','SECURITY','LOST_FOUND','OTHER');`,
    );
    await queryRunner.query(
      `CREATE TYPE "post_status_enum" AS ENUM ('PUBLISHED','IN_REVIEW','VERIFIED','RESOLVED','REJECTED','DELETED');`,
    );
    await queryRunner.query(
      `CREATE TYPE "post_visibility_enum" AS ENUM ('PUBLIC','HIDDEN','DELETED');`,
    );
    await queryRunner.query(
      `CREATE TYPE "report_reason_enum" AS ENUM ('SPAM','FALSE_INFO','OFFENSIVE','DANGEROUS','OTHER');`,
    );

    // --- users ---
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "email" varchar(255) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "hashed_refresh_token" varchar(255),
        "role" "role_enum" NOT NULL DEFAULT 'USER',
        "status" "user_status_enum" NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email")
      );
    `);

    // --- profiles ---
    await queryRunner.query(`
      CREATE TABLE "profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "first_name" varchar(80) NOT NULL,
        "last_name" varchar(80) NOT NULL,
        "name" varchar(160) NOT NULL,
        "username" varchar(40) NOT NULL,
        "phone" varchar(20),
        "phone_verified" boolean NOT NULL DEFAULT false,
        "bio" varchar(280),
        "avatar_url" varchar(500),
        "avatar_key" varchar(500),
        "followers_count" int NOT NULL DEFAULT 0,
        "following_count" int NOT NULL DEFAULT 0,
        "posts_count" int NOT NULL DEFAULT 0,
        "likes_count" int NOT NULL DEFAULT 0,
        CONSTRAINT "pk_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "uq_profiles_user" UNIQUE ("user_id"),
        CONSTRAINT "uq_profiles_username" UNIQUE ("username"),
        CONSTRAINT "fk_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    // --- user_settings ---
    await queryRunner.query(`
      CREATE TABLE "user_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "language_code" varchar(8) NOT NULL DEFAULT 'es',
        "default_radius_km" numeric(5,2) NOT NULL DEFAULT 3,
        "notifications_enabled" boolean NOT NULL DEFAULT true,
        CONSTRAINT "pk_user_settings" PRIMARY KEY ("id"),
        CONSTRAINT "uq_user_settings_user" UNIQUE ("user_id"),
        CONSTRAINT "fk_user_settings_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    // --- posts ---
    await queryRunner.query(`
      CREATE TABLE "posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "author_id" uuid NOT NULL,
        "title" varchar(160) NOT NULL,
        "description" text NOT NULL,
        "type" "post_type_enum" NOT NULL,
        "status" "post_status_enum" NOT NULL DEFAULT 'PUBLISHED',
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "address" varchar(300),
        "is_verified" boolean NOT NULL DEFAULT false,
        "visibility" "post_visibility_enum" NOT NULL DEFAULT 'PUBLIC',
        "likes_count" int NOT NULL DEFAULT 0,
        "comments_count" int NOT NULL DEFAULT 0,
        "reports_count" int NOT NULL DEFAULT 0,
        CONSTRAINT "pk_posts" PRIMARY KEY ("id"),
        CONSTRAINT "fk_posts_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    // Columna geográfica + índice GIST + trigger de sincronización.
    await queryRunner.query(`ALTER TABLE "posts" ADD COLUMN "location" geography(Point,4326);`);
    await queryRunner.query(
      `CREATE INDEX "idx_posts_location" ON "posts" USING GIST ("location");`,
    );
    await queryRunner.query(`CREATE INDEX "idx_posts_type" ON "posts" ("type");`);
    await queryRunner.query(`CREATE INDEX "idx_posts_status" ON "posts" ("status");`);
    await queryRunner.query(`CREATE INDEX "idx_posts_visibility" ON "posts" ("visibility");`);
    await queryRunner.query(`CREATE INDEX "idx_posts_author" ON "posts" ("author_id");`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION posts_set_location() RETURNS trigger AS $$
      BEGIN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_posts_set_location
      BEFORE INSERT OR UPDATE OF latitude, longitude ON "posts"
      FOR EACH ROW EXECUTE FUNCTION posts_set_location();
    `);

    // --- post_media ---
    await queryRunner.query(`
      CREATE TABLE "post_media" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "url" varchar(500) NOT NULL,
        "type" varchar(10) NOT NULL,
        "storage_key" varchar(500) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_post_media" PRIMARY KEY ("id"),
        CONSTRAINT "fk_post_media_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_post_media_post" ON "post_media" ("post_id");`);

    // --- comments ---
    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "post_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "content" text NOT NULL,
        "parent_id" uuid,
        CONSTRAINT "pk_comments" PRIMARY KEY ("id"),
        CONSTRAINT "fk_comments_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_comments_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_comments_parent" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_comments_post" ON "comments" ("post_id");`);

    // --- reactions ---
    await queryRunner.query(`
      CREATE TABLE "reactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "type" varchar(10) NOT NULL DEFAULT 'LIKE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_reactions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_reaction_post_user" UNIQUE ("post_id","user_id"),
        CONSTRAINT "fk_reactions_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_reactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_reactions_post" ON "reactions" ("post_id");`);

    // --- content_reports ---
    await queryRunner.query(`
      CREATE TABLE "content_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reporter_id" uuid NOT NULL,
        "post_id" uuid NOT NULL,
        "reason" "report_reason_enum" NOT NULL,
        "description" varchar(500),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_content_reports" PRIMARY KEY ("id"),
        CONSTRAINT "uq_report_reporter_post" UNIQUE ("reporter_id","post_id"),
        CONSTRAINT "fk_content_reports_reporter" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_content_reports_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_content_reports_post" ON "content_reports" ("post_id");`,
    );

    // --- follows ---
    await queryRunner.query(`
      CREATE TABLE "follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "follower_id" uuid NOT NULL,
        "following_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_follows" PRIMARY KEY ("id"),
        CONSTRAINT "uq_follow_pair" UNIQUE ("follower_id","following_id"),
        CONSTRAINT "chk_follow_not_self" CHECK ("follower_id" <> "following_id"),
        CONSTRAINT "fk_follows_follower" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_follows_following" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_follows_follower" ON "follows" ("follower_id");`);
    await queryRunner.query(`CREATE INDEX "idx_follows_following" ON "follows" ("following_id");`);

    // --- languages (catálogo) ---
    await queryRunner.query(`
      CREATE TABLE "languages" (
        "code" varchar(8) NOT NULL,
        "name" varchar(60) NOT NULL,
        "native_name" varchar(60) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        CONSTRAINT "pk_languages" PRIMARY KEY ("code")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "languages";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "follows";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "content_reports";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reactions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "comments";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "post_media";`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_posts_set_location ON "posts";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS posts_set_location();`);
    await queryRunner.query(`DROP TABLE IF EXISTS "posts";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_settings";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "profiles";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_reason_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "post_visibility_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "post_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "post_type_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "role_enum";`);
  }
}
