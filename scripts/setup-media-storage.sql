-- Supabase SQL Editor: private storage for Paper Square images and MP4 loops.
-- Run in the same Supabase project configured on Vercel. This does not delete
-- objects, application records, billboards, ownership or payment history.
-- If SUPABASE_STORAGE_BUCKET uses a custom name, use it instead of paper-assets.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('paper-assets', 'paper-assets', false, 4200000, ARRAY['image/webp','video/mp4'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = CASE WHEN storage.buckets.file_size_limit IS NULL THEN NULL
    ELSE GREATEST(storage.buckets.file_size_limit, 4200000) END,
  allowed_mime_types = CASE WHEN storage.buckets.allowed_mime_types IS NULL THEN NULL
    ELSE ARRAY(SELECT DISTINCT mime FROM unnest(storage.buckets.allowed_mime_types || ARRAY['image/webp','video/mp4']) AS mime) END;
