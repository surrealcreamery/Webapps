# Behavioral Analytics & Paid Media Attribution

## Overview

This system captures every visitor interaction on the consumer site and feeds that data back to ad platforms to optimize paid media spend. Three layers work together:

1. **PostHog** — Captures everything in the browser (autocapture + session replay + manual ecommerce events)
2. **GA4** — Standard Google Analytics ecommerce events (enables Google Ads integration)
3. **Server-side Conversions API** — Sends purchase/cart events directly from Lambda to Meta/Google/TikTok (bypasses ad blockers)

Data flows into S3 via PostHog batch export, queryable with Athena SQL for audience building and predictive scoring.

```
Visitor's Browser
    |
    |-- posthog-js --> PostHog Cloud (dashboard, session replay, funnels)
    |                       |
    |                       +-- Batch Export (hourly) --> S3 bucket
    |                                                       |
    |                                                    Athena (SQL)
    |                                                       |
    |                                                    Audience Sync Lambda
    |                                                       |
    |                                           +------+----+------+
    |                                           |      |           |
    |                                         Meta   Google    TikTok
    |                                       Audiences Audiences Audiences
    |
    |-- gtag.js --> GA4 (Google Ads attribution)
    |
    +-- (on purchase) checkout Lambda
              |
              +-- Meta Conversions API (server-side)
              +-- Google Enhanced Conversions (server-side)
              +-- TikTok Events API (server-side)
```

---

## Layer 1: PostHog (Browser-Side)

### What It Captures Automatically (zero code)

PostHog autocapture records every user interaction without any manual instrumentation:

- **Page views** — Every URL visited, SPA-aware (tracks React Router changes). Includes URL, title, timestamp.
- **Clicks** — Every click with element tag, CSS selector, text content, href, position on page.
- **Scroll depth** — How far down the page the user scrolled (percentage).
- **Session replay** — Full DOM recording of the user's screen. You press play and watch exactly what they saw, including mouse movements, hesitations, rage clicks.
- **Time on page** — Calculated from page view and page leave events.
- **Device info** — Browser, OS, device type, screen resolution.
- **Referrer** — Where they came from (google.com, instagram.com, direct).
- **UTM parameters** — `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` captured automatically from URL.
- **Session duration** — Total time from first to last event in a session.
- **Entry/exit pages** — Which page they landed on and which page they left from.
- **Input interactions** — Visible in session replay (inputs are masked for privacy).

### Example: What a Single Visitor's Timeline Looks Like

```
12:04:01  $pageview         /                     (landed on home page)
12:04:01  $set              utm_source=instagram, utm_campaign=summer_boba
12:04:18  $autocapture      clicked "Menu" (nav > a.menu-link)
12:04:19  $pageview         /desserts
12:04:35  $autocapture      clicked "Bubble Tea" category tab
12:04:42  $autocapture      scrolled to 60% depth
12:04:48  $autocapture      scrolled back to 30%
12:05:02  $autocapture      clicked product card "Taro Milk Tea"
12:05:02  product_clicked   { product_id: "taro-milk-tea", position: 3 }
12:05:03  $pageview         /product/taro-milk-tea
12:05:03  product_viewed    { product_id: "taro-milk-tea", price: 7.50 }
12:05:15  variant_selected  { variant_id: "large", price: 8.50 }
12:05:22  added_to_cart     { product_id: "taro-milk-tea", variant_id: "large", price: 8.50, qty: 1 }
12:05:24  cart_viewed       { item_count: 1, subtotal: 8.50 }
12:05:31  checkout_started  { item_count: 1, subtotal: 8.50 }
12:05:32  $pageview         /checkout
12:06:45  fulfillment_selected { method: "pickup", location_slug: "pasadena" }
12:07:12  payment_attempted { payment_method: "evervault", total_cents: 922 }
12:07:15  order_completed   { order_id: "abc123", total: 922, item_count: 1 }
```

The `$` prefixed events are automatic. The named events (product_clicked, etc.) are manual instrumentation.

### Manual Ecommerce Events (12 instrumentation points)

These add business context that autocapture can't know — product IDs, prices, cart values.

