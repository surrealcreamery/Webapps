# Webapps (Consumer Storefront + Kiosk) — Architecture

> System map of the Surreal Creamery consumer React app. Verified against source; citations are `file:line` relative to repo root (`/Users/alberttien/React Apps/Webapps`). Companion doc: `docs/CHECKOUT_AND_KIOSK.md` (kiosk/checkout internals).

## Overview

A single React + Vite SPA that ships **five "app modes"** from one codebase, selected by a compile-time constant `VITE_APP_MODE` in `src/router.jsx:30` (`'COMMERCE' | 'EVENTS' | 'CATERING' | 'SUBSCRIPTION'`). The deployed build is **COMMERCE**, the Surreal Creamery storefront, which additionally embeds the other apps as sub-routes under the Commerce header/footer.

What it does:
- **Storefront** — product catalog browse, product modals, modifiers, cross-sells, bundles, discounts (`src/pages/Commerce.jsx`).
- **Checkout** — Square Web Payments card entry, OTP verification, order creation (`src/pages/CheckoutPage.jsx`).
- **Kiosk mode** — tablet self-order at `/kiosk`, paired to a Square terminal for in-store payment (`src/layouts/commerce/kioskLayout.jsx`, `src/components/kiosk/`).
- **Signage** — fullscreen TV menu display at `/signage/:configId` (`src/pages/Signage.jsx`).
- **Subscriptions** — Dollar Boba Club wizard (`src/pages/Subscriptions.jsx`, XState).
- **Catering** — quote/order flow (`src/pages/Catering.jsx`, XState).
- **Events / Fundraisers / Space rental** — event registration + booking (`src/pages/EventsTest.jsx`, `src/pages/BookASpace.jsx`, XState).
- **Loyalty** — Surreal Rewards points display/redeem, tied into checkout (`src/contexts/commerce/LoyaltyContext.jsx`).
- **Real-time layer** — shared API Gateway WebSocket for live inventory, notifications, promos, admin nudges, kiosk↔POS handshake.
- **Analytics** — PostHog + GA4 + first-party event tracker with UTM/multi-touch attribution (`src/router.jsx:255-321`, `src/services/analytics.js`).

## Structure of `src/`

| Folder | Contents |
|--------|----------|
| `pages/` | Top-level screens (Commerce, CheckoutPage, AccountPage, Signage, Subscriptions, Catering, EventsTest, BookASpace, Redeem, Custom/Location/Privacy/Accessibility/DeliveryCheck) |
| `layouts/` | Per-app shells: `commerce/` (commerceLayout, kioskLayout, signageLayout), `events/`, `catering/`, `subscriptions/` — each has a full layout + a `*BareLayout` for embedding under Commerce |
| `contexts/` | React Context providers, grouped `commerce/`, `events/`, `catering/`, `subscriptions/` |
| `hooks/` | `useCart`, `useCommerceWebSocket`, `useKioskMode`, `useKioskWebSocket`, `useLocationAvailability`, `useRealTimeInventory` |
| `services/` | API/backend clients (see Services table) |
| `state/` | XState machines: `commerce/`, `catalog/`, `catering/`, `subscription/`, `events/` |
| `components/` | UI grouped by app: `commerce/`, `kiosk/`, `signage/`, `events/`, `subscription/`, `catering/`, plus `header/`, `footer/`, `seo/`, `google-tag-manager/`, etc. |
| `constants/` | Endpoint URLs + config per app (`events/`, `catering/`, `subscriptions/`) |
| `theme/` | `publicTheme` (MUI) |
| `router.jsx` | **Live router** (`createBrowserRouter`). `router_all.jsx`, `router_events.jsx`, `router_*_backup.jsx` are stale/unused variants |
| `main.jsx` | Vite entrypoint → renders `AppRouter` |
| `firebase.js` | Firebase init (auth for loyalty/account) |

## Pages & routing

Router: `createBrowserRouter` in `src/router.jsx:379`. Root wraps everything in `PublicRootLayout` (`router.jsx:249`), which in COMMERCE mode nests all providers (see State management). Routes below are the COMMERCE `additionalRoutes` (`router.jsx:122-218`) plus top-level signage/kiosk.

