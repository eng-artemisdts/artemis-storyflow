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
INSERT INTO "new_Channel" ("addressForm", "brandSignoff", "concreteUnits", "createdAt", "forbiddenForms", "id", "name", "niche", "outputLanguage", "sceneWords", "scenesMax", "scenesMin", "suspensePhrase", "updatedAt", "wordMax", "wordMin", "wordTarget") SELECT "addressForm", "brandSignoff", "concreteUnits", "createdAt", "forbiddenForms", "id", "name", "niche", "outputLanguage", "sceneWords", "scenesMax", "scenesMin", "suspensePhrase", "updatedAt", "wordMax", "wordMin", "wordTarget" FROM "Channel";
DROP TABLE "Channel";
ALTER TABLE "new_Channel" RENAME TO "Channel";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
