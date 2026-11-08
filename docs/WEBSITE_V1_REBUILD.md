# ManiHub Website v1 — rebuild notes

## Goal

Build one responsive ManiHub application that is the source of truth for the website, Android app and iOS app. The native apps will package the same Vite build output; they will not have separate login screens, marketplace markup or backend clients.

## Protected production state

- The work is isolated on `rebuild/website-v1`.
- The existing `main` branch remains unchanged and is the rollback point.
- No production Supabase schema or data was changed for this rebuild.
- Native packaging is intentionally paused until the website passes its end-to-end checks.

## Shared stack

- Vite + TypeScript for the single frontend.
- Supabase project `oochtzrlpylesoqvtikg` for authentication, Postgres data and storage.
- `@supabase/supabase-js` imported as a bundled module (not loaded from a runtime CDN).
- Capacitor 8 for later Android and iOS wrappers.
- Capacitor `webDir` points to `dist`, the exact output of `npm run build`.

## Current data sources

- `profiles`: account display name and individual/business account type.
- `listings`: public active community listings.
- `manihub_stores`: public active storefronts.
- `manihub_store_products`: public active products in active stores.
- `manihub_conversations`, `manihub_conversation_participants`, `manihub_messages`: private messaging foundation.
- Existing order, review, delivery and payment tables remain in place for later feature integration.

The browser/mobile client uses only the Supabase publishable key. Row-level security remains the access-control boundary. Never place the service-role key in this repository or client bundle.

## Implemented in the first foundation pass

- New Vite/TypeScript application entry point and responsive ManiHub green/gold design.
- Original ManiHub transparent logo used in the UI.
- Bundled Supabase client with persistent session settings.
- Explicit backend health check at startup; the UI reports connected or shows a retryable connection failure instead of staying on an indefinite loading message.
- Email or phone/password sign-in, account registration, and email password-reset request.
- Profile bootstrap after successful authentication.
- Marketplace reads for active listings, stores and products.
- Seller storefront creation and product publishing against existing RLS-protected tables.
- Relative PWA asset paths for deployment under a root domain or sub-path.
- Automated TypeScript and Vite production build checks.

## Release gates before merging to main

1. Verify Supabase connectivity from a real browser session.
2. Test registration, email verification, sign-in, sign-out and password recovery.
3. Test phone sign-in/registration against the actual Supabase phone/SMS configuration.
4. Test buyer search and category browsing with real records.
5. Test seller storefront and product creation with a normal authenticated account.
6. Integrate and test private messaging.
7. Integrate order creation and order history; keep payment collection disabled until payment provider and company arrangements are ready.
8. Test on Android Chrome, desktop browsers and iOS Safari.
9. Only then package the same `dist` output with Capacitor and prepare native store releases.

## Security review items from Supabase advisors

The database advisor currently reports:
- Financial/configuration tables with RLS enabled and no client policies. This is a safe default-deny posture; do not add broad public policies to silence the warning.
- Several SECURITY DEFINER RPC functions callable by anon/authenticated roles. Review each function's intended exposure and authorization checks before public launch.
- Leaked-password protection is disabled in Supabase Auth and should be enabled before launch.
- Performance advisories for unindexed foreign keys and RLS policy expressions can be addressed after the core user journeys are stable.

These findings are recorded for review. This rebuild does not automatically change database policies or financial logic.