| Route | Page / element | File | Purpose |
|-------|----------------|------|---------|
| `/` (index) | `Commerce` | `pages/Commerce.jsx` | Main storefront home |
| `/desserts`, `/collectibles` | `Commerce` | `pages/Commerce.jsx` | Category-filtered storefront views |
| `/category/:categoryId` | `Commerce` | " | Category deep-link |
| `/product/:productId` | `Commerce` | " | Product deep-link (opens product detail) |
| `/checkout` | `CheckoutPage` | `pages/CheckoutPage.jsx` | Square payment + OTP + order submit |
| `/delivery-check` | `DeliveryCheckPage` | `pages/DeliveryCheckPage.jsx` | Delivery address / zone check |
| `/account` | `AccountPage` | `pages/AccountPage.jsx` | Customer account (orders, loyalty) |
| `/redeem` | `Redeem` | `pages/Redeem.jsx` | Reward/points redemption |
| `/catering` | `CateringHome` (in `CateringBareLayout`) | `pages/Catering.jsx` | Catering app, own XState machine, Commerce chrome |
| `/events`, `/events/login`, `/events/dashboard`, `/events/:eventId[/:step]`, `/events/*` | `EventsHome` (in `EventsBareLayout`) | `pages/EventsTest.jsx` | Events/fundraiser registration flow |
| `/events/book-a-space` | `BookASpace` (lazy) | `pages/BookASpace.jsx` | Space-rental calendar + time-slot picker |
| `/book-space` | `EventsHome` | `pages/EventsTest.jsx` | Dedicated space-rental entry (auto-selects space-rental event) |
| `/subscriptions`, `/subscriptions/redeem` | `SubscriptionHome` / `Redeem` (in `SubscriptionsBareLayout`) | `pages/Subscriptions.jsx` | Subscription wizard |
| `/signage/:configId` | `Signage` (in `SignageLayout`) | `pages/Signage.jsx` | Fullscreen TV menu, no header/footer |
| `/kiosk`, `/kiosk/product/:productId` | `KioskOverlay` wrapping `Commerce` (in `KioskLayout`) | `layouts/commerce/kioskLayout.jsx` | Tablet self-order mode |
| `*` (catch-all) | `CustomPage` | `pages/CustomPage.jsx` | Dynamic pages from the admin Pages builder (`getPageConfig`) |

Non-COMMERCE modes (`SUBSCRIPTION`/`EVENTS`/`CATERING`) swap in their own `Layout`, `HomePage`, and `additionalRoutes` via the `appConfigs` object (`router.jsx:89-219`) — not built into the shipped storefront bundle.

## State management

Three layers: **React Context** (cross-cutting shared state), **hooks** (cart + websocket + kiosk), **XState machines** (per-app flow control). In COMMERCE the provider stack is nested in `PublicRootLayout` (`router.jsx:325-350`), order: `CatalogProvider → WebSocketProvider → SegmentProvider → NotificationProvider → CheckoutProvider → LoyaltyProvider → CateringLayoutProvider → EventsLayoutProvider → SubscriptionLayoutProvider → CommerceLayoutProvider`.

### Contexts (`src/contexts/commerce/`)

| Context | Holds | Notes |
|---------|-------|-------|
| `CatalogContext.jsx` | Published catalog (products/modifiers/categories), test-mode flag, selected location | Reacts to `selectedLocation` in localStorage + custom events |
| `CommerceLayoutContext.jsx` | UI/layout state: cart count, back button, product-detail state, **kiosk cart count/view mode**, `sendToCommerce` dispatcher; persisted to `localStorage` (`COMMERCE_STORAGE_KEY`) | Bridges XState commerce machine to the header/layout |
| `WebSocketContext.jsx` | Wraps `useCommerceWebSocket`; exposes `customerId`, customer traits, server notifications, flash/pushed promos, admin nudges, dismissed-ids (localStorage) | Surreal Commerce Protocol v1 client; feeds Segment/Notification contexts |
| `SegmentContext.jsx` | Visitor behavioral segment + scores, persistent `visitorId` (localStorage), cross-sell version | Server warm-start via `fetchVisitorSegment`; listens to WS segment pushes |
| `NotificationContext.jsx` | Active notifications, dismissed set (localStorage) | Fetches from analytics-api + live-appends from WebSocket |
| `LoyaltyContext.jsx` | `loyaltyAccount`, `pointsPerDollar` (default 10) | Backed by loyalty-api via `loyaltyService.js` |
| `CheckoutContext.jsx` (in `components/commerce/`) | Checkout confirmation (sessionStorage), OTP session token (localStorage, 24h expiry) | Shared between CheckoutPage and account |

Embedded-app layout contexts: `contexts/events/EventsLayoutContext.jsx`, `contexts/catering/CateringLayoutContext.jsx`, `contexts/subscriptions/SubscriptionsLayoutContext.jsx`.

