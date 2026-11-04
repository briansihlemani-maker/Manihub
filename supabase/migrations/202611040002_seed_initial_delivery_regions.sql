-- Seed the first ManiHub delivery service area and provisional vehicle pricing.
-- Petrol uses the user's rounded planning input of R30/litre.
-- Diesel is left at R0 until the administrator enters the verified local price.
alter table public.manihub_vehicle_rates
  alter column fuel_price_per_litre_zar set default 0;

insert into public.manihub_delivery_regions (region_key, region_name, province)
values
  ('humansdorp','Humansdorp','Eastern Cape'),
  ('jeffreys-bay','Jeffreys Bay','Eastern Cape')
on conflict (region_key) do nothing;

insert into public.manihub_vehicle_rates
  (region_id, vehicle_type, fuel_type, fuel_price_per_litre_zar,
   consumption_km_per_litre, customer_rate_per_km_zar, minimum_delivery_fee_zar)
select r.id, v.vehicle_type, f.fuel_type,
       case when f.fuel_type = 'petrol' then 30 else 0 end,
       null, 30, 25
from public.manihub_delivery_regions r
cross join (values ('motorcycle'),('car'),('van')) as v(vehicle_type)
cross join (values ('petrol'),('diesel')) as f(fuel_type)
where r.region_key in ('humansdorp','jeffreys-bay')
on conflict (region_id, vehicle_type, fuel_type, effective_from) do nothing;

-- Rates are deliberately provisional. Add vehicle consumption and current diesel
-- prices in the admin pricing controls before enabling live delivery quotes.