| Event | Properties | Trigger Location |
|-------|-----------|-----------------|
| `product_clicked` | product_id, name, category, price, position | Commerce.jsx — onProductTap handler |
| `product_viewed` | product_id, name, variant_id, price, has_modifiers | Commerce.jsx — ProductDetailPage mount |
| `variant_selected` | product_id, variant_id, variant_name, price | Commerce.jsx — selectedVariantId change |
| `added_to_cart` | product_id, variant_id, name, price, qty, modifiers | Commerce.jsx — handleAddToCart |
| `cart_viewed` | item_count, subtotal | CartDrawer.jsx — drawer opens |
| `removed_from_cart` | product_id, variant_id, name | CartDrawer.jsx — remove button |
| `checkout_started` | item_count, subtotal | CartDrawer.jsx — handleCheckout |
| `fulfillment_selected` | method, location_slug | CheckoutPage.jsx — validateAndPay |
| `payment_attempted` | payment_method, total_cents | CheckoutPage.jsx — before createSquareCheckout |
| `order_completed` | order_id, subtotal, tax, tip, total, item_count, payment_method | CheckoutPage.jsx — after confirmation |
| `identify` (checkout) | customer_id, email | CheckoutPage.jsx — OTP verify |
| `identify` (account) | customer_id, firstName, lastName | AccountPage.jsx — OTP login |

### User Identity & Cart Linking

- **Anonymous visitors**: PostHog auto-assigns a `distinct_id` stored in localStorage.
- **Cart session**: `cart_id` from useCart is registered as a PostHog super property — automatically attached to every event.
- **Authenticated users**: When OTP is verified (checkout or account page), `posthog.identify(customerId)` merges the anonymous session with the known customer profile. All past anonymous events now belong to that customer.

### Configuration

The PostHog API key is stored in DynamoDB config (Admin → Settings → API Keys → PostHog). The consumer app fetches it at runtime via `getCheckoutConfig`. No redeploy needed to change or disable.

**Files:**
- `src/services/analytics.js` — Unified service, all tracking functions
- `src/router.jsx` — Calls `initAnalytics()` on app load
- Admin `Settings.jsx` — POSTHOG_API_KEY and POSTHOG_HOST fields
- `lambda-checkout-api/index.mjs` — getCheckoutConfig returns posthogApiKey

---

## Layer 2: GA4 (Google Analytics)

The existing GA4 tracking functions in `src/components/google-tag-manager/google-tag-manager.js` were already in the codebase but never called. They are now activated — each analytics.js function fires both PostHog and the corresponding GA4 event.

| analytics.js function | GA4 function called |
|---|---|
| trackProductClicked | trackSelectItem |
| trackProductViewed | trackViewItem |
| trackAddedToCart | trackAddToCart |
| trackRemovedFromCart | trackRemoveFromCart |
| trackCartViewed | trackViewCart |
| trackCheckoutStarted | trackBeginCheckout |

GA4 is configured in router.jsx with GTM ID `GTM-T5KTLSWV` and GA4 ID `G-KK2CZRQQQ6`.

**Why keep GA4 alongside PostHog:**
- Industry standard — marketing agencies expect GA4 data
- Google Ads attribution — GA4 ecommerce events can be imported as Google Ads conversions
- Free, unlimited data retention for aggregated reports

---

## Layer 3: Server-Side Conversions API

### Why Server-Side Matters

Browser-side tracking (pixels) is unreliable:
- Ad blockers block 25-40% of tracking pixels
- iOS App Tracking Transparency blocks Meta pixel
- Safari ITP limits cookie lifetime to 7 days
- Browser privacy features increasingly strip referrer data

Server-side tracking sends conversion data directly from the checkout Lambda to ad platforms. No blocker can stop it. This is critical for ad algorithm optimization.

### Meta Conversions API (CAPI)

When a purchase happens, the checkout Lambda sends an event to Meta:

```
POST https://graph.facebook.com/v19.0/{PIXEL_ID}/events

{
  "data": [{
    "event_name": "Purchase",
    "event_time": 1712345678,
    "action_source": "website",
    "event_source_url": "https://www.surrealcreamery.com/checkout",
    "user_data": {
      "em": [sha256(email)],          // hashed email
      "ph": [sha256(phone)],          // hashed phone
      "fbc": "fb.1.1612345678.AbCdEf", // Facebook click ID (from _fbc cookie)
      "fbp": "fb.1.1612345678.1234567" // Facebook browser ID (from _fbp cookie)
    },
    "custom_data": {
      "currency": "USD",
      "value": 47.30,
      "content_ids": ["taro-milk-tea-large", "mango-boba-regular"],
      "content_type": "product",
      "num_items": 2,
      "order_id": "abc123"
    }
  }]
}
```

