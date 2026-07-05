import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMediaToMessages20260706014500 implements MigrationInterface {
    name = 'AddMediaToMessages20260706014500'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" ADD "media_url" character varying`);
        await queryRunner.query(`ALTER TABLE "messages" ADD "media_type" character varying`);
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "content" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "content" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "media_type"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "media_url"`);
    }

}
