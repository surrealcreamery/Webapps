# Delivery Check Page -- WCAG 2.1 Audit

**Route:** `/delivery-check`
**File:** `src/pages/DeliveryCheckPage.jsx`
**Overall Compliance:** AA

---

## 1. Perceivable

### 1.1 Text Alternatives (SC 1.1.1)

| Technique | Implementation |
|-----------|----------------|
| H37 | Product image: `alt={productName}` |
| H86 | Decorative icons explicitly `aria-hidden="true"`: LocalShippingIcon, StoreIcon |

### 1.2 Time-based Media

Not applicable.

### 1.3 Adaptable (SC 1.3.1)

| Technique | Implementation |
|-----------|----------------|
| H42 | `<Typography variant="h6" component="h1">Check Delivery Availability</Typography>` |
| G140 | Content constrained to `maxWidth: 600` |
| H44 | All `TextField` components have `label` prop |
| ARIA16 | Address suggestions: `role="listbox" aria-label="Address suggestions"` |
| ARIA16 | Suggestion items: `role="option"` |

### 1.4 Distinguishable (SC 1.4.1, 1.4.3)

| Technique | Implementation |
|-----------|----------------|
| G17 | Black buttons with white text (21:1) |
| G18 | Delivery status: color + text labels ("Delivery Available" / "Out of Delivery Range") + icons |
| G145 | Focus: `outline: '2px solid'` with `outlineColor: 'primary.main'` on suggestions |

---

## 2. Operable

### 2.1 Keyboard Accessible (SC 2.1.1)

| Technique | Implementation |
|-----------|----------------|
| H91 | All `Button` and `IconButton` components natively keyboard-accessible |
| SCR35 | Address suggestions: `tabIndex={0}` with `onKeyDown` Enter/Space |
| H91 | Back button: `IconButton` with `aria-label="Go back"` |

No significant gaps.

### 2.2 Enough Time

Not applicable.

### 2.3 Seizures

Not applicable.

### 2.4 Navigable (SC 2.4.1, 2.4.2)

| Technique | Implementation |
|-----------|----------------|
| H42 | `<h1>` heading |
| ARIA1 | Loading: `role="status" aria-live="polite" aria-busy="true"` |
| ARIA19 | Error: `role="alert"` |
| ARIA22 | Delivery result: `aria-live="polite"` |
| H49 | `component="main"` on root |

| G1 | `<Helmet>` sets page `<title>` |

No significant gaps.

### 2.5 Input Modalities (SC 2.5.3)

| Technique | Implementation |
|-----------|----------------|
| G215 | Full-width buttons for large touch targets |

---

## 3. Understandable

### 3.1 Readable

Clear, plain language: "Enter your address to see if you're in our local delivery zone".

### 3.2 Predictable (SC 3.2.1)

| Technique | Implementation |
|-----------|----------------|
| G61 | Linear flow: enter address > validate > results > add to cart or switch to pickup |

### 3.3 Input Assistance (SC 3.3.1, 3.3.2)

| Technique | Implementation |
|-----------|----------------|
| G83 | Error via `<Alert role="alert">` near input |
| H44 | All inputs have `label` props |
| G84 | Clear messages: "Please fill in all address fields", "Failed to validate address" |
| ARIA2 | `required` on manual entry fields |

---

## 4. Robust

### 4.1 Compatible (SC 4.1.1, 4.1.2)

| Technique | Implementation |
|-----------|----------------|
| H88 | Valid HTML via JSX/MUI |
| ARIA5 | `role="listbox"`, `role="option"`, `role="status"`, `role="alert"`, `aria-live`, `aria-busy`, `aria-hidden` |

---

## 5. Conformance

**Overall Level: Level AA. No remaining gaps.**

### Notes (Non-blocking)

| # | Note | WCAG SC | Level |
|---|------|---------|-------|
| 1 | `autoFocus` may disorient screen reader users | 2.4.3 | AAA |
