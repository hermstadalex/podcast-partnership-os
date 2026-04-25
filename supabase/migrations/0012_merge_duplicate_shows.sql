-- Merge the reference art and captivate ID from the old un-abbreviated shows into the newly generated abbreviated shows
UPDATE public.shows target
SET 
  youtube_reference_art = source.youtube_reference_art,
  podcast_reference_art = source.podcast_reference_art,
  cover_art = source.cover_art,
  description = source.description
FROM public.shows source
WHERE target.title = source.title
  AND target.id != source.id
  AND target.abbreviation IS NOT NULL
  AND source.abbreviation IS NULL;

-- Delete the old duplicate shows that no longer have abbreviations so they don't clutter the UI
DELETE FROM public.shows 
WHERE abbreviation IS NULL 
  AND title IN (SELECT title FROM public.shows WHERE abbreviation IS NOT NULL);
