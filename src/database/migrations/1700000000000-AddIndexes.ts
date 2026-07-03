import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexes1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Core table indexes — these tables always exist
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_username" ON "users" ("username")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_is_active" ON "users" ("is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_posts_author_id" ON "posts" ("author_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_posts_created_at" ON "posts" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_posts_likes_count" ON "posts" ("likes_count" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_comments_post_id" ON "comments" ("post_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_comments_author_id" ON "comments" ("author_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_comments_parent_id" ON "comments" ("parent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_likes_post_id" ON "likes" ("post_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_likes_user_id" ON "likes" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_follows_follower_id" ON "follows" ("follower_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_follows_following_id" ON "follows" ("following_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_blocks_blocker_id" ON "blocks" ("blocker_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_blocks_blocked_id" ON "blocks" ("blocked_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_conversation_id" ON "messages" ("conversation_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_sender_id" ON "messages" ("sender_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_is_read" ON "messages" ("is_read")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_recipient_id" ON "notifications" ("recipient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_is_read" ON "notifications" ("is_read")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_type" ON "notifications" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_created_at" ON "notifications" ("created_at" DESC)`,
    );

    // Optional table indexes — only create if the table exists
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hashtags') THEN
          CREATE INDEX IF NOT EXISTS "IDX_hashtags_name" ON "hashtags" ("name");
          CREATE INDEX IF NOT EXISTS "IDX_hashtags_posts_count" ON "hashtags" ("posts_count" DESC);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stories') THEN
          CREATE INDEX IF NOT EXISTS "IDX_stories_author_id" ON "stories" ("author_id");
          CREATE INDEX IF NOT EXISTS "IDX_stories_expires_at" ON "stories" ("expires_at");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reports') THEN
          CREATE INDEX IF NOT EXISTS "IDX_reports_entity_id" ON "reports" ("entity_id");
          CREATE INDEX IF NOT EXISTS "IDX_reports_status" ON "reports" ("status");
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_entity_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stories_expires_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stories_author_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hashtags_posts_count"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hashtags_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_is_read"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_recipient_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_is_read"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_sender_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_conversation_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_blocks_blocked_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_blocks_blocker_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_follows_following_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_follows_follower_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_likes_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_likes_post_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comments_parent_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comments_author_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comments_post_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_likes_count"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_posts_author_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_is_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_username"`);
  }
}
