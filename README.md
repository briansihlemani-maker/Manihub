# ManiHub

South Africa's community marketplace — Buy. Sell. Grow. Together.

## Website v1 development

The clean shared application is being built on the `rebuild/website-v1` branch. The existing production `main` branch is intentionally preserved until browser and account-flow checks pass.

### Stack

- Vite + TypeScript
- Supabase Auth and Postgres
- Capacitor 8 for future Android and iOS packages
- One shared frontend build for all three platforms

### Run locally

```bash
npm install
npm run dev
```

### Production build and browser smoke tests

```bash
npm run build
npx playwright install chromium
npm run test:e2e
```

The build output is `dist/`. Capacitor is configured to package this exact directory for Android and iOS after the website is validated.

### Backend

The frontend uses only the Supabase publishable key. Row-level security protects user data. Never place a service-role key in the browser or mobile app.

See [the website v1 rebuild notes](docs/WEBSITE_V1_REBUILD.md) for the architecture, implemented flows, database sources, security review items and launch gates.
