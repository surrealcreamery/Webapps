# Shared Components -- WCAG 2.1 Audit

**Scope:** Site-wide components used across all consumer pages
**Overall Compliance:** AA

---

## SkipToContent

**File:** `src/components/skip-to-content/skip-to-content.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| H49 | Native `<a>` element with `href="#skip-to-content"` |

### 2. Operable

| Technique | Implementation |
|-----------|----------------|
| G1 | "Skip to Content" anchor link at top of page |
| G123 | Anchor links to main content `#skip-to-content` |
| SCR35 | `handleSkipToContent` scrolls and moves focus to first focusable element |

### 3. Understandable

Clear link text: "Skip to Content".

### 4. Robust

Semantic `<a>` element with `href`. Compatible with all AT.

### 5. Conformance

**Level AA.** No gaps. Relies on external CSS for visible-on-focus behavior.

---

## CommerceHeader

**File:** `src/components/header/commerce/commerceHeader.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| H37 | Logo: `alt="Surreal Creamery Logo"` |
| H44 | Account button: `aria-label="Account"` |
| H44 | Cart button: `aria-label="View Cart"` |
| H44 | Location selector: `aria-label={`Change store location. Currently: ${name}`}` |
| ARIA5 | Down arrow icon: `aria-hidden="true"` |

### 2. Operable

| Technique | Implementation |
|-----------|----------------|
| SCR20 | Location selector: `role="button" tabIndex={0}` with Enter/Space `onKeyDown` |
| G178 | Location selector: `&:focus-visible { outline: '2px solid #1976d2', outlineOffset: 2 }` |
| H91 | All MUI `Button`/`IconButton` components keyboard-accessible |
| ARIA1 | `aria-haspopup="dialog"` on location selector |

### 3. Understandable

| Technique | Implementation |
|-----------|----------------|
| H49 | `<header>` element with `role="banner"` |
| ARIA1 | `aria-label="Site header"` |
| ARIA1 | `<nav>` with `role="navigation" aria-label="Main navigation"` |

### 4. Robust

| Technique | Implementation |
|-----------|----------------|
| ARIA14 | Landmark roles: `banner`, `navigation` |

### 5. Conformance

**Level AA.** Nav items now have `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space), `aria-label`, and `&:focus-visible` outline. No remaining gaps.

---

## CommerceFooter

