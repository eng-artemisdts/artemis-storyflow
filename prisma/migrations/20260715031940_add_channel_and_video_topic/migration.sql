-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "outputLanguage" TEXT NOT NULL,
    "addressForm" TEXT NOT NULL,
    "forbiddenForms" TEXT NOT NULL,
    "wordMin" INTEGER NOT NULL DEFAULT 2550,
    "wordTarget" INTEGER NOT NULL DEFAULT 2700,
    "wordMax" INTEGER NOT NULL DEFAULT 2900,
    "scenesMin" INTEGER NOT NULL DEFAULT 7,
    "scenesMax" INTEGER NOT NULL DEFAULT 11,
    "sceneWords" TEXT NOT NULL DEFAULT '250–380',
    "suspensePhrase" TEXT NOT NULL,
    "concreteUnits" TEXT NOT NULL,
    "brandSignoff" TEXT NOT NULL DEFAULT 'none',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
    "script" TEXT,
    "videoTopic" TEXT,
    "imageProvider" TEXT,
    "imageModel" TEXT,
    "videoProvider" TEXT,
    "videoModel" TEXT,
    "llmProvider" TEXT,
    "llmModel" TEXT,
    "styleId" TEXT,
    "targetDurationMin" INTEGER,
    "videoAspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("createdAt", "id", "imageModel", "imageProvider", "llmModel", "llmProvider", "name", "script", "styleId", "targetDurationMin", "updatedAt", "videoAspectRatio", "videoModel", "videoProvider") SELECT "createdAt", "id", "imageModel", "imageProvider", "llmModel", "llmProvider", "name", "script", "styleId", "targetDurationMin", "updatedAt", "videoAspectRatio", "videoModel", "videoProvider" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_channelId_idx" ON "Project"("channelId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