**What this enables:**
- Meta's algorithm learns which users (by hashed email/phone match) actually buy and for how much
- Optimizes ad delivery toward people similar to actual buyers
- Enables value-based optimization — Meta spends more to acquire high-value customers
- Conversion attribution works even when pixel is blocked

**Events to send:**
| Event | When | Value |
|---|---|---|
| `Purchase` | Order confirmed | Order total |
| `AddToCart` | Item added to cart | Item price |
| `InitiateCheckout` | Checkout page loaded | Cart subtotal |
| `ViewContent` | Product detail viewed | Product price |

### Google Enhanced Conversions

Similar concept for Google Ads. Uses the GA4 Measurement Protocol to send server-side events:

```
POST https://www.google-analytics.com/mp/collect?measurement_id=G-KK2CZRQQQ6&api_secret={SECRET}

{
  "client_id": "GA1.1.1234567890.1612345678",
  "events": [{
    "name": "purchase",
    "params": {
      "transaction_id": "abc123",
      "value": 47.30,
      "currency": "USD",
      "items": [
        { "item_id": "taro-milk-tea-large", "item_name": "Taro Milk Tea", "price": 8.50, "quantity": 1 }
      ]
    }
  }],
  "user_data": {
    "sha256_email_address": [sha256(email)],
    "sha256_phone_number": [sha256(phone)]
  }
}
```

**What this enables:**
- Google Ads knows which clicks led to actual purchases (not just page views)
- Enables Smart Bidding strategies (Target ROAS, Maximize Conversion Value)
- Works when cookies are blocked

### TikTok Events API

Same pattern as Meta CAPI:

```
POST https://business-api.tiktok.com/open_api/v1.3/event/track/

{
  "event_source": "web",
  "event_source_id": "{PIXEL_ID}",
  "data": [{
    "event": "CompletePayment",
    "event_time": 1712345678,
    "user": {
      "email": sha256(email),
      "phone": sha256(phone)
    },
    "properties": {
      "currency": "USD",
      "value": 47.30,
      "contents": [{ "content_id": "taro-milk-tea-large", "quantity": 1, "price": 8.50 }],
      "content_type": "product",
      "order_id": "abc123"
    }
  }]
}
```

### Config Keys Needed (Settings → API Keys)

| Key | Platform | Where to find it |
|---|---|---|
| `META_PIXEL_ID` | Meta | Events Manager → Data Sources → Pixel ID |
| `META_CAPI_TOKEN` | Meta | Events Manager → Settings → Generate Access Token |
| `GA4_API_SECRET` | Google | GA4 Admin → Data Streams → Measurement Protocol API secrets |
| `TIKTOK_PIXEL_ID` | TikTok | TikTok Ads Manager → Assets → Events → Pixel ID |
| `TIKTOK_ACCESS_TOKEN` | TikTok | TikTok for Business → Marketing API → Access Token |

---

## Layer 4: S3 + Athena Pipeline

### Purpose

PostHog's dashboard is great for quick insights but limited for custom analysis. The S3 + Athena pipeline gives you raw event data you own, queryable with SQL.

### Setup

**1. S3 Bucket Prefix**

PostHog writes hourly JSON-lines files to:
```
s3://data.surrealcreamery.com/posthog-events/
```

**2. IAM Role for PostHog**

Cross-account IAM role that grants PostHog's AWS account `s3:PutObject` access to the prefix above. PostHog provides their account ID during batch export setup.

**3. PostHog Batch Export Configuration**

In PostHog dashboard: Data Pipeline → Batch Exports → Create → S3
- Bucket: `data.surrealcreamery.com`
- Prefix: `posthog-events/`
- Region: `us-east-1`
- Frequency: Hourly
- Format: JSON lines

**4. Athena External Table**