**File:** `src/components/footer/commerce/commerceFooter.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| H44 | Instagram: `aria-label="Instagram"` |
| H44 | Facebook: `aria-label="Facebook"` |
| H44 | Close buttons: `aria-label="close"` |

### 2. Operable

| Technique | Implementation |
|-----------|----------------|
| SCR35 | MUI `Link component="button"` keyboard-accessible |
| SCR35 | MUI `IconButton` with `href` keyboard-accessible |
| ARIA18 | MUI fullScreen Dialogs trap focus and support Escape |

### 3. Understandable

| Technique | Implementation |
|-----------|----------------|
| H49 | `<footer>` element via `component="footer"` |
| H42 | Dialog titles: `component="h1"` |
| H42 | Dialog section headings: `component="h2"` |

### 4. Robust

| Technique | Implementation |
|-----------|----------------|
| ARIA14 | MUI Dialog provides `role="dialog"` |
| H88 | Semantic HTML: `<footer>`, `<h1>`, `<h2>`, `<ul>`, `<li>` |

### 5. Conformance

**Level AA.** Footer dialogs now have explicit `id` on title + `aria-labelledby` on Dialog. No remaining gaps.

---

## SubscriptionsFooter / CateringFooter / EventsFooter

**Files:** `src/components/footer/{subscriptions,catering,events}/*Footer.jsx`
**Level:** AA (each)

Same patterns as CommerceFooter. Identical techniques applied:

| Technique | Description |
|-----------|-------------|
| H49 | `<footer>` landmark |
| H42 | Dialog heading hierarchy: h1 title > h2 sections |
| H44 | `aria-label` on social icons and close buttons |
| SCR35 | Keyboard-accessible MUI Links and Buttons |
| ARIA18 | Dialog focus trapping |

**Subscriptions footer** additionally uses `<ol>` for numbered terms.

All footer dialogs now have explicit `id` on title + `aria-labelledby` on Dialog. No remaining gaps.

---

## CartDrawer

**File:** `src/components/commerce/CartDrawer.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| H37 | Product images: `alt={item.name}` |
| H37 | Reward images: `alt={rewardName}` |
| H44 | Close: `aria-label="Close cart"` |
| H44 | Quantity: `aria-label="Decrease quantity"` / `"Increase quantity"` |
| H44 | Remove: `aria-label={`Remove ${item.name} from cart`}` |
| H44 | Add cross-sell: `aria-label={`Add ${product.name} to cart`}` |

### 2. Operable

| Technique | Implementation |
|-----------|----------------|
| SCR35 | MUI Drawer focus trapping and Escape key |
| SCR35 | Reward options: `onKeyDown` Enter/Space |
| H91 | MUI `Button` for quantity, remove, add, checkout |

### 3. Understandable

| Technique | Implementation |
|-----------|----------------|
| ARIA1 | Drawer: `aria-label="Shopping cart"` |
| ARIA14 | Quantity: `role="group" aria-label="Quantity"` |
| ARIA1 | Progress bar: `role="progressbar" aria-valuenow/min/max` |
| ARIA1 | Delivery dialog: `aria-labelledby="delivery-address-dialog-title"` |
| G83 | Error messages in `Alert` components |

### 4. Robust

| Technique | Implementation |
|-----------|----------------|
| ARIA14 | Proper roles: `progressbar`, `group`, dialog `aria-labelledby` |

### 5. Conformance

**Level AA.** Minor gaps:
- Section header icons (StorefrontIcon, LocalShippingIcon) lack explicit `aria-hidden="true"`

---

## MenuDrawer

**File:** `src/components/commerce/MenuDrawer.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| H44 | Close: `aria-label="Close menu"` |
| ARIA1 | Drawer: `aria-label="Navigation menu"` |
| ARIA5 | Hidden test zone: `aria-hidden="true"` |

### 2. Operable

| Technique | Implementation |
|-----------|----------------|
| SCR35 | MUI `ListItemButton` keyboard-accessible |
| ARIA18 | Drawer focus trapping and Escape key |
| H48 | MUI `List`/`ListItem`/`ListItemButton` render `<ul>/<li>/<button>` |

### 3. Understandable

Menu items have clear primary and secondary text ("Desserts" / "Ice cream, milkshakes & more").

### 5. Conformance

**Level AA.** No significant gaps.

---

## ProductModal

**File:** `src/components/commerce/ProductModal.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| H37 | Product images: `alt={product.name}` or `alt={product.imageAlt}` |
| H44 | Close: `aria-label={`Close ${productName} details`}` |
| H44 | Quantity: `aria-label="Decrease/Increase quantity"` |
| H44 | Price: `aria-label={`Price: ${displayPrice}`}` |
| ARIA1 | Fulfillment icons: `'aria-hidden': true` |
| H48 | Quantity display: `aria-live="polite" role="status"` |

### 2. Operable

| Technique | Implementation |
|-----------|----------------|
| ARIA1 | Dialog: `aria-labelledby="product-modal-title" aria-describedby="product-modal-description"` |
| ARIA1 | Dialog Paper: `role="dialog" aria-modal="true"` |
| G202 | `closeButtonRef` receives focus on open |
| H91 | All buttons (variant, quantity, add-to-cart) use MUI `Button` |
| ARIA14 | `role="group" aria-labelledby` for variant, quantity, sizes, ingredients sections |

### 3. Understandable

| Technique | Implementation |
|-----------|----------------|
| G83 | Inline error via `Alert role="alert"` |
| ARIA5 | `aria-busy` on add-to-cart during loading |

### 5. Conformance

**Level AA.** Variant selector buttons now include `aria-pressed={isSelected}`. No remaining gaps.

---

## LocationModal

**File:** `src/components/commerce/LocationModal.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| H44 | Close: `aria-label="Close location selector"` |
| H44 | Phone: `aria-label="Call store"` |
| H44 | Directions: `aria-label="Get directions"` |
| H86 | PhoneIcon, DirectionsIcon: `aria-hidden="true"` |
| ARIA1 | Dialog: `aria-labelledby="location-modal-title"` |

### 5. Conformance

**Level AA.** Select buttons now include `aria-label={`Select ${location.name}`}` for context. No remaining gaps.

---

## ModifierSelector

**File:** `src/components/commerce/ModifierSelector.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| H37 | Modifier images: `alt={modifier.name}` |
| H44 | Modifier items: `aria-label` includes name, selected state, count, price |
| H44 | Remove button: `aria-label={`Remove one ${modifier.name}`}` |
| H44 | Loading: `aria-label="Loading"` |
| ARIA1 | Loading: `role="status" aria-live="polite"` |

### 2. Operable

| Technique | Implementation |
|-----------|----------------|
| SCR20 | Modifier items: `role="button" tabIndex={0}` with Enter/Space |
| SCR20 | Remove button: `role="button" tabIndex={0}` with Enter/Space |
| SCR20 | Step indicators: `tabIndex={0}` with `onKeyDown` |

### 3. Understandable

| Technique | Implementation |
|-----------|----------------|
| G83 | "Selection Required" inline error per category |
| ARIA14 | Progress: `role="group" aria-label="Customization progress"` |

### 5. Conformance

**Level AA.** Uses `role="button"` divs instead of native `<button>` (H91 preferred but functional).
