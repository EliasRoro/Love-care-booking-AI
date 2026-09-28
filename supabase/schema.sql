-- ============================================================================
-- Love-Care-Support — Supabase Postgres schema
-- ----------------------------------------------------------------------------
-- Run this entire file once in the Supabase SQL editor (in order).
-- It is idempotent where practical (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- Tables: clients, psws, documents, bookings, payments, reviews, admin_users
-- Storage: private bucket `psw-documents`
-- Auth model:
--   * Anonymous visitors may INSERT applications/bookings/documents metadata,
--     but cannot read anyone's data.
--   * Admins (rows in admin_users) can read/write everything via RLS.
--   * (Phase 2: add PSW/client logins with per-user policies.)
-- ============================================================================

-- --------------------------------------------------------------------------
-- Extensions
-- --------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- NOTE: the public.is_admin() helper is defined further below, AFTER the
-- admin_users table is created (Postgres validates SQL function bodies at
-- creation time, so it must come after the table it queries).

-- ==========================================================================
-- TABLES
-- ==========================================================================

-- --------------------------------------------------------------------------
-- clients: families / care requesters (contact records)
-- PHIPA note: keep only what is needed to deliver care. No health details
-- are collected on the public form by design.
-- --------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text not null,
  phone       text not null,
  address     text not null,
  city        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_clients_email on public.clients (email);
create index if not exists idx_clients_created on public.clients (created_at desc);

-- --------------------------------------------------------------------------
-- psws: independent-contractor PSW profiles
-- --------------------------------------------------------------------------
create table if not exists public.psws (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  email               text not null unique,
  phone               text not null,
  city                text not null,
  service_areas       text[] not null default '{}',
  languages           text[] not null default '{}',
  specializations     text[] not null default '{}',
  experience_years    int not null default 0,
  availability        jsonb not null default '{"text": ""}'::jsonb,
  rating_avg          numeric(3,2) not null default 0,
  ratings_count       int not null default 0,
  status              text not null default 'applied'
                      check (status in ('applied','verifying','active','suspended','rejected')),
  rejection_reason    text,
  contractor_confirmed boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists idx_psws_status on public.psws (status);
create index if not exists idx_psws_city on public.psws (city);

-- --------------------------------------------------------------------------
-- documents: metadata for PSW verification files.
-- Files themselves live in the private `psw-documents` storage bucket.
-- --------------------------------------------------------------------------
create table if not exists public.documents (
  id                  uuid primary key default gen_random_uuid(),
  psw_id              uuid not null references public.psws(id) on delete cascade,
  doc_type            text not null
                      check (doc_type in ('psw_certificate','cpr_first_aid','vulnerable_sector','hscpoa','photo_id')),
  file_path           text not null,
  expiry_date         date,
  verification_status text not null default 'pending'
                      check (verification_status in ('pending','verified','rejected')),
  verified_at         timestamptz,
  notes               text,
  created_at          timestamptz not null default now()
);
create index if not exists idx_documents_psw on public.documents (psw_id);
create index if not exists idx_documents_expiry on public.documents (expiry_date)
  where verification_status = 'verified';

-- --------------------------------------------------------------------------
-- bookings: care requests through their lifecycle
-- --------------------------------------------------------------------------
create table if not exists public.bookings (
  id               uuid primary key default gen_random_uuid(),
  reference_code   text not null unique,
  client_id        uuid references public.clients(id) on delete set null,
  client_name      text not null,
  client_phone     text not null,
  client_email     text not null,
  address          text not null,
  city             text not null,
  psw_id           uuid references public.psws(id) on delete set null,
  service_types    text[] not null default '{}',
  needed_languages text[] not null default '{}',
  preferred_times  text not null default '',
  scheduled_at     timestamptz,
  duration_hours   numeric(5,2),
  hourly_rate      numeric(8,2) not null default 35,
  commission_rate  numeric(4,3) not null default 0.200,
  status           text not null default 'requested'
                   check (status in ('requested','accepted','in_progress','completed','cancelled')),
  notes            text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_bookings_status on public.bookings (status);
create index if not exists idx_bookings_psw on public.bookings (psw_id);
create index if not exists idx_bookings_ref on public.bookings (reference_code);
create index if not exists idx_bookings_created on public.bookings (created_at desc);

-- --------------------------------------------------------------------------
-- payments: created when a booking is marked completed (by the admin app)
-- --------------------------------------------------------------------------
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null unique references public.bookings(id) on delete cascade,
  amount_total  numeric(10,2) not null,
  platform_fee  numeric(10,2) not null,
  psw_payout    numeric(10,2) not null,
  payout_status text not null default 'pending'
                check (payout_status in ('pending','paid')),
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_payments_status on public.payments (payout_status);

-- --------------------------------------------------------------------------
-- reviews: two-way ratings after completed bookings
-- --------------------------------------------------------------------------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  rating        int not null check (rating between 1 and 5),
  comment       text,
  reviewer_type text not null default 'client'
                check (reviewer_type in ('client','psw','admin')),
  created_at    timestamptz not null default now()
);
create index if not exists idx_reviews_booking on public.reviews (booking_id);

-- Keep psws.rating_avg / ratings_count in sync automatically.
create or replace function public.refresh_psw_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_psw uuid;
begin
  select psw_id into target_psw from public.bookings where id = coalesce(new.booking_id, old.booking_id);
  if target_psw is not null then
    update public.psws
    set rating_avg = sub.avg_r,
        ratings_count = sub.cnt
    from (
      select coalesce(avg(r.rating), 0) as avg_r,
             count(r.id) as cnt
      from public.reviews r
      join public.bookings b on b.id = r.booking_id
      where b.psw_id = target_psw
    ) sub
    where public.psws.id = target_psw;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_psw_rating on public.reviews;
create trigger trg_refresh_psw_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_psw_rating();

-- --------------------------------------------------------------------------
-- admin_users: Supabase Auth users who may access the admin console
-- --------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin','support')),
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Helper: is the current authenticated user an admin?
-- Defined AFTER admin_users (see note at top of file).
-- SECURITY DEFINER so anon/authenticated callers can evaluate it under RLS.
-- --------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

-- ==========================================================================
-- ROW LEVEL SECURITY
-- ==========================================================================
alter table public.clients     enable row level security;
alter table public.psws        enable row level security;
alter table public.documents   enable row level security;
alter table public.bookings    enable row level security;
alter table public.payments    enable row level security;
alter table public.reviews     enable row level security;
alter table public.admin_users enable row level security;

-- ---- clients ----
drop policy if exists "anon_insert_clients" on public.clients;
create policy "anon_insert_clients" on public.clients
  for insert to anon with check (true);
drop policy if exists "admin_all_clients" on public.clients;
create policy "admin_all_clients" on public.clients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- psws ----
drop policy if exists "anon_insert_psws" on public.psws;
create policy "anon_insert_psws" on public.psws
  for insert to anon with check (true);
drop policy if exists "admin_all_psws" on public.psws;
create policy "admin_all_psws" on public.psws
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- documents (metadata only; files are in storage with their own policies) ----
drop policy if exists "anon_insert_documents" on public.documents;
create policy "anon_insert_documents" on public.documents
  for insert to anon with check (true);
drop policy if exists "admin_all_documents" on public.documents;
create policy "admin_all_documents" on public.documents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- bookings ----
drop policy if exists "anon_insert_bookings" on public.bookings;
create policy "anon_insert_bookings" on public.bookings
  for insert to anon with check (true);
drop policy if exists "admin_all_bookings" on public.bookings;
create policy "admin_all_bookings" on public.bookings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- payments / reviews: admin only (created from the admin console) ----
drop policy if exists "admin_all_payments" on public.payments;
create policy "admin_all_payments" on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_all_reviews" on public.reviews;
create policy "admin_all_reviews" on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Allow anonymous review submission in Phase 2 via a secure RPC instead.
-- (Not enabled in v1: reviews are entered by the admin after follow-up calls.)

-- ---- admin_users: readable by admins, insertable only by admins ----
-- (First admin is inserted by the project owner via the SQL editor / dashboard,
--  which runs with elevated privileges and bypasses RLS.)
drop policy if exists "admin_read_admin_users" on public.admin_users;
create policy "admin_read_admin_users" on public.admin_users
  for select to authenticated using (public.is_admin());
drop policy if exists "admin_write_admin_users" on public.admin_users;
create policy "admin_write_admin_users" on public.admin_users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ==========================================================================
-- STORAGE: private `psw-documents` bucket
-- --------------------------------------------------------------------------
-- Anonymous applicants can UPLOAD (during application only).
-- Only admins can READ/LIST. Nobody can update or delete via the API
-- (admins manage files from the Supabase dashboard if needed).
-- ==========================================================================
insert into storage.buckets (id, name, public)
values ('psw-documents', 'psw-documents', false)
on conflict (id) do nothing;

drop policy if exists "anon_upload_psw_documents" on storage.objects;
create policy "anon_upload_psw_documents" on storage.objects
  for insert to anon
  with check (bucket_id = 'psw-documents');

drop policy if exists "admin_read_psw_documents" on storage.objects;
create policy "admin_read_psw_documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'psw-documents' and public.is_admin());
