-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CommunityStatus" AS ENUM ('pending_link', 'active', 'disconnected');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('active', 'quiet', 'inactive', 'returned');

-- CreateEnum
CREATE TYPE "RelationshipEventType" AS ENUM ('joined', 'first_interaction', 'participation', 'creator_interaction', 'milestone', 'absence_started', 'returned', 'contribution', 'appreciation');

-- CreateEnum
CREATE TYPE "InsightSource" AS ENUM ('reactive', 'autonomous');

-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('unread', 'read', 'acted');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('dashboard', 'telegram_dm', 'email');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "telegramChatTitle" TEXT NOT NULL,
    "mindsConversationId" TEXT,
    "privacyModeConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" "CommunityStatus" NOT NULL DEFAULT 'pending_link',
    "creatorTelegramUserId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "telegramUsername" TEXT,
    "displayName" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipEvent" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "RelationshipEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sentToMind" BOOLEAN NOT NULL DEFAULT false,
    "sentToMindAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationshipEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "memberId" TEXT,
    "source" "InsightSource" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "InsightStatus" NOT NULL DEFAULT 'unread',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "telegramDmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TIME,
    "quietHoursEnd" TIME,
    "maxDailyNotifications" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLinkRequest" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "TelegramLinkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Community_telegramChatId_key" ON "Community"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "Community_mindsConversationId_key" ON "Community"("mindsConversationId");

-- CreateIndex
CREATE INDEX "Member_communityId_status_idx" ON "Member"("communityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Member_communityId_telegramUserId_key" ON "Member"("communityId", "telegramUserId");

-- CreateIndex
CREATE INDEX "RelationshipEvent_memberId_occurredAt_idx" ON "RelationshipEvent"("memberId", "occurredAt");

-- CreateIndex
CREATE INDEX "RelationshipEvent_sentToMind_idx" ON "RelationshipEvent"("sentToMind");

-- CreateIndex
CREATE INDEX "Insight_communityId_createdAt_idx" ON "Insight"("communityId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_insightId_idx" ON "Notification"("insightId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_creatorId_key" ON "NotificationPreference"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkRequest_code_key" ON "TelegramLinkRequest"("code");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipEvent" ADD CONSTRAINT "RelationshipEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "Insight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLinkRequest" ADD CONSTRAINT "TelegramLinkRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial index on RelationshipEvent.sentToMind
-- Hand-edited after `prisma migrate diff` produced the above SQL:
-- Prisma's schema DSL does not support WHERE-clause partial indexes
-- declaratively (confirmed for Prisma 7), and the schema's own comment
-- on RelationshipEvent.sentToMind notes that the digest-sender worker
-- (Build Plan Checkpoint 43) wants a `WHERE NOT sentToMind` partial
-- index for cheap scans of unbatched events. The plain `@@index([sentToMind])`
-- in schema.prisma remains the declarative approximation; this raw
-- CREATE INDEX adds the production-tuned form on top.
CREATE INDEX "RelationshipEvent_sentToMind_partial_idx"
  ON "RelationshipEvent" ("sentToMind")
  WHERE NOT "sentToMind";

