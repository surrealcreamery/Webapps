# Commerce (Shop) Page -- WCAG 2.1 Audit

**Route:** `/`, `/desserts`, `/collectibles`, `/category/:categoryId`, `/product/:productId`
**File:** `src/pages/Commerce.jsx`
**Overall Compliance:** AA

---

## 1. Perceivable

### 1.1 Text Alternatives (SC 1.1.1)

| Technique | Implementation |
|-----------|----------------|
| H37 | Product images have `alt={item.title \|\| ''}` |
| H37 | Thumbnails have `alt={`Product image ${idx + 1}`}` |
| H37 | MYO selection images have `alt={sel.name}` |
| H37 | Display modifier images have `alt={opt.name}` |
| ARIA14 | Product cards have `aria-label={`View product: ${item.title}`}` |
| ARIA14 | `CircularProgress` in Add to Cart buttons: `aria-label="Adding to cart"` |

No significant gaps.

### 1.2 Time-based Media

Not applicable -- no audio or video content.

### 1.3 Adaptable (SC 1.3.1, 1.3.2, 1.3.3)

| Technique | Implementation |
|-----------|----------------|
| H42 | Product title as `component="h1"` |
| H42 | Sub-category groups as `component="h3"` |
| G140 | CSS Grid layout preserves DOM reading order |
| ARIA14 | `role="button"` with `aria-label` on product cards |

| ARIA19 | Quantity display: `aria-live="polite" role="status"` between +/- buttons |

No significant gaps.

### 1.4 Distinguishable (SC 1.4.1, 1.4.3, 1.4.11)

| Technique | Implementation |
|-----------|----------------|
| G18/G145 | Dynamic contrast via `getAccessibleTextColorForGradient` and `getTextColorForBackground` |
| G178 | `&:focus-visible { outline: '2px solid #1976d2', outlineOffset: 2 }` on product cards, thumbnails, variant selectors |
| C22 | Font sizes use `rem` units throughout |

| ARIA7 | Fulfillment method emoji icons wrapped in `<span aria-hidden="true">` |

No significant gaps.

---

## 2. Operable

### 2.1 Keyboard Accessible (SC 2.1.1, 2.1.2)

| Technique | Implementation |
|-----------|----------------|
| G202/SCR20 | All `role="button"` elements have `onKeyDown` for Enter/Space with `e.preventDefault()` |
| H91 | MUI `Button` / `IconButton` for close, add-to-cart, quantity controls |

### 2.2 Enough Time

Not applicable -- no time-limited interactions.

### 2.3 Seizures and Physical Reactions (SC 2.3.1)

| Technique | Implementation |
|-----------|----------------|
| G19 | Framer Motion animations use short durations (0.25-0.4s), smooth transitions |

### 2.4 Navigable (SC 2.4.1, 2.4.2, 2.4.6)

| Technique | Implementation |
|-----------|----------------|
| H69 | Product title rendered as `h1` at beginning of detail view |

No significant gaps.

### 2.5 Input Modalities (SC 2.5.1)

| Technique | Implementation |
|-----------|----------------|
| H91 | Visible expand/collapse `IconButton` as alternative to scroll-driven gesture |

No significant gaps.

---

## 3. Understandable

### 3.1 Readable (SC 3.1.1)

Text content uses plain language; prices formatted consistently.

### 3.2 Predictable (SC 3.2.1, 3.2.3)

| Technique | Implementation |
|-----------|----------------|
| G61 | Product cards consistently navigate to detail on click/enter/space |

No significant gaps.

### 3.3 Input Assistance (SC 3.3.1, 3.3.2)

| Technique | Implementation |
|-----------|----------------|
| ARIA21 | Variant unavailability uses `aria-disabled` |

No significant gaps.

---

## 4. Robust

### 4.1 Compatible (SC 4.1.2, 4.1.3)

| Technique | Implementation |
|-----------|----------------|
| ARIA16 | `aria-label` on image expand/collapse button communicating state |
| ARIA4 | `aria-pressed={isActive}` on thumbnails, fulfillment, location selectors |
| ARIA5 | `aria-disabled={!available}` on fulfillment methods, unavailable variants |

---

## 5. Conformance

**Overall Level: Level AA. No remaining gaps.**

---

## Child Components

### Section.jsx

**File:** `src/components/commerce/Section.jsx`
**Level:** AA

| Technique | Implementation |
|-----------|----------------|
| H37 | Product images: `alt={product.imageAlt \|\| product.name}` |
| H37 | Banner images: `alt={containerName}` |
| ARIA11 | `component="section" aria-labelledby={sectionTitleId}` |
| H42 | Section heading `variant="h3" component="h2"` with `id` |
| SCR20 | ProductCard `role="button" tabIndex={0}` with Enter/Space |
| G182 | Sold out: red "Sold Out" text + grayscale filter (dual cue) |
| G1 | Container anchor links: `aria-label={`Jump to ${containerName}`}` |
| G178 | `&:focus-visible` outline on ProductCard |
| G14 | Discount price uses sr-only "Sale:" prefix before green color value |