### Hooks (`src/hooks/`)

| Hook | Role |
|------|------|
| `useCart.js` | Client cart CRUD, persisted to localStorage with timestamp/expiry (the source of truth for cart contents; XState commerce machine tracks UI, not items) |
| `useCommerceWebSocket.js` | Consumer WS client → `wss://gx86vaqflf.execute-api.us-east-1.amazonaws.com/production` (shared with admin & kiosk). Handles hydrate/notifications/promos/inventory pushes |
| `useKioskWebSocket.js` | Kiosk-specific WS client to same gateway; persistent kiosk UUID in localStorage |
| `useKioskMode.js` | All kiosk state/side-effects: terminal pairing (`getKioskDevice`, `resolveKioskCode` → terminal-api), POS checkout-status handling, cancel signal. Uses `useKioskWebSocket` |
| `useLocationAvailability.js` | Per-variant availability given selected location (`catalogUtils.checkLocationAvailability`) |
| `useRealTimeInventory.js` | Live stock for a SKU via `inventoryService.getProductInventory` |
| `components/commerce/useDiscounts.js` | Fetches `discounts.json`, auto-adds free-gift items when cart thresholds met |

### XState machines (`src/state/`)

| Machine | id / initial | Role |
|---------|--------------|------|
| `commerce/commerceMachine.jsx` | `commerce` / `browsing` | **UI/navigation only** — view filter (All/Desserts/Merchandise), product modal, cart banner/drawer open state, scroll position, last-viewed. Explicitly does NOT own products/cart/checkout (`commerceMachine.jsx:5-6`) |
| `catalog/catalogMachine.js` | `catalog` / `idle` | Loads/normalizes the published catalog |
| `events/eventsMachine.jsx` | `fundraiser` / `booting` | Full event-registration flow: session, event landing, OTP auth, contact form, registration/payment. Calls events-api, twilio-api, loyalty-api, subscription-api, master-orders (`eventsMachine.jsx:2` imports) |
| `events/bookASpaceMachine.jsx` | space-rental booking calendar/time-slot flow |
| `catering/cateringMachine.js` | catering quote/cart/order flow |
| `subscription/subscriptionMachine.js` | `wizard` / `booting` | Multi-step subscription signup (location, plan, payment, entitlements) |

`eventsMachineTest.jsx` is a test variant of the events machine.

## Services & backend integration

The consumer app calls the **same admin Lambda function-URLs** used by the admin console. Static JSON snapshots (published by admin) are served from `data.surrealcreamery.com`.

| Module | Endpoint / lambda | Actions / purpose |
|--------|-------------------|-------------------|
| `services/catalogService.js` | `data.surrealcreamery.com/catalog.json` (static) | Published catalog: products, modifiers, categories, per-product modifier lookup, sort/order |
| `services/pageConfigService.js` | **catalog-api** `ou6oqgnnqjo542342x64srup4q0ofoua.lambda-url` | `getPageConfig`, `validateDiscountCode`, `getPublishedPages`; also fetches `events.json`/`eventLocations.json` |
| `services/checkoutService.js` | **catalog-api** (same URL) | `createWebCheckout`, `calculateSquareOrder`, `createSquareCheckout`, `sendCheckoutOtp`, `verifyCheckoutOtp` |
| `services/inventoryService.js` | **catalog-api** (same URL) | `getProductInventory` (real-time stock by SKU) |
| `services/analytics.js` | **checkout-api** `viif6favb73jr3pm2ph6qcten40ethnp.lambda-url` | `getCheckoutConfig` (bootstraps PostHog key/host); wraps PostHog + GA4 + eventTracker; UTM/attribution helpers |
| `services/eventTracker.js` | **analytics-api** `jkvxu5q42hr5obu5tezrn4jg6a0uyqms.lambda-url` | First-party event ingestion (`trackEvents`), visitor id, `sendBeacon` flush on unload |
| `services/segmentService.js` | **analytics-api** (same URL) | `getActiveSegments`, `getSegmentCrossSells`, `reportUnknownSegment`, `getVisitorSegment`, `getCustomerSegmentHistory`, `persistVisitorSegment` |
| `services/loyaltyService.js` | **loyalty-api** `import.meta.env.VITE_LOYALTY_API_URL` | `getConsumerLoyalty`, `consumerRedeem`, `validateLoyaltyDiscount` (falls back to no-op if env unset) |
| `services/squareModifiers.js` | `2vrm44dxvudlprxwooup65hmna0xueao.lambda-url` (square-modifiers) | Modifier normalization, price calc, selection→custom-attributes mapping (currently uses local catalog data; remote call commented) |
| `hooks/useKioskMode.js` | **terminal-api** `oquxxk2q56me3ve7mk7nz2gav40apced.lambda-url` | `getKioskDevice`, `resolveKioskCode` (kiosk↔Square terminal pairing) |
| `hooks/useCommerceWebSocket.js` / `useKioskWebSocket.js` | **WebSocket** `wss://gx86vaqflf.execute-api.us-east-1.amazonaws.com/production` | Live inventory, notifications, promos, admin nudges, kiosk/POS checkout status |
| `contexts/commerce/NotificationContext.jsx` | analytics-api (`VITE_ANALYTICS_API_URL` fallback same URL) | Fetch active notifications |
| `components/commerce/useDiscounts.js` | `data.surrealcreamery.com/discounts.json` (static) | Discount rules + free-gift auto-add |

