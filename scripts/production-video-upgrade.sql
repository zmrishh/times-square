-- Paper Square video upgrade: run once in the configured Supabase SQL Editor.
-- Repeatable; preserves existing ownership, creatives, payments and uploaded objects.
BEGIN;
-- Additive, repeatable. Existing purchases retain their original price.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS video_fee integer NOT NULL DEFAULT 0 CHECK(video_fee>=0 AND video_fee<=due);
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='orders'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%target = (existing + due)%' LOOP
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I',c.conname);
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='orders'::regclass AND conname='orders_media_balance') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_media_balance CHECK(target=existing+due-video_fee);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION protect_video_fee() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.video_fee IS DISTINCT FROM OLD.video_fee THEN RAISE EXCEPTION 'Purchased video fees are immutable'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS orders_video_fee_immutable ON orders;
CREATE TRIGGER orders_video_fee_immutable BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION protect_video_fee();
ALTER TABLE totals ADD COLUMN IF NOT EXISTS fallback_creative_id text REFERENCES creatives(id);
UPDATE totals t SET fallback_creative_id=t.creative_id FROM creatives c WHERE c.id=t.creative_id AND c.data->>'mode'<>'video' AND t.fallback_creative_id IS NULL;

CREATE TABLE IF NOT EXISTS media_uploads (
  id text PRIMARY KEY,
  account_id text REFERENCES accounts(id),
  owner_token text NOT NULL,
  poster_id text NOT NULL,
  bytes integer NOT NULL CHECK(bytes>0 AND bytes<=50000000),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','ready','expired')),
  lease_until timestamptz,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '3 hours'
);
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON media_uploads FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON media_uploads FROM authenticated; END IF;
END $$;

-- Supabase SQL Editor: private storage for Paper Square images and MP4 loops.
-- Run in the same Supabase project configured on Vercel. This does not delete
-- objects, application records, billboards, ownership or payment history.
-- If SUPABASE_STORAGE_BUCKET uses a custom name, use it instead of paper-assets.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('paper-assets', 'paper-assets', false, 50000000, ARRAY['image/webp','video/mp4'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = CASE WHEN storage.buckets.file_size_limit IS NULL THEN NULL
    ELSE GREATEST(storage.buckets.file_size_limit, 50000000) END,
  allowed_mime_types = CASE WHEN storage.buckets.allowed_mime_types IS NULL THEN NULL
    ELSE ARRAY(SELECT DISTINCT mime FROM unnest(storage.buckets.allowed_mime_types || ARRAY['image/webp','video/mp4']) AS mime) END;

COMMIT;
SELECT name,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='paper-assets';
