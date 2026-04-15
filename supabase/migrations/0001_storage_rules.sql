-- Establish the episodes_bucket in Supabase Storage
insert into storage.buckets (id, name, public) 
values ('episodes_bucket', 'episodes_bucket', true)
on conflict (id) do nothing;

-- Drop existing policies if they exist so we can recreate them
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public viewing" ON storage.objects;

-- Set up RLS to allow anyone to upload files (for MVP, or we can restrict to auth'd)
create policy "Allow authenticated uploads" 
  on storage.objects for insert 
  to public 
  with check ( bucket_id = 'episodes_bucket' );

create policy "Allow public viewing" 
  on storage.objects for select 
  to public 
  using ( bucket_id = 'episodes_bucket' );
