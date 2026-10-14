-- Questacy form storage. Public visitors must never be able to read these tables.
create extension if not exists pgcrypto;

create table if not exists public.early_access_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text,
  user_type text,
  consent boolean not null default false check (consent = true),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint early_access_email_format check (email = lower(email) and email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)+$')
);
create unique index if not exists early_access_signups_email_lower_uidx on public.early_access_signups (lower(email));

create table if not exists public.business_interest_submissions (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text not null,
  email text not null,
  category text not null,
  message text,
  consent boolean not null default false check (consent = true),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint business_interest_email_format check (email = lower(email) and email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)+$')
);
create unique index if not exists business_interest_email_name_uidx on public.business_interest_submissions (lower(email), lower(business_name));

-- One row per hashed client address and form type. Raw IP addresses are never stored.
create table if not exists public.form_rate_limits (
  form_key text not null check (form_key in ('early-access-signup','business-interest')),
  ip_hash text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  primary key (form_key, ip_hash)
);

alter table public.early_access_signups enable row level security;
alter table public.business_interest_submissions enable row level security;
alter table public.form_rate_limits enable row level security;
revoke all on public.early_access_signups from anon, authenticated;
revoke all on public.business_interest_submissions from anon, authenticated;
revoke all on public.form_rate_limits from anon, authenticated;

-- Atomic DB-backed rate limit: 5 submissions per hashed IP per form per hour.
create or replace function public.consume_form_rate_limit(p_form_key text, p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare allowed boolean;
begin
  insert into public.form_rate_limits(form_key, ip_hash, window_started_at, request_count)
  values (p_form_key, p_ip_hash, now(), 1)
  on conflict (form_key, ip_hash) do update
    set window_started_at = case when public.form_rate_limits.window_started_at < now() - interval '1 hour' then now() else public.form_rate_limits.window_started_at end,
        request_count = case when public.form_rate_limits.window_started_at < now() - interval '1 hour' then 1 else public.form_rate_limits.request_count + 1 end;
  select request_count <= 5 into allowed from public.form_rate_limits where form_key = p_form_key and ip_hash = p_ip_hash;
  return coalesce(allowed, false);
end;
$$;
revoke all on function public.consume_form_rate_limit(text,text) from public, anon, authenticated;
grant execute on function public.consume_form_rate_limit(text,text) to service_role;
