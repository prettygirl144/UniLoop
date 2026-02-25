-- Deduplicate community_votes before adding unique constraints.
-- Run this against your database, then add the constraints back to shared/schema.ts and run: npm run db:push
--
-- Keeps the most recent vote per (user_id, post_id) and (user_id, reply_id).
-- Deletes older duplicates.

-- Post votes: keep one per (user_id, post_id), delete older duplicates
DELETE FROM community_votes a
USING community_votes b
WHERE a.post_id IS NOT NULL
  AND b.post_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.post_id = b.post_id
  AND a.id < b.id;

-- Reply votes: keep one per (user_id, reply_id), delete older duplicates
DELETE FROM community_votes a
USING community_votes b
WHERE a.reply_id IS NOT NULL
  AND b.reply_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.reply_id = b.reply_id
  AND a.id < b.id;
