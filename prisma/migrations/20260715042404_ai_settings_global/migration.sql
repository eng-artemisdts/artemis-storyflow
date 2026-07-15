/*
  Warnings:

  - You are about to drop the `ProviderCredential` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `imageModel` on the `Channel` table. All the data in the column will be lost.
  - You are about to drop the column `imageProvider` on the `Channel` table. All the data in the column will be lost.
  - You are about to drop the column `llmModel` on the `Channel` table. All the data in the column will be lost.
  - You are about to drop the column `llmProvider` on the `Channel` table. All the data in the column will be lost.
  - You are about to drop the column `videoModel` on the `Channel` table. All the data in the column will be lost.
  - You are about to drop the column `videoProvider` on the `Channel` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ProviderCredential_channelId_provider_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ProviderCredential";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "videoAspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "targetDurationMin" INTEGER NOT NULL DEFAULT 10,
    "outputLanguage" TEXT NOT NULL,
    "addressForm" TEXT NOT NULL,
    "forbiddenForms" TEXT NOT NULL,
    "wordMin" INTEGER NOT NULL DEFAULT 1410,
    "wordTarget" INTEGER NOT NULL DEFAULT 1500,
    "wordMax" INTEGER NOT NULL DEFAULT 1605,
    "scenesMin" INTEGER NOT NULL DEFAULT 3,
    "scenesMax" INTEGER NOT NULL DEFAULT 6,
    "sceneWords" TEXT NOT NULL DEFAULT '250–380',
    "suspensePhrase" TEXT NOT NULL DEFAULT '',
    "concreteUnits" TEXT NOT NULL DEFAULT '',
    "brandSignoff" TEXT NOT NULL DEFAULT 'none',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Channel" ("addressForm", "brandSignoff", "concreteUnits", "createdAt", "description", "forbiddenForms", "id", "name", "niche", "outputLanguage", "sceneWords", "scenesMax", "scenesMin", "suspensePhrase", "targetDurationMin", "updatedAt", "videoAspectRatio", "wordMax", "wordMin", "wordTarget") SELECT "addressForm", "brandSignoff", "concreteUnits", "createdAt", "description", "forbiddenForms", "id", "name", "niche", "outputLanguage", "sceneWords", "scenesMax", "scenesMin", "suspensePhrase", "targetDurationMin", "updatedAt", "videoAspectRatio", "wordMax", "wordMin", "wordTarget" FROM "Channel";
DROP TABLE "Channel";
ALTER TABLE "new_Channel" RENAME TO "Channel";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
