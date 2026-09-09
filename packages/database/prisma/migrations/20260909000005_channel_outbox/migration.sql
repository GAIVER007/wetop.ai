-- CreateEnum
CREATE TYPE "ChannelOutboxKind" AS ENUM ('AVAILABILITY', 'RESTRICTIONS');

-- CreateEnum
CREATE TYPE "ChannelOutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "channel_outbox" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" "ChannelOutboxKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ChannelOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "task_id" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "channel_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_outbox_provider_status_next_attempt_at_idx" ON "channel_outbox"("provider", "status", "next_attempt_at");

