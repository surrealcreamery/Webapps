# Webapps — Checkout & Kiosk Sync

How the consumer storefront takes an order (web card checkout, in-store kiosk with
Square Terminal, cash) and how a POS device and a paired kiosk stay in realtime sync.

- **Frontend repo:** `Webapps` (`src/`)
- **Backend repo:** `SurrealAdmin` (`lambda-checkout-api`, `lambda-terminal-api`,
  `lambda-master-orders`, `lambda-websocket`)
- **All money crossing the frontend↔backend boundary is in CENTS.** Cart item
  `unitPrice` is dollars; it is `Math.round(... * 100)` before it leaves the browser.

Lambda Function URLs used by the checkout UI (`CartDrawer.jsx:23-25`):

| Constant | URL host | Purpose |
|---|---|---|
| `TERMINAL_API_URL` | `oquxxk2q56me3ve7mk7nz2gav40apced` | Kiosk pairing, Square Terminal checkouts, `getKioskDevice` |
| `CHECKOUT_API_URL` | `viif6favb73jr3pm2ph6qcten40ethnp` | `createPayload`, `calculateSquareOrder`, `createWebCheckout`, `createKioskOrder` |
| `SHIPPING_API_URL` | `thugumzwi4445lq5q7qhnjfwoe0mrwjl` | Delivery availability check |
| WebSocket | `wss://gx86vaqflf.execute-api.us-east-1.amazonaws.com/production` | POS↔kiosk realtime sync (`useKioskWebSocket.js:3`) |

> Note: `src/services/checkoutService.js` points its helpers at a **different**
> `CATALOG_API_URL` host and is largely legacy — the live cart flow calls
> `CHECKOUT_API_URL` **directly** from `CartDrawer.jsx`, not through that service.

---

## Checkout pipeline

There are three distinct paths, chosen by two flags passed into `CartDrawer`:
`isKioskMode` (this browser is a kiosk) and `isPairedKiosk` (kiosk is paired to a POS).

### Path A — Web consumer (card, remote/pickup/delivery/shipping)

Entered when `isKioskMode` is false. `CartDrawer` does **not** take payment itself; it
navigates to the `/checkout` route. Card capture and order creation happen server-side.

1. **Bag calc (preview).** On every cart change (debounced 400 ms), `CartDrawer`
   POSTs `calculateSquareOrder` to `CHECKOUT_API_URL` with cart items, `pickupLocation`
   slug, fulfillment methods, and any `deliveryAddress`. Returns subtotal/tax/shipping
   preview (`CartDrawer.jsx:651-710`). Shipping is excluded from the bag calc — its cost
   is resolved at checkout after address entry.
2. **Delivery gate.** If any item is `fulfillmentMethod === 'delivery'` and no address is
   stored, `handleCheckout` opens the delivery modal;
   `handleValidateDeliveryAddress` POSTs `checkDeliveryAvailability` to `SHIPPING_API_URL`
   and caches the validated address (with `shipdayDeliveryFee`) in `localStorage`
   (`CartDrawer.jsx:779-825, 827-858`).
3. **Navigate to `/checkout`.** `handleCheckout` fires `trackCheckoutStarted`, closes the
   drawer, and `navigate('/checkout')`. The checkout page collects the card
   (Evervault) + contact/OTP and calls `createSquareCheckout` on the backend.
   `CartDrawer`'s own `handleWebCheckout` (`createWebCheckout` → Shopify draft-order URL,
   `CartDrawer.jsx:712-776`) is the older redirect-to-Shopify flow.
4. **Backend `createSquareCheckout`** (`lambda-checkout-api/index.mjs:1479`):
   re-validates every line price against the server catalog, creates the **Square Order**,
   writes the `CHECKOUT#<sqOrderId>` payload, processes payment via the Square Payments
   API, then calls `ingestCheckoutOrder` on master-orders. See the next section for the
   payload-first ordering guarantees.

