-- Create the private diary-logs bucket
insert into storage.buckets (id, name, public)
values ('diary-logs', 'diary-logs', false)
on conflict (id) do nothing;

-- Allow any authenticated user to upload
create policy "diary_logs_user_upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'diary-logs');

-- Allow authenticated users to overwrite their own uploads
create policy "diary_logs_user_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'diary-logs')
with check (bucket_id = 'diary-logs');