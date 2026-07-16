-- AlterTable
ALTER TABLE "Channel" ADD COLUMN "channelType" TEXT NOT NULL DEFAULT 'narrative-story';
ALTER TABLE "Channel" ADD COLUMN "channelTypeDescription" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Channel" ADD COLUMN "masterPromptTemplate" TEXT;
