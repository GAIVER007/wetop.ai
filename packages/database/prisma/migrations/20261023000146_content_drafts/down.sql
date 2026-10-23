-- Откат CONTENT-DRAFTS-20261022: только пустая таблица; есть черновики — откат останавливается, данные не теряются.
DO $$ BEGIN
 IF to_regclass('content_drafts') IS NOT NULL AND EXISTS (SELECT 1 FROM content_drafts) THEN
  RAISE EXCEPTION 'content_drafts is not empty: export drafts before rollback';
 END IF;
END $$;
DROP POLICY IF EXISTS rls_tenant ON "content_drafts";
DROP TRIGGER IF EXISTS content_draft_guard ON "content_drafts";
DROP FUNCTION IF EXISTS content_draft_guard();
DROP TABLE IF EXISTS "content_drafts";
