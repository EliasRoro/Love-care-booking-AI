-- ============================================================================
-- Love-Care-Support — PSW profile photos migration
-- Run this in the Supabase SQL Editor.
-- Adds:
--   1) psws.photo_url — PSW profile photo (optional, uploaded by the PSW).
--   2) Public `psw-photos` bucket: anyone can view; a signed-in user can only
--      upload/overwrite inside their own folder ({auth.uid()}/...).
--   3) set_my_psw_photo(url) — SECURITY DEFINER: lets a PSW set ONLY their
--      own photo_url (no broad UPDATE policy on psws).
--   4) booking_lookup() and my_bookings() now also return psw_photo.
-- Fairness design: the photo is shown to a client ONLY after a PSW is assigned
-- to their booking — clients never browse PSWs by photo.
-- ============================================================================

-- 1) Photo column
alter table public.psws
  add column if not exists photo_url text;

-- 2) Public bucket for profile photos
insert into storage.buckets (id, name, public)
values ('psw-photos', 'psw-photos', true)
on conflict (id) do nothing;

drop policy if exists "psw_photo_public_read" on storage.objects;
create policy "psw_photo_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'psw-photos');

drop policy if exists "psw_photo_own_upload" on storage.objects;
create policy "psw_photo_own_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'psw-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "psw_photo_own_update" on storage.objects;
create policy "psw_photo_own_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'psw-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'psw-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) Let a PSW set only their own photo_url
create or replace function public.set_my_psw_photo(p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.psws
  set photo_url = nullif(trim(p_url), '')
  where email = (auth.jwt() ->> 'email');
end;
$$;

grant execute on function public.set_my_psw_photo(text) to authenticated;

-- 4) Include the photo in the client-facing lookups
-- (DROP first: CREATE OR REPLACE cannot change a function's return type.)
drop function if exists public.booking_lookup(text);
create or replace function public.booking_lookup(p_ref text)
returns table (
  reference_code text,
  status         text,
  service_types  text[],
  scheduled_at   timestamptz,
  duration_hours numeric,
  psw_name       text,
  psw_photo      text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.reference_code,
    b.status,
    b.service_types,
    b.scheduled_at,
    b.duration_hours,
    p.full_name as psw_name,
    p.photo_url as psw_photo
  from public.bookings b
  left join public.psws p on p.id = b.psw_id
  where b.reference_code = upper(trim(p_ref))
  limit 1;
$$;

drop function if exists public.my_bookings();
create or replace function public.my_bookings()
returns table (
  reference_code text,
  status         text,
  service_types  text[],
  scheduled_at   timestamptz,
  duration_hours numeric,
  address        text,
  city           text,
  psw_name       text,
  psw_phone      text,
  psw_photo      text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.reference_code,
    b.status,
    b.service_types,
    b.scheduled_at,
    b.duration_hours,
    b.address,
    b.city,
    p.full_name as psw_name,
    p.phone     as psw_phone,
    p.photo_url as psw_photo
  from public.bookings b
  left join public.psws p on p.id = b.psw_id
  where b.client_email = (auth.jwt() ->> 'email')
  order by b.scheduled_at desc nulls last, b.created_at desc;
$$;
