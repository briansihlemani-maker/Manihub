-- ManiHub product popularity and engagement analytics
-- Apply this migration in Supabase SQL Editor after the earlier ManiHub migrations.
-- Client users can record views, saves and enquiries only. Sales must be recorded
-- by a trusted payment webhook/server function, never by the public browser.

create table if not exists public.manihub_listing_engagement (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null,
  visitor_id uuid not null,
  event_type text not null check (event_type in ('view','save','enquiry','purchase')),
  event_day date not null default (timezone('utc', now())::date),
  created_at timestamptz not null default now()
);

create index if not exists manihub_listing_engagement_listing_day_idx
  on public.manihub_listing_engagement (listing_id, event_day desc);
create index if not exists manihub_listing_engagement_type_day_idx
  on public.manihub_listing_engagement (event_type, event_day desc);

-- Count each visitor once per listing, event type and UTC day.
create unique index if not exists manihub_listing_engagement_daily_unique
  on public.manihub_listing_engagement (listing_id, visitor_id, event_type, event_day);

alter table public.manihub_listing_engagement enable row level security;
revoke all on public.manihub_listing_engagement from anon, authenticated;

create or replace function public.manihub_record_listing_engagement(
  p_listing_id text,
  p_event_type text,
  p_visitor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_listing_id is null or length(trim(p_listing_id)) = 0 or length(p_listing_id) > 128 then
    raise exception 'Invalid listing id';
  end if;
  if p_event_type not in ('view','save','enquiry') then
    raise exception 'Unsupported public engagement event';
  end if;
  if p_visitor_id is null then
    raise exception 'Visitor id is required';
  end if;

  insert into public.manihub_listing_engagement (listing_id, visitor_id, event_type)
  values (p_listing_id, p_visitor_id, p_event_type)
  on conflict (listing_id, visitor_id, event_type, event_day) do nothing;

  return true;
end;
$$;

revoke all on function public.manihub_record_listing_engagement(text,text,uuid) from public;
grant execute on function public.manihub_record_listing_engagement(text,text,uuid) to anon, authenticated;

create or replace function public.manihub_get_listing_popularity()
returns table (
  listing_id text,
  views_30d bigint,
  saves_30d bigint,
  enquiries_30d bigint,
  sales_30d bigint,
  popularity_score numeric
)
language sql
security definer
set search_path = ''
as $$
  select
    e.listing_id,
    count(*) filter (where e.event_type = 'view')::bigint as views_30d,
    count(*) filter (where e.event_type = 'save')::bigint as saves_30d,
    count(*) filter (where e.event_type = 'enquiry')::bigint as enquiries_30d,
    count(*) filter (where e.event_type = 'purchase')::bigint as sales_30d,
    (
      count(*) filter (where e.event_type = 'view') * 1
      + count(*) filter (where e.event_type = 'save') * 4
      + count(*) filter (where e.event_type = 'enquiry') * 6
      + count(*) filter (where e.event_type = 'purchase') * 10
    )::numeric as popularity_score
  from public.manihub_listing_engagement e
  where e.event_day >= (timezone('utc', now())::date - 29)
  group by e.listing_id;
$$;

revoke all on function public.manihub_get_listing_popularity() from public;
grant execute on function public.manihub_get_listing_popularity() to anon, authenticated;

comment on table public.manihub_listing_engagement is
  'Daily-deduplicated product engagement events. Purchase events are reserved for trusted server-side payment confirmation.';
comment on function public.manihub_get_listing_popularity() is
  'Returns rolling 30-day engagement counts and weighted popularity score: view=1, save=4, enquiry=6, verified purchase=10.';
