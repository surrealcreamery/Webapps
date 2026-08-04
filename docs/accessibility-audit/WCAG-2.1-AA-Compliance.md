# WCAG 2.1 Level AA Conformance Report

**Site:** Surreal Creamery Consumer Web Application
**URL:** https://www.surrealcreamery.com
**Audit Date:** May 4, 2026
**Remediation Completed:** May 4, 2026
**Standard:** WCAG 2.1 (Web Content Accessibility Guidelines)
**Target Level:** AA
**Overall Result:** **Full AA Conformance**

---

## Technology Stack

| Technology | Usage |
|------------|-------|
| HTML5 | Via React JSX compilation |
| WAI-ARIA 1.2 | Roles, states, and properties |
| CSS3 | MUI `sx` prop and SCSS modules |
| JavaScript / React 18 | Client-side rendering (SPA) |
| Material UI (MUI) v5 | Component library with built-in a11y |

---

## Technique Key

All technique identifiers reference the [W3C WCAG 2.1 Techniques](https://www.w3.org/WAI/WCAG21/Techniques/):

| Prefix | Source |
|--------|--------|
| **G** | General Techniques |
| **H** | HTML Techniques |
| **ARIA** | WAI-ARIA Techniques |
| **SCR** | Client-Side Scripting Techniques |
| **C** | CSS Techniques |
| **F** | Failure Techniques (avoided) |

---

# 1. Perceivable

Information and user interface components must be presentable to users in ways they can perceive.

---

## 1.1 Text Alternatives

### Success Criterion 1.1.1 Non-text Content (Level A)

**Status:** Met
**Applicability:** All product images, icons, decorative graphics, form controls

| Sufficient Technique | Implementation |
|----------------------|----------------|
| H37: Using `alt` on `img` | All `<img>` and `<CardMedia>` elements carry `alt` text — product images use `alt={product.name}`, thumbnails use `alt={`Product image ${idx + 1}`}`, banner images use `alt={containerName}` |
| H67: Empty `alt` for decorative images | MUI icons used decoratively carry `aria-hidden="true"` (e.g., `LocalShippingIcon`, `StorefrontIcon`, `AccessTimeIcon`, `DirectionsIcon`, `PhoneIcon`) |
| ARIA14: `aria-label` as invisible label | Product cards use `aria-label={`View product: ${item.title}`}`, redemption code containers use `aria-label={`Redemption code: ${digits}`}` |
| ARIA6: `aria-label` on objects | `CircularProgress` spinners have descriptive `aria-label` (e.g., "Adding to cart", "Submitting order", "Processing your order", "Loading payment form") |
| H86: `aria-hidden` on decorative content | Emoji fulfillment icons wrapped in `<span aria-hidden="true">`, decorative MUI icons marked `aria-hidden="true"` |

---

## 1.2 Time-based Media

### Success Criterion 1.2.1 Audio-only and Video-only (Prerecorded) (Level A)

**Status:** Not Applicable
**Rationale:** The site contains no pre-recorded audio-only or video-only content.

### Success Criterion 1.2.2 Captions (Prerecorded) (Level A)

**Status:** Not Applicable
**Rationale:** No pre-recorded audio content in synchronized media.

### Success Criterion 1.2.3 Audio Description or Media Alternative (Prerecorded) (Level A)

**Status:** Not Applicable
**Rationale:** No pre-recorded video content.

### Success Criterion 1.2.4 Captions (Live) (Level AA)

**Status:** Not Applicable
**Rationale:** No live audio content. The site is a retail e-commerce application with no live media streams, broadcasts, or conferencing features.

### Success Criterion 1.2.5 Audio Description (Prerecorded) (Level AA)

**Status:** Not Applicable
**Rationale:** No pre-recorded video content.

---

## 1.3 Adaptable

### Success Criterion 1.3.1 Info and Relationships (Level A)

**Status:** Met
**Applicability:** All pages — headings, lists, forms, tables, landmarks, groups

| Sufficient Technique | Implementation |
|----------------------|----------------|
| H42: Heading hierarchy | Every page has a single `<h1>` (e.g., "Checkout", "Our Locations", "My Account", "Menu Display"). Sections use `<h2>`/`<h3>` in logical hierarchy |
| H49: Semantic HTML landmarks | `<header>`, `<main>`, `<footer>`, `<nav>` used site-wide. Headers use `role="banner"`, navs use `role="navigation" aria-label="Main navigation"` |
| H44: `label` on form controls | All MUI `TextField` components have `label` prop, which renders as `<label>` associated to the input |
| H71: `fieldset`/`legend` for groups | Payment card selection and account selection groups on Redeem page |
| ARIA11: `aria-labelledby` on regions | Section components use `component="section" aria-labelledby={sectionTitleId}` |
| ARIA13: `role="group"` | Quantity selectors, customization progress, variant groups use `role="group"` with `aria-label` |
| H48: Semantic lists | Store hours converted to `<dl>/<dt>/<dd>` (Locations page). Payment summary on Account page uses `<dl>/<dt>/<dd>`. Footer terms use `<ol>/<li>`. Menu drawer uses `<ul>/<li>/<button>` |
| ARIA5: `aria-hidden` on decorative elements | Emoji icons in fulfillment methods wrapped in `<span aria-hidden="true">` |

### Success Criterion 1.3.2 Meaningful Sequence (Level A)

**Status:** Met
**Applicability:** All pages

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G57: Ordering content in meaningful sequence | DOM order matches visual reading order. CSS Grid and Flexbox layouts preserve logical reading order. Product grids, checkout steps, and form fields follow top-to-bottom, left-to-right DOM order |
| C27: DOM order matches visual order | No CSS reordering (`order` property) that would conflict with DOM sequence |

### Success Criterion 1.3.3 Sensory Characteristics (Level A)

**Status:** Met
**Applicability:** All instructions and references

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G96: Textual identification not relying on sensory characteristics | No instructions rely solely on shape, size, visual location, orientation, or sound. Buttons have text labels. Error messages describe the issue textually, not by position. Sold-out items use both grayscale filter AND "Sold Out" text |

### Success Criterion 1.3.4 Orientation (Level AA)

**Status:** Met
**Applicability:** All pages

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G214: Using CSS to restrict content to a particular display orientation | No orientation locks. All pages use responsive `flexDirection` and `useMediaQuery` breakpoints. Content reflows to both portrait and landscape. The Signage page uses `ResolutionScaler` for display fitting but does not lock orientation |

### Success Criterion 1.3.5 Identify Input Purpose (Level AA)

**Status:** Met
**Applicability:** Checkout, Account, Subscription, Delivery Check forms

| Sufficient Technique | Implementation |
|----------------------|----------------|
| H98: Using `autocomplete` to identify input purpose | Checkout: `autoComplete` on name, email, phone, address fields. OTP inputs: `autocomplete="one-time-code"` on first input. Address forms: street, city, state, zip fields with appropriate `autoComplete` values. Payment: delegated to Square/Evervault/Stripe SDK iframes which handle their own `autocomplete` |

---

## 1.4 Distinguishable

### Success Criterion 1.4.1 Use of Color (Level A)

**Status:** Met
**Applicability:** All color-conveyed information

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G14: Color not the only visual means | Sold out: grayscale + "Sold Out" text banner. Open/Closed status: color chip + text label. Delivery status: color + text + icon. Completed blind box steps: green bg + checkmark icon. Error states: red color + error icon + text message |
| G182: Additional visual cues | Sale/discount prices prefixed with sr-only "Sale:" text so screen readers convey meaning beyond green color alone |
| G183: Contrast ratio + additional cues | Discount zone banners use color + icons as dual cue |

### Success Criterion 1.4.2 Audio Control (Level A)

**Status:** Not Applicable
**Rationale:** No audio plays automatically on any page.

### Success Criterion 1.4.3 Contrast (Minimum) (Level AA)

**Status:** Met
**Applicability:** All text content

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G18: 4.5:1 contrast for normal text | Primary CTAs: black (#000) on white text = 21:1. Body text: dark on light backgrounds. All green success text uses `#2e7d32` (4.8:1 on white). Signage loading text `#a0a0a0` on `#111` background = ~7.5:1 |
| G145: 3:1 contrast for large text | Headings and large-scale text meet 3:1 minimum |
| G174: Dynamic contrast computation | `getAccessibleTextColorForGradient()` and `getTextColorForBackground()` compute accessible text colors dynamically against product background colors |

### Success Criterion 1.4.4 Resize Text (Level AA)

**Status:** Met
**Applicability:** All text content

| Sufficient Technique | Implementation |
|----------------------|----------------|
| C28: Using `em`/`rem` for font sizes | Font sizes use `rem` units throughout. MUI Typography variants render with relative units |
| G142: Zoom support | No `maximum-scale` or `user-scalable=no` on viewport meta. Content reflows at 200% zoom |

### Success Criterion 1.4.5 Images of Text (Level AA)

**Status:** Met
**Applicability:** All visual text presentation

| Sufficient Technique | Implementation |
|----------------------|----------------|
| C22: Using CSS for visual presentation of text | All text rendered as real text via MUI Typography components and CSS styling. No images of text. Product names, prices, descriptions are all DOM text. Logo uses `alt` text |

### Success Criterion 1.4.10 Reflow (Level AA)

**Status:** Met
**Applicability:** All pages at 320 CSS px width

| Sufficient Technique | Implementation |
|----------------------|----------------|
| C31: Using CSS Flexbox for reflow | Responsive layouts via `useMediaQuery` breakpoints. Flexbox with `flexDirection` switching between row/column. `maxWidth` constraints with `width: '100%'` |
| C32: Using media queries and responsive design | MUI `Container` with `maxWidth` prop. Mobile-first layouts. Redeem modal uses `width: '90vw', maxWidth: 400` for small-screen reflow |
| G140: Responsive layout | No horizontal scrolling at 320px viewport width. Content stacks vertically on narrow screens |

### Success Criterion 1.4.11 Non-text Contrast (Level AA)

**Status:** Met
**Applicability:** UI component boundaries, focus indicators, icons

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G195: 3:1 contrast for UI components | Focus outlines: `2px solid #1976d2` (blue) on white = ~5.1:1. Form field borders: `#767676` on white = 4.6:1 (meets 3:1). Button borders: clear visual boundaries. Quantity input border changed from `#ccc` to `#767676` |
| G207: 3:1 for graphical objects | Icons carrying meaning (checkmarks, status indicators) use high-contrast colors |

### Success Criterion 1.4.12 Text Spacing (Level AA)

**Status:** Met
**Applicability:** All text content

| Sufficient Technique | Implementation |
|----------------------|----------------|
| C36: Allowing user text spacing override | No fixed-height containers that clip text. MUI Typography uses normal line-height. Flexbox layouts accommodate text expansion. No `overflow: hidden` on text containers |

### Success Criterion 1.4.13 Content on Hover or Focus (Level AA)

**Status:** Met
**Applicability:** Tooltips, popovers, hover content

| Sufficient Technique | Implementation |
|----------------------|----------------|
| SCR39: Hover/focus content is dismissible, hoverable, persistent | MUI Tooltips (where used) support Escape to dismiss, pointer can move to tooltip content, and content persists until trigger loses focus. No custom hover-only popups |

---

# 2. Operable

User interface components and navigation must be operable.

---

## 2.1 Keyboard Accessible

### Success Criterion 2.1.1 Keyboard (Level A)

**Status:** Met
**Applicability:** All interactive elements

| Sufficient Technique | Implementation |
|----------------------|----------------|
| H91: Native HTML form elements | MUI `Button`, `IconButton`, `TextField`, `Radio`, `Checkbox`, `Link` all render native keyboard-accessible HTML elements |
| G202: Keyboard control for all functionality | All custom interactive elements (product cards, category cards, variant selectors, fulfillment methods, recommendation cards, progress steps) have `role="button"`, `tabIndex={0}`, and `onKeyDown` for Enter/Space |
| SCR20: Keyboard-operable custom controls | Header nav items (Shop, Events, Subscriptions) have `role="button"`, `tabIndex={0}`, `onKeyDown` Enter/Space handler, and `aria-label` |
| SCR35: Keyboard accessible actions | MUI Dialogs, Drawers, and Modals trap focus and support Escape to close |

### Success Criterion 2.1.2 No Keyboard Trap (Level A)

**Status:** Met
**Applicability:** All interactive contexts including modals/dialogs

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G21: Users can navigate away from all components | MUI Dialog, Drawer, and Modal components support Escape key to close. Tab order cycles within modals (focus trap) and returns to trigger on close. No keyboard traps in any flow |

### Success Criterion 2.1.4 Character Key Shortcuts (Level A)

**Status:** Not Applicable
**Rationale:** No single-character keyboard shortcuts are implemented anywhere in the application.

---

## 2.2 Enough Time

### Success Criterion 2.2.1 Timing Adjustable (Level A)

**Status:** Met
**Applicability:** Snackbar notifications, auto-redirect, OTP cooldown

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G198: Essential exception for security timers | OTP 60-second cooldown is a security rate limit (exempt under "essential" exception) |
| G180: Providing a way to adjust time | Error Snackbars on Subscriptions page: `autoHideDuration` set to `null` for error severity — errors persist until user dismisses. Non-error messages auto-dismiss after 20 seconds with visible close button |
| G4: Content can be paused | Redeem page: removed `setTimeout` auto-redirect after cancellation; replaced with manual "Continue" button giving user full control |

### Success Criterion 2.2.2 Pause, Stop, Hide (Level A)

**Status:** Met
**Applicability:** Signage auto-advancing slides

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G4: Providing a pause/play button | Signage page: fixed-position pause/play `IconButton` (bottom-right) toggles the `paused` state. When paused, auto-cycle interval is not created. Button uses dynamic `aria-label="Pause auto-scroll"` / `"Resume auto-scroll"` |
| G11: Content that blinks for less than 5 seconds | No blinking content anywhere on the site |

---

## 2.3 Seizures and Physical Reactions

### Success Criterion 2.3.1 Three Flashes or Below Threshold (Level A)

**Status:** Met
**Applicability:** All animations and transitions

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G19: No component flashes more than 3 times/second | Framer Motion animations use short durations (0.25–0.4s) with smooth opacity/transform transitions. Signage slide transitions use 0.5–0.6s smooth fades. CSS loading spinner is continuous rotation, not flashing. No rapid color changes anywhere |
| G176: Keeping flashing area small | No large-area flashing content |

---

## 2.4 Navigable

### Success Criterion 2.4.1 Bypass Blocks (Level A)

**Status:** Met
**Applicability:** All pages

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G1: Skip-to-content link | `SkipToContent` component renders `<a href="#skip-to-content">Skip to Content</a>` at top of every page, visible on focus. `handleSkipToContent` scrolls and focuses first focusable element in main content |
| G123: Adding a link to skip repeated blocks | Skip link targets `#skip-to-content` anchor on `<main>` content area |
| H69: Heading hierarchy | Logical heading hierarchy on every page allows heading-based navigation |
| ARIA11: Landmark regions | `<header>`, `<nav>`, `<main>`, `<footer>` landmarks on all pages enable landmark navigation |

### Success Criterion 2.4.2 Page Titled (Level A)

**Status:** Met
**Applicability:** All pages

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G88: Descriptive page titles | Every page has a `<Helmet>` setting a descriptive `<title>`: "Events | Surreal Creamery", "Subscribe | Surreal Creamery", "Delivery Check | Surreal Creamery", "My Account | Surreal Creamery", "Menu Display | Surreal Creamery", "Redeem | Surreal Creamery", "Catering | Surreal Creamery", "Store Locations | Surreal Creamery" |
| H25: `<title>` element | `react-helmet-async` `<Helmet>` manages document `<title>` |

### Success Criterion 2.4.3 Focus Order (Level A)

**Status:** Met
**Applicability:** All interactive sequences

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G59: Placing interactive elements in order | Tab order follows DOM/visual reading order. Checkout: Express > Contact > Address > Shipping > Billing > Payment. Forms follow top-to-bottom field order |
| H4: Logical tab order follows content | No positive `tabIndex` values that would disrupt natural tab order |
| SCR26: Focus management on state transitions | Checkout: after contact submit, focus moves to next section heading via `nextSectionRef.current?.focus()`. Account: after auth, focus moves to main content. Processing overlay: status message receives focus with `aria-live="assertive"` |

### Success Criterion 2.4.4 Link Purpose (In Context) (Level A)

**Status:** Met
**Applicability:** All links

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G91: Link text describes purpose | Navigation links: "Shop", "Events", "Subscriptions". Footer links: "Accessibility", "Terms", "Privacy". Location links: "Call", "Directions" with contextual `aria-label`. "Select" buttons on locations: `aria-label={`Select ${location.name}`}` |
| H30: `aria-label` for link purpose | Cart: `aria-label="View Cart"`. Location selector: `aria-label={`Change store location. Currently: ${name}`}` |

### Success Criterion 2.4.5 Multiple Ways (Level AA)

**Status:** Met
**Applicability:** Finding content within the site

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G125: Navigation links | Persistent header navigation on all pages (Shop, Events, Subscriptions). Menu drawer with full navigation list. Footer links |
| G126: List of links to all pages | Menu drawer provides links to all major sections |
| G185: Linking to all pages from home | Header nav bar links to all primary routes from every page |

### Success Criterion 2.4.6 Headings and Labels (Level AA)

**Status:** Met
**Applicability:** All headings and form labels

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G130: Descriptive headings | All headings describe their section content: "Choose Your Plan", "Select a Location", "Express Checkout", "Billing Address", "Check Delivery Availability" |
| G131: Descriptive labels | All form fields have descriptive `label` props: "Email or Phone", "First Name", "Street Address", "Promo Code". Buttons: "Place Order", "Continue", "Add to Cart" |

### Success Criterion 2.4.7 Focus Visible (Level AA)

**Status:** Met
**Applicability:** All interactive elements

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G195: Author-provided focus indicator | All custom interactive elements have `'&:focus-visible': { outline: '2px solid #1976d2', outlineOffset: '2px' }` — ProductCard, CategoryCard, jump-to buttons, recommendation cards, blind box steps, header nav items, variant selectors, thumbnail selectors, location selector |
| C15: User agent default focus for native elements | MUI `Button`, `IconButton`, `TextField`, `Link` components inherit browser default focus indicators plus MUI ripple/outline |
| G165: Default platform focus indicator | Native form controls (inputs, buttons, links) use browser focus rings where MUI doesn't override |

---

## 2.5 Input Modalities

### Success Criterion 2.5.1 Pointer Gestures (Level A)

**Status:** Met
**Applicability:** All touch/pointer interactions

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G215: Single-point activation for all functions | All interactions available via simple click/tap. Commerce page: touch-drag card expansion now has a visible expand/collapse `IconButton` alternative (keyboard arrow icon with dynamic `aria-label`). No multi-point or path-based gestures required |

### Success Criterion 2.5.2 Pointer Cancellation (Level A)

**Status:** Met
**Applicability:** All click/tap actions

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G210: Using `click`/`mouseup` events | All actions fire on `click` (mouse up) events, not `mousedown`/`pointerdown`. MUI Button uses native click event. Users can move pointer away before releasing to cancel |

### Success Criterion 2.5.3 Label in Name (Level A)

**Status:** Met
**Applicability:** All labeled interactive components

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G208: Accessible name includes visible text | Button text matches accessible name: "Add to Cart", "Place Order", "Continue", "Select". When `aria-label` is used, it includes the visible text (e.g., `aria-label={`Select ${location.name}`}` includes "Select") |

### Success Criterion 2.5.4 Motion Actuation (Level A)

**Status:** Not Applicable
**Rationale:** No device motion inputs (accelerometer, gyroscope, shake, tilt) are used. Framer Motion is CSS animation only, not device-motion-activated.

---

# 3. Understandable

Information and the operation of the user interface must be understandable.

---

## 3.1 Readable

### Success Criterion 3.1.1 Language of Page (Level A)

**Status:** Met
**Applicability:** All pages

| Sufficient Technique | Implementation |
|----------------------|----------------|
| H57: `lang` attribute on `html` | `<html lang="en">` set in `index.html`. All content is in English |

### Success Criterion 3.1.2 Language of Parts (Level AA)

**Status:** Not Applicable
**Rationale:** All content is in English. There are no passages in other languages. No `lang` attribute changes needed within pages.

---

## 3.2 Predictable

### Success Criterion 3.2.1 On Focus (Level A)

**Status:** Met
**Applicability:** All focusable elements

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G107: No context change on focus | No element triggers a context change (navigation, form submission, dialog) on focus alone. All context changes require explicit activation (click/Enter/Space) |

### Success Criterion 3.2.2 On Input (Level A)

**Status:** Met
**Applicability:** All form controls

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G80: Context change only after explicit submit | Form submissions require explicit button press ("Continue", "Place Order", "Submit"). No context changes on mere input (typing, selecting). OTP auto-advance moves focus to next field but does not change context |

### Success Criterion 3.2.3 Consistent Navigation (Level AA)

**Status:** Met
**Applicability:** Repeated navigation across pages

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G61: Repeated components in same relative order | Header navigation (logo, nav links, account, cart) appears in the same order on every page. Footer (accessibility, terms, privacy, social links) appears in the same order on every page. Skip-to-content link always first |

### Success Criterion 3.2.4 Consistent Identification (Level AA)

**Status:** Met
**Applicability:** Components with same function across pages

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G197: Consistent labels for same function | "Add to Cart" used consistently across Commerce, ProductModal, CartDrawer. "Select" for location selection across LocationModal and StoreLocatorPrompt. Cart icon and account icon consistent across headers. "Close" and close X buttons consistent across all dialogs |

---

## 3.3 Input Assistance

### Success Criterion 3.3.1 Error Identification (Level A)

**Status:** Met
**Applicability:** All forms — Checkout, Account, Subscriptions, Redeem, Events, Delivery Check

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G83: Providing validation errors in text | Checkout: per-field `error` and `helperText` on required fields (e.g., "First name is required", "Email is required", "Please enter a valid email address"). `aria-invalid` set on invalid fields |
| ARIA19: `role="alert"` for errors | MUI `Alert severity="error"` renders with `role="alert"` for immediate screen reader announcement. Used on all pages for global errors |
| ARIA21: Describing error with `aria-describedby` | MUI TextField `helperText` automatically creates `aria-describedby` association between input and error message |

### Success Criterion 3.3.2 Labels or Instructions (Level A)

**Status:** Met
**Applicability:** All form inputs

| Sufficient Technique | Implementation |
|----------------------|----------------|
| H44: `label` associated with form control | All MUI `TextField` components have `label` prop, rendered as visible `<label>` with `for` association |
| G83: Required fields identified | `required` prop on MUI TextField adds asterisk to label and `aria-required="true"` on input. OTP inputs have `aria-required="true"` |
| H90: Input type hints | `type="email"`, `type="tel"`, `inputMode="numeric"` on appropriate fields. `autocomplete="one-time-code"` on OTP input |

### Success Criterion 3.3.3 Error Suggestion (Level AA)

**Status:** Met
**Applicability:** All form validation

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G85: Providing text description of validation error | Checkout validation provides specific suggestions: "First name is required", "A valid email address is required". Delivery check: "Please fill in all address fields". Subscription: step-specific error messages |
| G177: Providing suggested correction | Email field error suggests format requirement. Address validation suggests completing all fields. Per-field `helperText` describes what is expected |

### Success Criterion 3.3.4 Error Prevention (Legal, Financial, Data) (Level AA)

**Status:** Met
**Applicability:** Checkout (financial transaction), Subscription management

| Sufficient Technique | Implementation |
|----------------------|----------------|
| G98: Review before submission | Checkout: contact/address review panel with "Edit" button before payment step. Order summary visible throughout. Subscription: plan summary step before payment |
| G155: Providing a checkbox for confirmation | Subscription cancellation: confirmation modal with explicit "Cancel Subscription" button (not auto-executed) |
| G199: Success confirmation | Order confirmation screen with receipt details, order ID, and "View Receipt" link |

---

# 4. Robust

Content must be robust enough that it can be interpreted by a wide variety of user agents, including assistive technologies.

---

## 4.1 Compatible

### Success Criterion 4.1.1 Parsing (Level A)

**Status:** Met
**Applicability:** All HTML output

| Sufficient Technique | Implementation |
|----------------------|----------------|
| H88: Using HTML according to spec | React JSX compilation produces valid HTML. No duplicate IDs (ProductRecommendations heading ID made dynamic with `recommendations-heading-${id}`). MUI components render spec-compliant HTML. No unclosed elements or malformed attributes |

*Note: SC 4.1.1 is always met in WCAG 2.2 and effectively met in modern HTML5 parsers, but documented here for WCAG 2.1 completeness.*

### Success Criterion 4.1.2 Name, Role, Value (Level A)

**Status:** Met
**Applicability:** All interactive components and widgets

| Sufficient Technique | Implementation |
|----------------------|----------------|
| ARIA14: Using `aria-label` for name | Product cards, location buttons, close buttons, cart buttons, quantity controls, fulfillment selectors — all have descriptive `aria-label` |
| ARIA16: Using `aria-labelledby` to name | All Dialogs have `aria-labelledby` pointing to DialogTitle IDs: footer dialogs (accessibility, terms, privacy), cancel modal, store locator, delivery address dialog, discount zone dialog, product modal, location modal, notification dialogs |
| ARIA4: `role` and state attributes | `role="dialog" aria-modal="true"` on overlays. `role="radiogroup"` / `role="radio"` / `aria-checked` on checkout selectors. `role="listbox"` / `role="option"` / `aria-selected` on address suggestions. `role="combobox"` / `aria-expanded` / `aria-controls` / `aria-autocomplete="list"` on address autocomplete fields. `role="spinbutton"` / `aria-valuenow` / `aria-valuemin` / `aria-valuemax` on quantity input. `aria-pressed` on variant selection buttons (ProductModal). `role="button"` on all custom interactive elements |
| ARIA5: `aria-disabled` and state | `aria-disabled` on unavailable fulfillment methods and sold-out variants. `aria-busy` on loading states. `aria-expanded` on collapsible sections |
| H91: Native HTML elements | MUI renders native `<button>`, `<input>`, `<a>`, `<select>` elements with inherent roles and keyboard behavior |

### Success Criterion 4.1.3 Status Messages (Level AA)

**Status:** Met
**Applicability:** All dynamic status updates

| Sufficient Technique | Implementation |
|----------------------|----------------|
| ARIA22: `role="status"` for status updates | Quantity counters: `aria-live="polite" role="status"`. Loading states: `role="status" aria-live="polite" aria-busy="true"` site-wide. Cart summary banner: `role="status"`. Slide changes on Signage: `aria-live="polite"` |
| ARIA19: `role="alert"` for errors | MUI `Alert` components with `role="alert"` for immediate announcement of errors and success messages. Notification banners: `role="alert"` |
| ARIA23: `aria-live="assertive"` for urgent updates | Processing overlay status: `aria-live="assertive" aria-atomic="true"` with programmatic focus. Cart drawer: `aria-live="assertive"` for cart change announcements |

---

# 5. Conformance

## Conformance Level

**WCAG 2.1 Level AA — Full Conformance**

All Level A and Level AA Success Criteria are met or not applicable across all consumer-facing pages of the Surreal Creamery web application.

## Conformance Scope

| Page | Route(s) | Level A | Level AA | Overall |
|------|----------|---------|----------|---------|
| Commerce (Shop) | `/`, `/desserts`, `/collectibles`, `/product/:id` | Met | Met | **AA** |
| Checkout | `/checkout` | Met | Met | **AA** |
| Locations | `/locations` | Met | Met | **AA** |
| Events | `/events` | Met | Met | **AA** |
| Catering | `/catering` | Met | Met | **AA** |
| Subscriptions | `/subscriptions` | Met | Met | **AA** |
| Redeem | `/redeem` | Met | Met | **AA** |
| Delivery Check | `/delivery-check` | Met | Met | **AA** |
| Account | `/account` | Met | Met | **AA** |
| Signage | `/signage/:configId` | Met | Met | **AA** |
| Shared Components | Site-wide | Met | Met | **AA** |
| Subscription Components | `/subscriptions/*` | Met | Met | **AA** |

## Pages Relying on Third-Party Content

The following integrations use third-party iframes and SDKs whose internal accessibility is managed by the respective vendor:

| Integration | Pages | Vendor |
|-------------|-------|--------|
| Google Maps JavaScript API | Locations | Google |
| Square Web Payments SDK | Checkout, Subscriptions | Square |
| Evervault Card Form | Checkout | Evervault |
| Stripe Elements | Checkout | Stripe |
| Apple Pay / Google Pay | Checkout | Apple / Google |

These third-party components are embedded as iframes and their internal accessibility is not within the scope of this conformance claim. However, all surrounding labels, instructions, error messages, and focus management are within scope and conform.

## Not-Applicable Success Criteria Summary

| SC | Name | Level | Reason |
|----|------|-------|--------|
| 1.2.1 | Audio-only and Video-only (Prerecorded) | A | No audio/video content |
| 1.2.2 | Captions (Prerecorded) | A | No synchronized media |
| 1.2.3 | Audio Description or Media Alternative (Prerecorded) | A | No video content |
| 1.2.4 | Captions (Live) | AA | No live audio content |
| 1.2.5 | Audio Description (Prerecorded) | AA | No video content |
| 1.4.2 | Audio Control | A | No auto-playing audio |
| 2.1.4 | Character Key Shortcuts | A | No single-character shortcuts |
| 2.5.4 | Motion Actuation | A | No device motion inputs |
| 3.1.2 | Language of Parts | AA | Single-language (English) site |

## Remediation History

| Date | Action |
|------|--------|
| May 4, 2026 | Initial audit completed — ~35 Level A and AA gaps identified |
| May 4, 2026 | Full remediation completed — all gaps resolved |

### Fixes Applied (May 4, 2026)

**Perceivable:**
- Added `aria-label` to all `CircularProgress` spinners in buttons (SC 1.1.1)
- Wrapped emoji fulfillment icons in `<span aria-hidden="true">` (SC 1.3.1)
- Added sr-only "Sale:" prefix on discount prices (SC 1.4.1)
- Changed `#4caf50` → `#2e7d32` for green text contrast (SC 1.4.3)
- Fixed Signage loading text contrast `#949494` → `#a0a0a0` (SC 1.4.3)
- Changed quantity input border `#ccc` → `#767676` (SC 1.4.11)
- Fixed Redeem modal width for reflow: `width: '90vw', maxWidth: 400` (SC 1.4.10)
- Converted store hours to `<dl>/<dt>/<dd>` on Locations (SC 1.3.1)
- Converted payment summary to `<dl>/<dt>/<dd>` on Account (SC 1.3.1)
- Added `aria-hidden="true"` on decorative order icons (SC 1.1.1)

**Operable:**
- Added keyboard support to header nav items (role, tabIndex, onKeyDown) (SC 2.1.1)
- Added `&:focus-visible` outlines to all custom interactive elements (SC 2.4.7)
- Added `<Helmet>` page titles to Events, Subscriptions, DeliveryCheck, Account, Signage, Redeem (SC 2.4.2)
- Added focus management on Checkout step transitions (SC 2.4.3)
- Added focus management on Account auth state change (SC 2.4.3)
- Added pause/play button to Signage auto-advancing slides (SC 2.2.2)
- Removed error Snackbar auto-dismiss on Subscriptions (SC 2.2.1)
- Replaced auto-redirect with manual button on Redeem (SC 2.2.1)
- Added expand/collapse button alternative for touch gesture (SC 2.5.1)
- Added ArrowUp/ArrowDown keyboard support to quantity spinbutton (SC 4.1.2)

**Understandable:**
- Added per-field validation with `error`, `helperText`, `aria-invalid` on Checkout (SC 3.3.1, 3.3.3)

**Robust:**
- Added `aria-labelledby` + `id` to all footer Dialogs (SC 4.1.2)
- Added `aria-labelledby` to DiscountZone dialog (SC 4.1.2)
- Added `aria-pressed` to ProductModal variant buttons (SC 4.1.2)
- Added descriptive `aria-label` to LocationModal select buttons (SC 4.1.2)
- Added combobox ARIA pattern to Checkout autocomplete fields (SC 4.1.2)
- Added `aria-selected` to `role="option"` elements (SC 4.1.2)
- Added `aria-live="polite" role="status"` to quantity counters (SC 4.1.3)
- Added `aria-label` to all CircularProgress spinners (SC 4.1.3)
- Added `aria-valuemax` to quantity spinbutton (SC 4.1.2)
- Added `autocomplete="one-time-code"` to OTP input (SC 1.3.5)
- Added `aria-required="true"` to OTP inputs (SC 3.3.2)
- Made ProductRecommendations heading ID dynamic (SC 4.1.1)

---

## Feedback

We welcome your feedback on the accessibility of Surreal Creamery. Please let us know if you encounter accessibility barriers:

- **Phone:** 917-539-9700
- **Email:** accessibility@surrealcreamery.com

We try to respond to feedback within 5 business days.

---

## References

- [WCAG 2.1 Specification](https://www.w3.org/TR/WCAG21/)
- [WCAG 2.1 Techniques](https://www.w3.org/WAI/WCAG21/Techniques/)
- [WAI-ARIA Authoring Practices 1.2](https://www.w3.org/TR/wai-aria-practices-1.2/)
- [MUI Accessibility Documentation](https://mui.com/material-ui/getting-started/accessibility/)

---

*See individual page reports in this directory for line-level technique documentation.*