### Path B — Kiosk with Square Terminal (paired or standalone)

Entered when `isKioskMode` is true. Payment is taken on a physical **Square Terminal**;
the browser polls for completion. This is the most involved path
(`CartDrawer.jsx:265-511`).

1. **Tip prompt.** `handleCheckout` sets `showTipSelection` (kiosk shows a tip screen
   before charging) instead of navigating (`CartDrawer.jsx:827-831`).
2. **Compute amount (cents).** `handleTerminalCheckout(tipCents)`:
   - *Paired* (`isPairedKiosk && kioskCart.length`): amount comes from the POS-synced
     `kioskCart`, tax = `subtotal * kioskTaxRate`.
   - *Standalone*: amount = `kioskTotal` from the local cart.
   - Builds `terminalLineItems` (name+variant+modifier string, `basePriceCents`, sku).
   - `totalWithTip = amountCents + tipCents` (`CartDrawer.jsx:356-413`).
3. **Write payload FIRST (`createPayload`).** Before charging, POSTs `createPayload` to
   `CHECKOUT_API_URL` with `source: 'surreal-kiosk'`, full `lineItems`
   (`unitPriceCents`, modifiers), `taxCents`, `tipCents`. The returned `payloadId` is
   stashed in `terminalPayloadId` (`CartDrawer.jsx:419-456`). Backend writes
   `PAYLOAD#<id>` to the `payloads` table (`lambda-checkout-api/index.mjs:1432-1477`).
4. **Create Terminal checkout.** POSTs `createTerminalCheckout` to `TERMINAL_API_URL`
   with `amountCents=totalWithTip`, `taxCents`, `skipTip: true`, `deviceId`,
   `locationId`, `lineItems`. Backend (`lambda-terminal-api/index.mjs:162`) resolves the
   location, creates a Square Order, and **pre-writes `SQUARE_LINK#` + `CHECKOUT#` and a
   shadow `createPendingOrder`** before pushing the checkout to the terminal
   (`lambda-terminal-api/index.mjs:414-485`). Returns a `checkoutId`.
5. **Snapshot + broadcast.** UI stores `terminalCheckoutId`, snapshots the cart
   (`terminalCartSnapshot`), sets status `waiting`, and if paired broadcasts
   `checkout_started` to the POS (`CartDrawer.jsx:483-505`).
6. **Poll every 3 s (2-min timeout).** `pollTerminalStatus` polls `getTerminalCheckout`:
   - `COMPLETED` → stop polling; if paired broadcast `checkout_status: completed`; then
     **`createKioskOrder`** (below). Show success 3 s, clear cart, close drawer.
   - `CANCELED`/`CANCEL_REQUESTED` → status `canceled`.
   - Timeout → attempt `cancelTerminalCheckout`, status `failed`
     (`CartDrawer.jsx:265-354`).
7. **`createKioskOrder`** (`lambda-checkout-api/index.mjs:3066`): fetches the Square order
   for real totals, **re-enriches modifiers** from Square line items (kiosk carts
   intermittently drop modifier selections), subtracts the baked-in tip so the mapper
   formula stays correct, writes the `CHECKOUT#` payload, and forwards
   `ingestCheckoutOrder` (with `payloadId`) to master-orders. The Square webhook is the
   fallback if this call fails — hence the frontend only logs, never blocks
   (`CartDrawer.jsx:307-312`).

### Path C — Cash / other kiosk tenders

Handled by POS-side flows / later in `CartDrawer.jsx` (>line 1260, not shown here).
Same payload-first + `ingestCheckoutOrder` contract as Terminal; cash simply skips the
Square Payments capture.

---

## Payload-first order architecture

**Problem:** Square fires an `order.updated`/payment webhook to master-orders for *every*
paid order, but the webhook payload is lossy — it has no modifiers, no clean product
names, no customer identity, no bundle/tournament context. If the webhook wins the race,
the master order is created with degraded data.

