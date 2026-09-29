-- ============================================================================
-- Love-Care-Support — client accounts migration
-- Run this in the Supabase SQL Editor (after the base schema + portal migration).
-- Adds my_bookings(): lets a signed-in client list all of THEIR bookings
-- (matched by login email) with safe fields only, including the assigned
-- PSW's name and phone. SECURITY DEFINER so no broad table policies are needed.
-- Clients sign up with the SAME email they used when booking.
-- ============================================================================

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
  psw_phone      text
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
    p.phone     as psw_phone
  from public.bookings b
  left join public.psws p on p.id = b.psw_id
  where b.client_email = (auth.jwt() ->> 'email')
  order by b.scheduled_at desc nulls last, b.created_at desc;
$$;

grant execute on function public.my_bookings() to authenticated;
