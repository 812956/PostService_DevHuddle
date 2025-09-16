/*
  Warnings:

  - You are about to drop the column `imageUrls` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `mentions` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `videoUrl` on the `Post` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Post_mentions_idx";

-- AlterTable
ALTER TABLE "public"."Post" DROP COLUMN "imageUrls",
DROP COLUMN "mentions",
DROP COLUMN "videoUrl",
ADD COLUMN     "media" JSONB[] DEFAULT ARRAY[]::JSONB[];

-- CreateTable
CREATE TABLE "public"."SavedPost" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedPost_userId_idx" ON "public"."SavedPost"("userId");

-- CreateIndex
CREATE INDEX "SavedPost_postId_idx" ON "public"."SavedPost"("postId");

-- CreateIndex
CREATE INDEX "SavedPost_createdAt_idx" ON "public"."SavedPost"("createdAt");

-- CreateIndex
CREATE INDEX "Report_postId_idx" ON "public"."Report"("postId");

-- CreateIndex
CREATE INDEX "Report_userId_idx" ON "public"."Report"("userId");

-- AddForeignKey
ALTER TABLE "public"."SavedPost" ADD CONSTRAINT "SavedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
