-- Increase the max upload size limit for the episodes_bucket to 1GB
UPDATE storage.buckets
SET file_size_limit = 1048576000 -- 1000 MB (1000 * 1024 * 1024 bytes)
WHERE id = 'episodes_bucket';
