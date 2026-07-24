-- Persist per-viewer like records so "likedByMe", double-like dedupe, and the
-- admin likes audit survive backend restarts (previously in-memory only and
-- wiped every time the Render free instance recycled).
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS public.entry_likes (
  id BIGSERIAL PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('media', 'text')),
  entry_id BIGINT NOT NULL,
  viewer_key TEXT NOT NULL,
  user_id UUID NULL,
  username TEXT NOT NULL DEFAULT '',
  is_authenticated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entry_likes_unique UNIQUE (entry_type, entry_id, viewer_key)
);

CREATE INDEX IF NOT EXISTS idx_entry_likes_entry
  ON public.entry_likes (entry_type, entry_id);

CREATE INDEX IF NOT EXISTS idx_entry_likes_viewer
  ON public.entry_likes (viewer_key);

-- Backend-only table: RLS on with no policies means the publishable (anon)
-- key can neither read nor write; the backend's service role key bypasses RLS.
ALTER TABLE public.entry_likes ENABLE ROW LEVEL SECURITY;
