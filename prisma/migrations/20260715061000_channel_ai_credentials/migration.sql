-- AlterTable: AI providers on Channel
ALTER TABLE "Channel" ADD COLUMN "imageProvider" TEXT NOT NULL DEFAULT 'fal';
ALTER TABLE "Channel" ADD COLUMN "imageModel" TEXT NOT NULL DEFAULT 'fal-ai/nano-banana-2';
ALTER TABLE "Channel" ADD COLUMN "videoProvider" TEXT NOT NULL DEFAULT 'fal';
ALTER TABLE "Channel" ADD COLUMN "videoModel" TEXT NOT NULL DEFAULT 'fal-ai/kling-video/v3/standard/image-to-video';
ALTER TABLE "Channel" ADD COLUMN "llmProvider" TEXT NOT NULL DEFAULT 'gemini';
ALTER TABLE "Channel" ADD COLUMN "llmModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash';

-- Seed channel providers from the most recently updated project in each channel
UPDATE "Channel"
SET
  "imageProvider" = COALESCE((
    SELECT p."imageProvider" FROM "Project" p
    WHERE p."channelId" = "Channel"."id" AND p."imageProvider" IS NOT NULL
    ORDER BY p."updatedAt" DESC LIMIT 1
  ), "imageProvider"),
  "imageModel" = COALESCE((
    SELECT p."imageModel" FROM "Project" p
    WHERE p."channelId" = "Channel"."id" AND p."imageModel" IS NOT NULL
    ORDER BY p."updatedAt" DESC LIMIT 1
  ), "imageModel"),
  "videoProvider" = COALESCE((
    SELECT p."videoProvider" FROM "Project" p
    WHERE p."channelId" = "Channel"."id" AND p."videoProvider" IS NOT NULL
    ORDER BY p."updatedAt" DESC LIMIT 1
  ), "videoProvider"),
  "videoModel" = COALESCE((
    SELECT p."videoModel" FROM "Project" p
    WHERE p."channelId" = "Channel"."id" AND p."videoModel" IS NOT NULL
    ORDER BY p."updatedAt" DESC LIMIT 1
  ), "videoModel"),
  "llmProvider" = COALESCE((
    SELECT p."llmProvider" FROM "Project" p
    WHERE p."channelId" = "Channel"."id" AND p."llmProvider" IS NOT NULL
    ORDER BY p."updatedAt" DESC LIMIT 1
  ), "llmProvider"),
  "llmModel" = COALESCE((
    SELECT p."llmModel" FROM "Project" p
    WHERE p."channelId" = "Channel"."id" AND p."llmModel" IS NOT NULL
    ORDER BY p."updatedAt" DESC LIMIT 1
  ), "llmModel");

-- Recreate ProviderCredential with channelId
CREATE TABLE "new_ProviderCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    CONSTRAINT "new_ProviderCredential_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate credentials: keep one key per (channel, provider) — latest project update wins
INSERT INTO "new_ProviderCredential" ("id", "channelId", "provider", "encryptedKey", "last4")
SELECT "id", "channelId", "provider", "encryptedKey", "last4"
FROM (
  SELECT
    pc."id" AS "id",
    p."channelId" AS "channelId",
    pc."provider" AS "provider",
    pc."encryptedKey" AS "encryptedKey",
    pc."last4" AS "last4",
    ROW_NUMBER() OVER (
      PARTITION BY p."channelId", pc."provider"
      ORDER BY p."updatedAt" DESC
    ) AS rn
  FROM "ProviderCredential" pc
  INNER JOIN "Project" p ON p."id" = pc."projectId"
  WHERE p."channelId" IS NOT NULL
)
WHERE rn = 1;

DROP TABLE "ProviderCredential";
ALTER TABLE "new_ProviderCredential" RENAME TO "ProviderCredential";
CREATE UNIQUE INDEX "ProviderCredential_channelId_provider_key" ON "ProviderCredential"("channelId", "provider");
