# ManiHub backend setup

This development build connects to the existing Supabase project already used by the main ManiHub site. The browser contains only the Supabase publishable key; never add a Supabase service-role key to HTML or JavaScript.

## What the marketplace page now connects

- Existing Supabase Auth session (same project as the main login page)
- Public active store directory and active store products
- Authenticated store creation and product publishing
- Private seller/customer conversations and message rows
- Buyer order history and seller order inbox
- Database-validated order creation and seller order-status changes

## Database migrations

The marketplace uses the following migrations. Check the Supabase SQL Editor / database schema first and do not re-run a migration if its objects have already been applied. For a fresh project, apply in dependency order:

1. `supabase/migrations/202611040001_manihub_revenue_delivery_foundation.sql`
2. `supabase/migrations/202611040004_manihub_messaging_foundation.sql`
3. `supabase/migrations/202611040005_manihub_messaging_rls_hardening.sql`
4. `supabase/migrations/202611040005_manihub_storefronts.sql`
5. `supabase/migrations/202611040006_manihub_listing_popularity.sql`
6. `supabase/migrations/202611040007_manihub_catalogue_orders_reviews.sql`
7. `supabase/migrations/202611040008_manihub_marketplace_actions.sql`

The seed migration `202611040002_seed_initial_delivery_regions.sql` is optional for this marketplace page; it is used by the delivery-pricing foundation.

To apply a migration: open Supabase Dashboard → SQL Editor → New query, open the matching SQL file in this repository, copy its complete contents, paste, and Run. Apply 0007 before 0008. The two files whose names begin with 0005 are separate migrations; apply both.

## Required checks

- In Supabase Authentication, confirm the existing email sign-in settings are working.
- In Supabase Authentication → URL Configuration, ensure the ManiHub GitHub Pages origin is in the allowed redirect URLs.
- In Supabase Database → Replication, enable Realtime for `manihub_messages` if live message updates are wanted. Messages still save and load without Realtime.
- Test with two separate user accounts: one creates a store and publishes a product; the other opens the store, starts a conversation and creates an order.
- Confirm the public product and store reads work while signed out, and private messages/orders are visible only to participants.

## Payment and delivery are deliberately not switched on yet

The order RPC creates an unpaid order using database prices and checks stock inside a database transaction. It does **not** charge a card. It temporarily deducts the requested quantity when creating the pending order. A trusted expiry/cancellation flow should restore stock for abandoned or failed payments before launch.

Delivery orders currently save the address but use a zero delivery fee. The delivery quote engine, distance calculation, delivery fleet rates, category commissions and payment-service fee must be calculated on a trusted server, not accepted from browser values.

Before collecting real money, choose a South African payment provider (for example PayFast, Yoco or Peach Payments), create/verify the ManiHub merchant account, and add its private credentials as Supabase Edge Function secrets. Implement a signed payment notification/webhook that verifies the provider transaction before changing an order to paid. Never put merchant secrets or the Supabase service-role key in this repository or in browser code.

## Current deployment boundary

All code in this folder is committed to the development branch `manihub/complete-marketplace-build`. The existing `main` branch and live homepage have not been replaced. Supabase SQL migrations also require applying in the project's SQL Editor; a GitHub commit does not execute database SQL.
