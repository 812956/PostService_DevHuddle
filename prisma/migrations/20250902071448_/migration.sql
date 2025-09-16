/*
  Warnings:

  - The values [CONNECTIONS,GROUP] on the enum `Visibility` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `media` on the `Post` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."Visibility_new" AS ENUM ('PUBLIC', 'VISIBILITY_CONNECTIONS');
ALTER TABLE "public"."Post" ALTER COLUMN "visibility" TYPE "public"."Visibility_new" USING ("visibility"::text::"public"."Visibility_new");
ALTER TYPE "public"."Visibility" RENAME TO "Visibility_old";
ALTER TYPE "public"."Visibility_new" RENAME TO "Visibility";
DROP TYPE "public"."Visibility_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."Post" DROP COLUMN "media",
ADD COLUMN     "imageMedia" JSONB[] DEFAULT ARRAY[]::JSONB[],
ADD COLUMN     "videoMedia" JSONB[] DEFAULT ARRAY[]::JSONB[];
