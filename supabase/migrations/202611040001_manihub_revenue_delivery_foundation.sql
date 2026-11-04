-- ManiHub marketplace revenue and delivery foundation
-- Apply in Supabase SQL Editor. This migration creates new tables only;
-- it does not modify existing listings, authentication, or storage objects.

create extension if not exists pgcrypto;

create table if not exists public.manihub_fee_rules (
  id uuid primary key default gen_random_uuid(),
  category_key text not null,
  commission_percent numeric(6,3) not null default 0 check (commission_percent between 0 and 100),
  payment_service_percent numeric(6,3) not null default 0 check (payment_service_percent between 0 and 100),
  payment_service_fixed_zar numeric(10,2) not null default 0 check (payment_service_fixed_zar >= 0),
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  unique (category_key, effective_from),
  check (effective_until is null or effective_until > effective_from)
);

create table if not exists public.manihub_delivery_regions (
  id uuid primary key default gen_random_uuid(),
  region_key text not null unique,
  region_name text not null,
  province text not null,
  currency char(3) not null default 'ZAR',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.manihub_vehicle_rates (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.manihub_delivery_regions(id),
  vehicle_type text not null check (vehicle_type in ('motorcycle','car','van')),
  fuel_type text not null check (fuel_type in ('petrol','diesel','electric')),
  fuel_price_per_litre_zar numeric(10,3) not null default 30 check (fuel_price_per_litre_zar >= 0),
  consumption_km_per_litre numeric(8,3) check (consumption_km_per_litre > 0),
  customer_rate_per_km_zar numeric(10,2) not null default 30 check (customer_rate_per_km_zar >= 0),
  minimum_delivery_fee_zar numeric(10,2) not null default 25 check (minimum_delivery_fee_zar >= 0),
  driver_cost_per_km_zar numeric(10,2) not null default 0 check (driver_cost_per_km_zar >= 0),
  maintenance_cost_per_km_zar numeric(10,2) not null default 0 check (maintenance_cost_per_km_zar >= 0),
  insurance_cost_per_km_zar numeric(10,2) not null default 0 check (insurance_cost_per_km_zar >= 0),
  platform_margin_percent numeric(6,3) not null default 0 check (platform_margin_percent between 0 and 100),
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  unique (region_id, vehicle_type, fuel_type, effective_from),
  check (effective_until is null or effective_until > effective_from)
);

create table if not exists public.manihub_delivery_quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  seller_id uuid,
  region_id uuid references public.manihub_delivery_regions(id),
  vehicle_rate_id uuid references public.manihub_vehicle_rates(id),
  pickup_address text not null,
  dropoff_address text not null,
  road_distance_km numeric(10,3) not null check (road_distance_km >= 0),
  vehicle_type text not null check (vehicle_type in ('motorcycle','car','van')),
  fuel_price_snapshot_zar numeric(10,3) not null,
  fuel_consumption_snapshot_km_per_litre numeric(8,3),
  delivery_leg_fee_zar numeric(10,2) not null check (delivery_leg_fee_zar >= 0),
  currency char(3) not null default 'ZAR',
  route_provider text,
  route_reference text,
  quote_expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.manihub_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_payment_id text unique,
  idempotency_key text not null unique,
  customer_id uuid,
  currency char(3) not null default 'ZAR',
  item_subtotal_zar numeric(12,2) not null default 0 check (item_subtotal_zar >= 0),
  delivery_fee_zar numeric(12,2) not null default 0 check (delivery_fee_zar >= 0),
  payment_service_fee_zar numeric(12,2) not null default 0 check (payment_service_fee_zar >= 0),
  total_charged_zar numeric(12,2) not null check (total_charged_zar >= 0),
  status text not null default 'created' check (status in ('created','pending','paid','partially_refunded','refunded','failed','disputed')),
  provider_fee_zar numeric(12,2) not null default 0 check (provider_fee_zar >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manihub_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.manihub_payment_transactions(id) on delete restrict,
  recipient_type text not null check (recipient_type in ('platform','seller','driver','tax_or_adjustment')),
  recipient_id uuid,
  allocation_type text not null check (allocation_type in ('category_commission','payment_service_fee','delivery_fee','seller_proceeds','provider_processing_cost','refund','adjustment')),
  amount_zar numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','allocated','settled','reversed','failed')),
  provider_transfer_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.manihub_provider_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  plan_name text not null,
  monthly_price_zar numeric(10,2) not null default 0 check (monthly_price_zar >= 0),
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.manihub_provider_subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null,
  plan_id uuid not null references public.manihub_provider_plans(id),
  payment_provider_subscription_id text unique,
  status text not null default 'pending' check (status in ('pending','active','past_due','cancelled','expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.manihub_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_user_id uuid not null,
  campaign_name text not null,
  placement text not null,
  price_zar numeric(12,2) not null check (price_zar >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','pending_payment','active','paused','completed','cancelled')),
  payment_transaction_id uuid references public.manihub_payment_transactions(id),
  created_at timestamptz not null default now()
);

-- The initial proposed prices are editable configuration, not hard-coded checkout logic.
insert into public.manihub_provider_plans (plan_key, plan_name, monthly_price_zar, features)
values
 ('free','Free',0,'{"basic_storefront":true,"basic_catalogue":true}'::jsonb),
 ('growth','Growth',199,'{"expanded_catalogue":true,"sales_reports":true,"promotion_tools":true}'::jsonb),
 ('professional','Professional',499,'{"advanced_storefront":true,"staff_accounts":true,"analytics":true,"booking_tools":true}'::jsonb)
on conflict (plan_key) do nothing;

-- No public/client write policies are created here. Payment and pricing writes
-- must be performed by trusted server-side functions using a protected service role.
alter table public.manihub_fee_rules enable row level security;
alter table public.manihub_delivery_regions enable row level security;
alter table public.manihub_vehicle_rates enable row level security;
alter table public.manihub_delivery_quotes enable row level security;
alter table public.manihub_payment_transactions enable row level security;
alter table public.manihub_payment_allocations enable row level security;
alter table public.manihub_provider_plans enable row level security;
alter table public.manihub_provider_subscriptions enable row level security;
alter table public.manihub_ad_campaigns enable row level security;

comment on table public.manihub_payment_allocations is 'Auditable ledger of intended platform, seller and delivery allocations; provider settlement confirmation is stored separately.';
comment on table public.manihub_delivery_quotes is 'Immutable checkout quote snapshots; distance is the shop-to-customer delivery leg only.';
comment on column public.manihub_vehicle_rates.customer_rate_per_km_zar is 'Proposed customer rate per road kilometre; initial value R30/km is provisional and requires affordability and cost testing.';
