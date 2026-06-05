-- Harden the workout-media storage bucket:
--   1. Enforce a 10 MB per-file size limit at the bucket level.
--   2. Replace the permissive INSERT policy with one that also validates the
--      MIME type, accepting only jpeg/png/webp images and mp4 video.

-- 1. Size limit (10 MB = 10 * 1024 * 1024 bytes)
update storage.buckets
set file_size_limit = 10485760
where id = 'workout-media';

-- 2. Drop the existing upload policy and recreate it with a MIME-type check.
drop policy if exists "Authenticated users upload media" on storage.objects;

create policy "Authenticated users upload media"
  on storage.objects for insert
  with check (
    bucket_id = 'workout-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'mp4')
    and (
      metadata->>'mimetype' in (
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4'
      )
    )
  );
