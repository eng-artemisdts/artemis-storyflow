-- AlterTable
ALTER TABLE "Channel" ADD COLUMN "hasReferenceCharacter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Channel" ADD COLUMN "referenceCharacterName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Channel" ADD COLUMN "referenceCharacterDescription" TEXT NOT NULL DEFAULT '';
