-- ============================================================================
-- Love-Care-Support — portal access migration
-- Run this in the Supabase SQL Editor (after the base schema + anon inserts).
-- Adds:
--   1) booking_lookup() — lets a client check their booking with only the
--      reference code. SECURITY DEFINER, returns safe fields only.
--   2) RLS so a signed-in PSW can see their own profile + assigned jobs,
--      and update the status of their own jobs (accept / decline / complete).
-- PSWs sign up with the SAME email they used on their application; the portal
-- links their login to their PSW record by email.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) Client booking lookup (safe fields only — no addresses/phone numbers)
-- --------------------------------------------------------------------------
create or replace function public.booking_lookup(p_ref text)
returns table (
  reference_code text,
  status         text,
  service_types  text[],
  scheduled_at   timestamptz,
  duration_hours numeric,
  psw_name       text
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
    p.full_name as psw_name
  from public.bookings b
  left join public.psws p on p.id = b.psw_id
  where b.reference_code = upper(trim(p_ref))
  limit 1;
$$;

grant execute on function public.booking_lookup(text) to anon, authenticated;

-- --------------------------------------------------------------------------
-- 2) PSW portal RLS
-- --------------------------------------------------------------------------

-- A signed-in PSW can read their own PSW record (matched by login email).
drop policy if exists "psw_self_select" on public.psws;
create policy "psw_self_select" on public.psws
  for select to authenticated
  using (email = (auth.jwt() ->> 'email'));

-- A signed-in PSW can read bookings assigned to them.
drop policy if exists "psw_assigned_bookings_select" on public.bookings;
create policy "psw_assigned_bookings_select" on public.bookings
  for select to authenticated
  using (
    psw_id in (
      select id from public.psws where email = (auth.jwt() ->> 'email')
    )
  );

-- A signed-in PSW can update their own jobs:
-- accept / start / complete (status change), or decline (unassign: psw_id -> null).
drop policy if exists "psw_assigned_bookings_update" on public.bookings;
create policy "psw_assigned_bookings_update" on public.bookings
  for update to authenticated
  using (
    psw_id in (
      select id from public.psws where email = (auth.jwt() ->> 'email')
    )
  )
  with check (
    psw_id is null
    or psw_id in (
      select id from public.psws where email = (auth.jwt() ->> 'email')
    )
  );
