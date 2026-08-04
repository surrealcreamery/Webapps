# Webapps (Consumer Storefront + Kiosk) — Documentation Index

Start here. Docs are the **map**; the code is the **source of truth** — orient with a doc, then verify
the file/line before changing anything. This app is one React + Vite SPA that ships in `COMMERCE` mode
(storefront + embedded Events/Catering/Subscriptions, plus `/kiosk` and `/signage`).

## Start here (whole-system)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — app modes & routing, state layers (Contexts + hooks +
  XState machines), the services→backend-lambda map, and build/deploy targets.
- **[CHECKOUT_AND_KIOSK.md](CHECKOUT_AND_KIOSK.md)** — the three checkout paths (web card, kiosk
  terminal, cash), the **payload-first order architecture**, the **POS↔Kiosk realtime sync** (WebSocket
  + pairing + message types + echo-suppression), and the **kiosk tax chain** (`getKioskDevice` →
  location → `taxRate`, incl. the "no location binding ⇒ 0% tax" failure mode + fix).

## Feature docs
- **[behavioral-analytics.md](behavioral-analytics.md)** — consumer analytics / engagement tracking.
- **[free-shipping-reward.md](free-shipping-reward.md)** — free-shipping reward mechanics.
- **[accessibility-audit/](accessibility-audit/)** — a11y audit notes.

## Backend & deploy (important)
- The consumer app calls the **same admin Lambda function-URLs** as SurrealAdmin: catalog-api
  (checkout/inventory/pageconfig/discount + `createSquareCheckout`), checkout-api (config),
  analytics-api, loyalty-api, terminal-api (kiosk pairing), and the shared WebSocket
  `wss://gx86vaqflf…`. Static catalog/discount/event JSON comes from `data.surrealcreamery.com`.
- **Deploy targets:** `npm run deploy` → **beta** (`s3://beta.surrealcreamery.com`, CF `EY5S4R7NXFD22`).
  `npm run deploy:prod` → **www / PRODUCTION** (`s3://www.surrealcreamery.com`, CF `E21JJT29KWFLME`).
  ⚠️ **www/prod deploys require explicit confirmation** — default consumer "deploy" means beta only.

---
**Companion repo:** the admin app + all backend lambdas are **SurrealAdmin** —
see `../../SurrealAdmin/docs/README.md` (backend architecture, data model, order ingestion, the
pending-order shadow, cash/tax/reporting).