**Solution:** the app writes a record to the `payloads` table **before** payment so the
webhook path recognizes an app-initiated order and **skips**, letting the checkout path
create the order with full, clean cart data.

Records written to the `payloads` table (`pk == sk`):

| Key | Written by | Meaning |
|---|---|---|
| `PAYLOAD#<uuid>` | `createPayload` (pre-charge) | Full cart lineItems + tax/tip; durable source of truth, no TTL |
| `CHECKOUT#<sqOrderId>` | `createSquareCheckout` / `createKioskOrder` / terminal-api | Full checkout payload keyed by Square order id |
| `SQUARE_LINK#<sqOrderId>` | checkout-api / terminal-api | Links a Square order to its `payloadId`; webhook-skip flag |
| `PENDING#<sqOrderId>` | `createPendingOrder` (shadow) | Placeholder written before payment to close the webhook race |

**Webhook skip logic** — `ingestSquareOrder` (`lambda-master-orders/index.mjs:862-895`)
does a `Promise.all` GET of `CHECKOUT#`, `SQUARE_LINK#`, and `PENDING#` for the order id,
and returns early (`skipped: true`) if any exists:
- `CHECKOUT#` → `reason: 'checkout_payload_exists'`
- `SQUARE_LINK#` → `reason: 'payload_exists'`
- `PENDING#` → `reason: 'pending_order_exists'` (payment not settled yet; checkout path
  will create it)

It also skips kiosk orders by heuristic (`reference_id` starts with `kiosk-`, or a
`<n>x <name>` tender note with no source) since the app creates those via
`createKioskOrder` (`lambda-master-orders/index.mjs:922-929`).

**`createPendingOrder` shadow.** Because there's a window between "Square order created"
and "payload/order fully written", both `createSquareCheckout`
(`lambda-checkout-api/index.mjs:1775-1810`) and terminal-api
(`lambda-terminal-api/index.mjs:447-485`) fire a `createPendingOrder` to master-orders
that drops a `PENDING#<sqOrderId>` marker immediately. If the webhook arrives first it
sees `PENDING#` and defers.

**`ingestCheckoutOrder`** (`lambda-master-orders/index.mjs:1257`) is the authoritative
creation path. If given a `payloadId`, it re-reads `PAYLOAD#<id>` for enrichment/healing;
it also reconciles against any existing webhook-created order (patching empty modifiers,
customer, source) rather than duplicating (`:1282-1309`). For the full master-order
subsystem (mappers, dedup locks, loyalty award, inventory sync) see the Admin-repo
master-orders docs.

---

## POS ↔ Kiosk realtime sync

A **POS device** (SurrealAdmin `PointOfSale.jsx`) and a **consumer kiosk** (Webapps)
mirror cart, product views, location, and checkout status in realtime over an AWS API
Gateway WebSocket. There is no shared server cart — each side keeps its own cart and
rebroadcasts on change; the server is a dumb relay between two paired devices.

### Connect & identify (kiosk side)

`useKioskWebSocket.js` opens `wss://gx86vaqflf.../production` when
`enabled && kioskTerminal && deviceId` (`useKioskMode.js:146-148`). On open
(`useKioskWebSocket.js:60-96`):
- Sends `identify` with `role: 'kiosk'`, **`clientUUID = kiosk-<deviceId>`**, `deviceId`,
  `userAgent`. The kiosk-specific `clientUUID` prevents the server's stale-connection
  cleanup from evicting the consumer or MDM-agent connection for the same browser.
- Starts a 5-minute `ping` keepalive.
- Immediately sends `forward` `cart_request` so it pulls the partner's current cart on
  connect/reconnect (avoids clobbering the POS cart with an empty kiosk cart).
- Reconnect: exponential backoff capped at 60 s, plus an immediate reconnect on the
  browser `online` event (`useKioskWebSocket.js:147-214`).

### Routing (server `handleForward`)

