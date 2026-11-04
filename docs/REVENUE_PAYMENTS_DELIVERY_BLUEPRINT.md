# ManiHub revenue, payments and delivery blueprint

This document records the agreed product rules for the next implementation stages. The SQL migrations in this folder create the initial data foundation; they do not activate live payments or delivery quotes.

## Five revenue streams

1. Category commission on eligible completed sales. Rates are configured per category and effective date in `manihub_fee_rules`.
2. ManiHub delivery income. Delivery is optional; collection has no delivery charge. Delivery is charged for the shop-to-customer leg only.
3. Provider subscriptions. Initial proposed plans: Free R0/month, Growth R199/month and Professional R499/month. Prices/features are editable and must be tested with providers.
4. Paid advertising and promotion, recorded as campaigns.
5. A clearly disclosed ManiHub payment-service fee, shown before the customer confirms payment. This is separate from the payment gateway's own processing fee.

Healthcare and legal professional fees must not automatically inherit ordinary marketplace commission rules. Their commercial model needs separate professional/regulatory review.

## Payment and settlement rules

- Use a marketplace-capable payment provider that supports the required South African seller onboarding, split allocations and settlement model.
- One checkout may contain several sellers only if the selected provider supports multi-recipient splitting for the South African account configuration.
- Calculate each seller's proceeds, category commission, ManiHub payment-service fee and delivery allocation on the server, not in browser JavaScript.
- Do not mark an order paid based only on a browser redirect. Verify signed provider webhooks.
- Use idempotency keys and unique provider payment/transfer references to prevent duplicate charges or allocations.
- Keep a ledger of intended allocations and separately record provider settlement confirmation.
- Refunds, partial refunds, disputes, chargebacks and failed transfers must reverse or adjust ledger allocations.
- Never put provider secret keys or Supabase service-role keys in `index.html` or any public repository file.

## Distance-based delivery

- Route distance is the road distance from the seller's collection address to the customer's delivery address.
- Charge for the delivery leg only. Do not add the driver's return trip to the customer quote.
- Collection has a delivery fee of R0.
- Obtain route distance from a routing provider on a trusted backend. Do not use straight-line distance or trust a distance supplied by the browser.
- Initial service areas: Humansdorp and Jeffreys Bay, Eastern Cape. The route calculation must use exact shop/customer addresses, not a fixed town-to-town amount.
- Vehicle types: motorcycle, car and van.
- Fuel types: petrol and diesel (electric can be supported later).
- Each region/vehicle/fuel combination has configurable fuel price, consumption, customer price per kilometre, minimum fee, driver cost, maintenance, insurance and platform margin.
- Initial planning inputs: petrol R30/litre (rounded assumption) and proposed customer rate R30/road-km. R30/km is provisional, not an established cost benchmark or final customer tariff. Diesel price and vehicle consumption must be entered/verified before enabling that configuration.
- A quote stores a snapshot of route distance, vehicle, fuel price and final delivery fee so later price changes do not alter an existing order.
- Recalculate when the customer changes delivery address or vehicle/fulfilment choice. Display the delivery amount before payment.

## Delivery price calculation

The first proposed customer-facing calculation is:

`delivery_fee = max(minimum_fee, road_distance_km * customer_rate_per_km)`

Operating-cost reporting must separately calculate fuel use:

`fuel_cost = (road_distance_km / consumption_km_per_litre) * fuel_price_per_litre`

Then include driver compensation, maintenance, insurance and other real operating costs when assessing ManiHub's delivery margin. Do not treat petrol price per litre as price per kilometre.

## Initial schema

- `manihub_fee_rules`: commission and payment-service fee configuration.
- `manihub_delivery_regions`: delivery regions.
- `manihub_vehicle_rates`: per-region vehicle, fuel and delivery pricing.
- `manihub_delivery_quotes`: immutable quote snapshots.
- `manihub_payment_transactions`: payment totals and provider status.
- `manihub_payment_allocations`: auditable intended split allocations.
- `manihub_provider_plans` and `manihub_provider_subscriptions`: recurring provider plans.
- `manihub_ad_campaigns`: paid promotions.

All new tables have row-level security enabled and no public write policies. Access must be added deliberately through secure backend functions and admin authorization. Do not expose service-role access to the client.

## Build sequence

1. Apply and verify the SQL migrations in Supabase.
2. Implement protected backend functions for admin pricing, route quotes, checkout calculations and payment-provider webhooks.
3. Build the admin pricing dashboard.
4. Build seller storefronts, department/catalogue structure and customer checkout.
5. Integrate the selected marketplace payment provider in test mode, then verify multi-seller allocations, refunds and settlement before going live.
6. Implement delivery dispatch, driver app/workflow, tracking and operational reporting.

## Existing application compatibility

The existing public marketplace, Supabase authentication, listing details, advert publishing and listing photo upload are to be preserved. These migrations create separate ManiHub tables and do not alter the existing `listings` table or storage bucket.
