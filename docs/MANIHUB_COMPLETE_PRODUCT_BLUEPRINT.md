# ManiHub complete marketplace build

## Product structure (agreed)

This build follows the owner's four-channel blueprint. It is a connected product, not four unrelated pages.

1. **Homepage (Page 1)** — existing homepage is protected. It introduces ManiHub, keeps the existing logo, search, login and promotions. “More” opens Explorer; “List something” starts the seller journey.
2. **Explorer (Page 2)** — discovery only: products/listings, businesses/stores, search, category browsing, adverts, and entry points to create a store or list a product. Do not duplicate homepage hero promotions or turn Explorer into another landing page.
3. **Store & Product (Page 3)** — a selected business opens its own storefront; a selected listing opens its own detail view. Store profile includes business name/logo/description, photos and promotional video, products/services/prices, per-item stock, hours/address/contact, and reviews/ratings.
4. **Messaging, Orders & Payments (Page 4)** — contextual customer/business conversations, cart and orders, collection/delivery choice, checkout/payment, seller order management, stock and fulfilment status. These features attach to stores and products; they are not one giant page.

## Build branch

Work is being isolated on `manihub/complete-marketplace-build`. The live `main` branch and existing homepage are not changed by this preview.

Preview route: `/Manihub/marketplace/` after the branch is merged and GitHub Pages deploys it.

## What has been added in this build pass

- An isolated, mobile-first four-channel marketplace preview at `marketplace/index.html`.
- Explorer search and category filtering over sample catalogue data.
- Product detail and storefront navigation.
- Contextual message-thread UI.
- Basket, collection/delivery selection and preview order history.
- Seller listing-preview entry point.
- Explicit preview notices: sample data and local interactions are not live account, message, order or payment services.

## Existing production foundations to preserve and connect

The existing `index.html` contains the homepage, Supabase auth, public listings, Explorer and store creation UI. Existing Supabase migrations include storefront, messaging, revenue/payment/delivery foundations. Do not replace the current homepage or duplicate existing tables without first reviewing their schemas and policies.

The revenue/payment/delivery blueprint is in `docs/REVENUE_PAYMENTS_DELIVERY_BLUEPRINT.md`. It correctly requires trusted server-side checkout calculations, provider webhook verification, idempotency, auditable allocations, and no service-role/payment secret in browser code.

## Integration work still required before production

1. Review the existing listing, profile, store, product, order and message schemas and all RLS policies.
2. Connect Explorer search and cards to the existing live listings and active public stores; remove sample catalogue data.
3. Complete store catalogue/media/stock/hours/reviews using authenticated owner-only writes and public active-store reads.
4. Connect messages to the existing conversation/participant/message tables. Enforce participant access and server-side creation of both participants.
5. Add order/cart/fulfilment tables and secure RPC/Edge Functions. Validate price and stock on the server; never trust browser totals.
6. Implement payment-provider sandbox integration and signed webhooks before accepting money. A browser redirect is not proof of payment.
7. Connect collection/delivery quotes to trusted route calculation and immutable quote snapshots.
8. Add seller order management and stock updates with authorization checks.
9. Add admin controls, moderation/reporting, audit trail, refund/dispute workflow and operational monitoring.
10. Test end-to-end on Android and desktop, including refresh/deep links, auth recovery, permissions, duplicate payment callbacks, stock races, empty/error/loading states and accessibility.

## Release gates

- Homepage unchanged unless an explicit, separately reviewed integration is approved.
- No fake success states for sign-in, listing publication, messages, orders or payments.
- No payment goes live before provider account setup, test-mode verification, webhook validation and refund testing.
- No secret keys or service-role keys in client-side files.
- Every user-facing action must either work against the live backend or be clearly labelled preview-only.
- Do not merge the build branch into `main` until integration and regression tests pass.

## Current status

The isolated UI preview is a first implementation slice, not a finished production marketplace. The next engineering work is backend/schema review and live data integration. A successful GitHub commit does not mean the live GitHub Pages site has deployed or that Supabase/payment services are configured.