Every sync message is sent as `{ action: 'forward', type, payload }`. The server
(`lambda-websocket/index.mjs:1139-1181`):
1. Looks up the sender connection → `deviceId`.
2. Reads `DEVICE.platformData.pairedDeviceId` for that device.
3. If no pair → replies `{type:'error', message:'No paired device'}`.
4. Scans the connections table for the paired device's connection(s) and relays
   `{ type, payload, fromDeviceId, timestamp }` to each.

So pairing is a single `pairedDeviceId` pointer on each DEVICE record; the WS never
inspects payload contents.

### Message types

| Type | Direction | Payload | Effect on receiver |
|---|---|---|---|
| `cart_sync` | both | `{ items: [...] }` | Replace local cart with synced items |
| `cart_request` | both | `{}` | Respond by broadcasting own `cart_sync` |
| `view_product` | POS→kiosk | `{ sku, name }` | Kiosk opens matching product (SKU then name lookup) |
| `close_product` | POS→kiosk | `{}` | Kiosk closes product modal |
| `location_sync` | POS→kiosk | `{ locationId }` | Kiosk sets `selectedLocation`, fires storage event |
| `checkout_started` | kiosk→POS | `{ checkoutId, method, total }` | POS shows in-progress checkout |
| `checkout_status` | both | `{ checkoutId, status }` | `completed`/`canceled`/`failed` ends overlay; `canceled` bumps kiosk cancel signal |
| `command` (`refresh`/`lockout`/`pairing_updated`) | server→device | — | `refresh`→reload (+flag); `lockout`→wipe kiosk creds+reload; `pairing_updated`→reload |

`command` messages come from the server/admin, not the partner device, and are handled
before the type switch (`useKioskWebSocket.js:104-122`).

### Broadcast / receive + echo suppression

The hard problem: A applies a remote cart, its cart-state effect fires, and it
rebroadcasts back to B → infinite loop. Both sides guard with a "this change came from
remote" ref.

**Kiosk** (`useKioskMode.js`):
- Receive `cart_sync` → set `isRemoteCartUpdateRef = true`, then `clearCart()` +
  re-`addToCart` each synced item (`:170-188`).
- Broadcast effect (on `localCart.cart` change): if `isRemoteCartUpdateRef` is set, clear
  it and **return without broadcasting**; otherwise map items to the kiosk shape and
  `kioskSendForward('cart_sync', ...)` (`:230-249`).
- `cart_request` received → reply with current cart as `cart_sync` (`:203-217`).

**POS** (`PointOfSale.jsx`) mirrors this with `isRemoteUpdateRef`: `onCartSync` sets the
ref then applies items; the broadcast effect returns early if the ref is set
(`:370-416`). On pairing it sends `cart_request` rather than an empty `cart_sync`
(`:398-404`), and broadcasts `location_sync` on location change (`:418-422`).

Item shape sent over the wire (both directions):
`{ sku, variantSku, name, variantName, unitPrice, quantity, modifiers, image }`
(`useKioskMode.js:237-246`). Note `unitPrice` here is **dollars** (WS is device-to-device,
not the cents backend boundary).

---

## Kiosk tax resolution

Kiosk tax is applied client-side in `CartDrawer` (`:203-205`):

```
kioskTaxRate = isKioskMode && kioskTerminal?.taxRate != null ? Number(kioskTerminal.taxRate) : 0
kioskTax     = round(subtotal * kioskTaxRate)
kioskTotal   = subtotal + kioskTax
```

So the *entire* tax calculation depends on `kioskTerminal.taxRate` being populated. That
value comes from the backend, resolved through this chain:

1. **Kiosk stores `kioskTerminal`** (incl. `taxRate`) in `localStorage`, set at pairing
   (`resolveKioskCode`) and refreshed on mount via `getKioskDevice`
   (`useKioskMode.js:47-78, 279-287`). The refresh only overwrites `taxRate` when the
   response includes one (`:66`).
