# ManiHub mobile app builds

ManiHub uses one shared website codebase packaged with Capacitor for Android and iOS.

## Automated test builds

1. Open the repository's **Actions** tab on GitHub.
2. Select **ManiHub mobile builds**.
3. Select **Run workflow** and start it on the default branch.
4. Wait for both jobs to finish.
5. Open the completed workflow run and download:
   - `manihub-android-debug` — an Android debug APK for device testing.
   - `manihub-ios-simulator` — an unsigned iOS Simulator app for simulator testing.

These are test builds, not store-ready releases. The Android debug APK is not a Play Store release. The iOS Simulator build cannot be installed on a normal iPhone.

## Local build commands

Requires Node.js 22 and npm.

```sh
npm install
npm run build:mobile
npx cap add android
npx cap sync android
npx cap open android
```

For iOS, use a Mac with Xcode:

```sh
npm install
npm run build:mobile
npx cap add ios
npx cap sync ios
npx cap open ios
```

## Before publishing

- Test login, account creation, sign-out and session restore.
- Test product browsing, search, store pages, messaging and listing uploads.
- Test order and stock flows against the live Supabase project using test accounts.
- Add and validate native app icons and launch screens.
- Configure app privacy disclosures, support contact and store metadata.
- Configure Android release signing and Apple signing/provisioning.
- Create signed release builds only after functional and security testing.

Do not put Supabase service-role keys, signing passwords, or private certificates in the website source or repository. The public anon key is intended for client use only when Row Level Security and policies are correctly configured.
