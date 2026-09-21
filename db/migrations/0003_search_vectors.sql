-- Full-text search (FR-11). The 'simple' configuration is deliberate:
-- meeting notes mix Georgian and English, and language-specific stemming
-- would mangle Georgian tokens. ILIKE fallback in the query layer covers
-- partial words.
ALTER TABLE "task" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("blocked_reason", '')), 'C') ||
    setweight(to_tsvector('simple', coalesce("requester_name", '') || ' ' || coalesce("requester_department", '')), 'C')
  ) STORED;
--> statement-breakpoint
CREATE INDEX "task_search_idx" ON "task" USING gin ("search_vector");
--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("free_text", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("answers"::text, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("summary", '')), 'A')
  ) STORED;
--> statement-breakpoint
CREATE INDEX "meeting_search_idx" ON "meeting" USING gin ("search_vector");