2. **`getKioskDevice`** (`lambda-terminal-api/index.mjs:972`) resolves the tax rate:
   1. Read `DEVICE` record for the kiosk `deviceId`.
   2. Resolve a **location**: prefer `platformData.squareTerminal.locationId` matched
      against `locations.json` → app slug; fall back to `platformData.locationId`
      (`:990-1002`).
   3. **Only if a location was resolved**, GET `LOCATION / MASTER#<slug>` from the config
      table and set `response.taxRate = Number(Item.taxRate)` (with a normalized-slug
      fallback query) (`:1004-1030`).

### Failure mode: no location binding ⇒ 0% tax

If the kiosk DEVICE record has **neither** `platformData.squareTerminal.locationId` **nor**
`platformData.locationId`, `getKioskDevice` never reaches the tax lookup, `taxRate` is
absent from the response, `kioskTerminal.taxRate` stays null, and
`kioskTaxRate` falls back to **0** — the kiosk charges **subtotal only, no tax**, silently.

**Confirm:** check the DEVICE record (`pk=DEVICE, sk=DEV#<id>`) for
`platformData.squareTerminal.locationId` / `platformData.locationId`, and that a
`LOCATION / MASTER#<slug>` record with a numeric `taxRate` exists for that slug.

**Fix:** re-pair the kiosk so the DEVICE record gets a location binding — either bind the
terminal's `squareTerminal.locationId` or set `platformData.locationId`, then have the
kiosk re-run `resolveKioskCode`/`getKioskDevice` (a `pairing_updated` command triggers a
reload, `useKioskWebSocket.js:118-121`). After re-pair, `getKioskDevice` returns a
`taxRate` and the mount-refresh writes it into `kioskTerminal`.

---

## Failure modes & diagnostics

| Symptom | Likely cause | How to confirm |
|---|---|---|
| Kiosk charges no tax | DEVICE has no resolvable location (see above) | `getKioskDevice` response lacks `taxRate`; DEVICE record missing `squareTerminal.locationId`/`locationId`; no `LOCATION/MASTER#<slug>` with `taxRate` |
| POS & kiosk carts don't mirror | Devices not paired, or one side not connected | Server `handleForward` returns `No paired device`; DEVICE record missing `platformData.pairedDeviceId`; no row in the **connections** table for the partner `deviceId` |
| Cart mirrors one way only | One side's WS not open (dead device / backgrounded / battery) | Browser console `[KioskWS] Cannot send forward, WS not open`; no connection row for that `deviceId` |
| Kiosk stuck reconnecting | No network / API Gateway unreachable | `[KioskWS] Reconnecting in …ms`; reconnects immediately on `online` event |
| Duplicate master order | Payload-first record missing → webhook + checkout both created it | master-orders logs should show `skipped: checkout_payload_exists / payload_exists / pending_order_exists`; if absent, `CHECKOUT#`/`SQUARE_LINK#`/`PENDING#` was never written |
| Order created with no modifiers | `createKioskOrder` failed; webhook fallback used lossy data | frontend `[Terminal] createKioskOrder failed` warn; master order line items have empty `modifiers` |
| Terminal checkout hangs then fails | 2-min poll timeout — terminal offline/declined | `CartDrawer` status → `failed`, auto-sends `cancelTerminalCheckout` |

**Where connection state lives.** The WebSocket **connections** table
(`CONNECTIONS_TABLE`) holds one row per open socket keyed by `connectionId` with the
device's `deviceId`, `role`, and `subscriptions`. `handleForward` scans it by `deviceId`
to find the partner's live socket — if the partner has no row (never connected, or its
socket dropped), forwards are silently discarded, which is exactly the "device not
connected ⇒ no sync" case. Pairing state lives separately on the `DEVICE` config record
(`pk=DEVICE, sk=DEV#<id>`) as `platformData.pairedDeviceId`; a device can be paired but
offline (pointer present, no connection row).