```sql
CREATE EXTERNAL TABLE posthog_events (
  uuid STRING,
  event STRING,
  distinct_id STRING,
  properties STRING,    -- JSON string with all event properties
  timestamp STRING,
  team_id INT,
  created_at STRING
)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://data.surrealcreamery.com/posthog-events/'
TBLPROPERTIES ('has_encrypted_data'='false');
```

### Example Queries

**Conversion funnel:**
```sql
SELECT
  COUNT(DISTINCT CASE WHEN event = 'product_viewed' THEN distinct_id END) as viewed,
  COUNT(DISTINCT CASE WHEN event = 'added_to_cart' THEN distinct_id END) as added_to_cart,
  COUNT(DISTINCT CASE WHEN event = 'checkout_started' THEN distinct_id END) as checkout_started,
  COUNT(DISTINCT CASE WHEN event = 'order_completed' THEN distinct_id END) as purchased
FROM posthog_events
WHERE timestamp >= '2026-04-01';
```

**Revenue by UTM source:**
```sql
SELECT
  json_extract_scalar(properties, '$.initial_utm_source') as source,
  COUNT(*) as orders,
  SUM(CAST(json_extract_scalar(properties, '$.total') AS DOUBLE)) / 100 as revenue
FROM posthog_events
WHERE event = 'order_completed'
  AND timestamp >= '2026-04-01'
GROUP BY 1
ORDER BY revenue DESC;
```

**Cart abandonment rate by product:**
```sql
WITH added AS (
  SELECT distinct_id, json_extract_scalar(properties, '$.product_id') as product_id
  FROM posthog_events WHERE event = 'added_to_cart'
),
purchased AS (
  SELECT distinct_id FROM posthog_events WHERE event = 'order_completed'
)
SELECT
  a.product_id,
  COUNT(DISTINCT a.distinct_id) as added_to_cart,
  COUNT(DISTINCT p.distinct_id) as purchased,
  ROUND(1.0 - (COUNT(DISTINCT p.distinct_id) * 1.0 / COUNT(DISTINCT a.distinct_id)), 2) as abandonment_rate
FROM added a
LEFT JOIN purchased p ON a.distinct_id = p.distinct_id
GROUP BY 1
ORDER BY abandonment_rate DESC;
```

**Converter vs non-converter behavioral profiles:**
```sql
WITH user_stats AS (
  SELECT
    distinct_id,
    COUNT(CASE WHEN event = '$pageview' THEN 1 END) as page_views,
    COUNT(CASE WHEN event = 'product_viewed' THEN 1 END) as products_viewed,
    COUNT(DISTINCT DATE(timestamp)) as visit_days,
    MAX(CASE WHEN event = 'order_completed' THEN 1 ELSE 0 END) as converted,
    json_extract_scalar(
      MIN(CASE WHEN event = '$pageview' THEN properties END),
      '$.initial_utm_source'
    ) as first_source
  FROM posthog_events
  GROUP BY 1
)
SELECT
  CASE WHEN converted = 1 THEN 'converter' ELSE 'non_converter' END as segment,
  COUNT(*) as users,
  ROUND(AVG(page_views), 1) as avg_pages,
  ROUND(AVG(products_viewed), 1) as avg_products_viewed,
  ROUND(AVG(visit_days), 1) as avg_visit_days
FROM user_stats
GROUP BY 1;
```

---

## Layer 5: Audience Sync for Paid Media

### How It Works

A scheduled Lambda runs daily, queries Athena for behavioral segments, and pushes hashed user lists to ad platforms as Custom Audiences.

```
CloudWatch Schedule (daily at 2am)
    |
    v
Audience Sync Lambda
    |
    +-- Query Athena: "cart abandoners last 7 days"
    +-- Query Athena: "purchasers with LTV > $100"
    +-- Query Athena: "high-intent browsers (3+ products, >2min)"
    |
    +-- Hash emails (SHA-256)
    |
    +-- Push to Meta Custom Audiences API
    +-- Push to Google Customer Match API
    +-- Push to TikTok Custom Audiences API
```

### Audience Segments

