-- DropForeignKey
ALTER TABLE "seller_agents" DROP CONSTRAINT "seller_agents_created_by_fkey";

-- DropForeignKey
ALTER TABLE "seller_agents" DROP CONSTRAINT "seller_agents_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "wizard_drafts" DROP CONSTRAINT "wizard_drafts_claimed_by_fkey";

-- DropForeignKey
ALTER TABLE "wizard_drafts" DROP CONSTRAINT "wizard_drafts_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "wizard_drafts" DROP CONSTRAINT "wizard_drafts_guest_session_id_fkey";

-- DropForeignKey
ALTER TABLE "wizard_drafts" DROP CONSTRAINT "wizard_drafts_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "wizard_jobs" DROP CONSTRAINT "wizard_jobs_draft_id_fkey";

-- DropForeignKey
ALTER TABLE "wizard_messages" DROP CONSTRAINT "wizard_messages_draft_id_fkey";

-- DropForeignKey
ALTER TABLE "wizard_surveys" DROP CONSTRAINT "wizard_surveys_guest_session_id_fkey";

-- DropForeignKey
ALTER TABLE "wizard_events" DROP CONSTRAINT "wizard_events_guest_session_id_fkey";

-- DropTable
DROP TABLE "seller_agents";

-- DropTable
DROP TABLE "wizard_sessions";

-- DropTable
DROP TABLE "wizard_drafts";

-- DropTable
DROP TABLE "wizard_jobs";

-- DropTable
DROP TABLE "wizard_messages";

-- DropTable
DROP TABLE "wizard_surveys";

-- DropTable
DROP TABLE "wizard_events";