No significant gaps.

### Directory.jsx

**File:** `src/components/commerce/Directory.jsx`
**Level:** AA

| Technique | Implementation |
|-----------|----------------|
| H37 | Category images: `alt={category.name}` |
| H42 | Category headings: `variant="h2"` |
| H49 | `component="main"` on root Box |
| SCR20 | CategoryCard `role="button" tabIndex={0}` with Enter/Space |
| ARIA18 | Loading state: `role="status" aria-busy="true"` |
| G178 | `&:focus-visible` outline on CategoryCard and jump-to buttons |

No significant gaps.

### ProductRecommendations.jsx

**File:** `src/components/commerce/ProductRecommendations.jsx`
**Level:** AA

| Technique | Implementation |
|-----------|----------------|
| H37 | `alt={product.name}` on images |
| ARIA11 | `component="section" aria-labelledby` with dynamic id |
| H42 | Heading with dynamic `id` to avoid duplicates |
| SCR20 | `role="button" tabIndex={0}` with Enter/Space |
| ARIA14 | `aria-label={`${product.name}, ${product.price}`}` |
| G178 | `&:focus-visible` outline on recommendation cards |

No significant gaps.

### BlindBoxProgressIndicator.jsx

**File:** `src/components/commerce/BlindBoxProgressIndicator.jsx`
**Level:** AA

| Technique | Implementation |
|-----------|----------------|
| ARIA14 | `aria-label={`Blind box progress: ${current} of ${required} added`}` |
| ARIA7 | CheckIcon: `aria-hidden="true"` |
| ARIA13 | `role="group"` on container |
| G183 | Completed steps: green bg + checkmark icon (dual cue) |
| SCR20 | Clickable steps: `role="button" tabIndex={0}` with Enter/Space |
| G178 | `&:focus-visible` outline on clickable steps |

No significant gaps.

### NotificationBanner.jsx

**File:** `src/components/commerce/NotificationBanner.jsx`
**Level:** AA

| Technique | Implementation |
|-----------|----------------|
| ARIA22 | `role="alert"` on banner (implicit `aria-live="assertive"`) |
| G18 | White text on `#1a1a2e` dark background (~13:1 contrast) |
| H91 | MUI `IconButton` with `aria-label="Dismiss notification"` |
| ARIA16 | `aria-labelledby={`notification-dialog-title-${n.notificationId}`}` on Dialog |
| ARIA19 | MUI `Alert severity="info"` on Snackbar |

No significant gaps.

### CartSummaryBanner.jsx

**File:** `src/components/commerce/CartSummaryBanner.jsx`
**Level:** AA

| Technique | Implementation |
|-----------|----------------|
| H37 | `alt={latestItem.name}` on product image |
| ARIA22 | `role="status"` on banner |
| ARIA19 | `aria-live="polite"` on container |
| G18 | "Review Cart" button: black bg / white text (21:1) |
| H91 | `IconButton` with `aria-label="Dismiss cart notification"` |

No significant gaps.

### StoreLocatorPrompt.jsx

**File:** `src/components/commerce/StoreLocatorPrompt.jsx`
**Level:** AA

| Technique | Implementation |
|-----------|----------------|
| H37 | `alt={productName}` on product image |
| H42 | Heading: `variant="h6" component="h2"` with `id="store-locator-title"` |
| ARIA16 | `aria-labelledby="store-locator-title"` on Dialog |
| G18 | "Select" button: black bg / white text (21:1) |
| H91 | `IconButton` with `aria-label="Close store selector"` |
| ARIA18 | MUI Dialog: built-in focus trapping, Escape key |

No significant gaps.

### DiscountZonePlaceholder.jsx

**File:** `src/components/commerce/DiscountZonePlaceholder.jsx`
**Level:** AA

| Technique | Implementation |
|-----------|----------------|
| H37 | Gift images: `alt={gift.title \|\| 'Free gift item'}` |
| ARIA22 | Progress: `role="status" aria-live="polite"` |
| G183 | Discount banners use color + icons (dual cue) |
| SCR20 | `role="button" tabIndex={0}` with Enter/Space on triggers |
| G178 | `&:focus-visible` outlines on all trigger variants |
| ARIA14 | `aria-label="View discount details"` on triggers |

| ARIA16 | DiscountModal Dialog: `id` on title + `aria-labelledby` on Dialog |

No significant gaps.

### LoadingSpinner.jsx

**File:** `src/components/commerce/LoadingSpinner.jsx`
**Level:** AAA

| Technique | Implementation |
|-----------|----------------|
| ARIA22 | `role="status"` on container |
| ARIA19 | `aria-live="polite"` |
| ARIA14 | `aria-label={label}` (default "Loading") on CircularProgress |
| G19 | Smooth continuous rotation, no flashing |

No gaps. Fully accessible.
