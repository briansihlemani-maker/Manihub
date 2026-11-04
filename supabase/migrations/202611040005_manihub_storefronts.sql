-- ManiHub business storefront foundation
create table if not exists public.manihub_stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_name text not null check (char_length(trim(store_name)) between 2 and 90),
  description text not null default '' check (char_length(description) <= 1200),
  category text not null default 'General',
  province text not null,
  town text not null default '',
  whatsapp text not null default '',
  logo_url text,
  banner_url text,
  promo_video_url text,
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manihub_stores_owner_idx on public.manihub_stores(owner_id);
create index if not exists manihub_stores_category_idx on public.manihub_stores(category);
create index if not exists manihub_stores_status_idx on public.manihub_stores(status);

alter table public.manihub_stores enable row level security;

drop policy if exists "Public can view active ManiHub stores" on public.manihub_stores;
create policy "Public can view active ManiHub stores"
on public.manihub_stores for select
using (status = 'active');

drop policy if exists "Owners can create their own ManiHub store" on public.manihub_stores;
create policy "Owners can create their own ManiHub store"
on public.manihub_stores for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can update their own ManiHub store" on public.manihub_stores;
create policy "Owners can update their own ManiHub store"
on public.manihub_stores for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can delete their own ManiHub store" on public.manihub_stores;
create policy "Owners can delete their own ManiHub store"
on public.manihub_stores for delete to authenticated
using (owner_id = (select auth.uid()));

comment on table public.manihub_stores is 'Public ManiHub business storefront profiles. Store owners can manage only their own profile.';
