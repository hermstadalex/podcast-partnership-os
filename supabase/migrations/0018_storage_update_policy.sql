-- Add UPDATE policy for episodes_bucket to support upsert operations
create policy "Allow authenticated updates" 
  on storage.objects for update 
  to public 
  using ( bucket_id = 'episodes_bucket' )
  with check ( bucket_id = 'episodes_bucket' );