| Segment | Athena Query Logic | Ad Platform Use |
|---|---|---|
| **Cart abandoners** (7 days) | Has `added_to_cart` but no `order_completed` in last 7 days | Retarget with reminder ad. Highest ROAS. |
| **Past purchasers** | Has `order_completed` event | Exclude from acquisition campaigns (stop paying to acquire existing customers). Also use as seed for lookalike audiences. |
| **High-value customers** (LTV > $100) | Multiple `order_completed` with cumulative total > $100 | Lookalike audience — "find more people like these." Best lookalike seed. |
| **Repeat buyers** | 2+ orders | Upsell campaigns, loyalty offers. |
| **High-intent browsers** | 3+ `product_viewed`, session > 2 min, no purchase | Retarget within 24-48 hours while intent is fresh. |
| **Window shoppers** | Visited 3+ times, never purchased | Offer discount to convert. |
| **Lapsed customers** | Purchased 30+ days ago, no return visit | Win-back campaign. |

### Value-Based Bidding

Instead of telling ad platforms "optimize for purchases" (equal weight), send actual purchase value:

- Customer A bought $6 boba → conversion value = $6
- Customer B bought $85 collectibles → conversion value = $85

The ad algorithm will bid more aggressively for users who look like Customer B. This is configured in:
- **Google Ads**: Campaign settings → Bidding → Maximize Conversion Value
- **Meta Ads**: Campaign settings → Optimization → Value optimization (requires CAPI Purchase events with value)

The server-side Conversions API events already include the value field, so this is enabled once CAPI is integrated.

### Expected Impact

| Optimization | Typical Improvement |
|---|---|
| Server-side conversion tracking (vs pixel only) | 15-30% more attributed conversions |
| Excluding past purchasers from acquisition | 15-25% reduction in wasted spend |
| Lookalike audiences from high-LTV customers | 2-3x higher ROAS vs interest-based targeting |
| Cart abandoner retargeting | 5-15% recovery rate |
| Value-based bidding | 20-40% improvement in ROAS |

---

## Implementation Status

| Component | Status | Files |
|---|---|---|
| PostHog autocapture + session replay | Code deployed, needs PostHog account + API key in Settings | `src/services/analytics.js`, `src/router.jsx` |
| GA4 ecommerce event activation | Code deployed | `src/services/analytics.js` (calls existing GA4 functions) |
| Manual ecommerce events (12 points) | Code deployed | `Commerce.jsx`, `CartDrawer.jsx`, `CheckoutPage.jsx`, `AccountPage.jsx` |
| User identity (anonymous → known) | Code deployed | `CheckoutPage.jsx`, `AccountPage.jsx` |
| Cart ID super property | Code deployed | `Commerce.jsx` |
| PostHog API key in Settings | Code deployed | `Settings.jsx`, `lambda-checkout-api/index.mjs` |
| S3 + Athena pipeline | Not started | PostHog UI config + AWS console |
| Meta Conversions API | Not started | `lambda-checkout-api/index.mjs` |
| Google Enhanced Conversions | Not started | `lambda-checkout-api/index.mjs` |
| TikTok Events API | Not started | `lambda-checkout-api/index.mjs` |
| Audience Sync Lambda | Not started | New Lambda |
| Ad platform config keys in Settings | Not started | `Settings.jsx` |

---

## Activation Checklist

### Phase 1: PostHog (immediate)
1. Create PostHog account at posthog.com (free tier: 1M events/month, 5K replays)
2. Copy project API key
3. In Admin → Settings → API Keys → PostHog, paste the key
4. Deploy checkout Lambda (so getCheckoutConfig returns the key)
5. Deploy consumer site to beta
6. Browse the site, then check PostHog dashboard — should see pageviews, clicks, session replays

### Phase 2: S3 + Athena
1. In PostHog: Data Pipeline → Batch Exports → S3
2. Configure bucket `data.surrealcreamery.com`, prefix `posthog-events/`
3. Create IAM role for PostHog cross-account access
4. Create Athena table (DDL above)
5. Run test query to verify data flows

### Phase 3: Server-Side Conversions
1. Add Meta/Google/TikTok config keys to Settings page
2. Add CAPI calls to checkout Lambda (on order_completed)
3. Verify in Meta Events Manager / Google Ads that server events match

### Phase 4: Audience Sync
1. Create audience sync Lambda
2. Schedule daily via CloudWatch
3. Configure Custom Audiences in each ad platform
4. Set up lookalike audiences from high-LTV segment
5. Enable value-based bidding in campaigns