Embedded-app endpoints (`src/constants/`):

| Module | Endpoint | Purpose |
|--------|----------|---------|
| `constants/events/eventsConstants.js` | events-api `svlh6ckfdkcgh4fbvub2nyz2r40mcvdq`, twilio-api (OTP) `7rnb6v5zciq4rdjnlhly2v6kj40luwjc`, consumer-orders/master-orders `qeg2uc6ykdeexcnc64nn66ph7m0hrtep`, subscription-api `cnnpmufvrvqh2ixhhzmlc53iky0ztboz`, loyalty-api (env) | Event registration, OTP, order lookup, loyalty; plus static `events.json`/`locations.json` |
| `constants/subscriptions/subscriptionsConstants.js` | subscription-api `cnnpmufvrvqh2ixhhzmlc53iky0ztboz.lambda-url` (single URL, action-routed for plans/subscriber/OTP/cards/charges) | Subscription wizard backend |
| `constants/catering/cateringConstants.js` | Make.com webhooks (`hook.us2.make.com/...`) + static `cateringItems.json`/`cateringModifiers.json`/`cateringLocations.json` | Catering — not on internal Lambdas |

## Kiosk mode

Route `/kiosk` (and `/kiosk/product/:productId`) renders `KioskLayout` → `KioskOverlay` wrapping the normal `Commerce` page (`router.jsx:420-436`). `KioskOverlay` (`components/kiosk/KioskOverlay.jsx`) provides a `KioskContext` built from `useKioskMode({ enabled: true, ... })`, giving the storefront a kiosk-specific cart, terminal pairing, and POS-driven checkout. A `KioskCodeDialog` gates entry until the tablet is paired to a Square terminal (terminal id persisted in `localStorage.kioskTerminal`); `KioskDebugConsole` aids on-site debugging. Payment happens on the paired Square terminal, with status pushed back over the shared WebSocket.

**Details (terminal handshake, checkout-status states, cancel flow) live in the companion `docs/CHECKOUT_AND_KIOSK.md` — cross-reference rather than duplicated here.**

## Build & deploy

Vite + React (`package.json` scripts):
- `npm run dev` — Vite dev server
- `npm run build` — production build to `dist/`
- `npm run lint` — ESLint (max-warnings 0)
- `npm run preview` — serve built output

Deploy targets:

| Command | Target bucket | CloudFront | Environment |
|---------|--------------|------------|-------------|
| `npm run deploy` | `s3://beta.surrealcreamery.com` | `EY5S4R7NXFD22` | **beta (default / safe)** |
| `npm run deploy:prod` | `s3://www.surrealcreamery.com` | `E21JJT29KWFLME` | **⚠️ PRODUCTION (www)** |

> ### ⚠️ PRODUCTION DEPLOY IS GATED — HARD RULE
> `deploy:prod` publishes to **www.surrealcreamery.com (PRODUCTION)** and invalidates CloudFront **E21JJT29KWFLME**. Per project rules, **never** run it (or any manual `s3 sync`/invalidation against `www`/`E21JJT29KWFLME`) unless the user **explicitly** says "deploy to www"/"deploy to prod", and **always confirm first**. A bare "deploy" means **beta only**. The user has been burned by accidental www deploys — treat this as non-negotiable.

The app-mode constant (`VITE_APP_MODE`) is hard-coded to `COMMERCE` in `src/router.jsx:30`; other modes ship as separate builds/sites (Subscriptions, Events, Catering domains noted in `appConfigs` comments).
