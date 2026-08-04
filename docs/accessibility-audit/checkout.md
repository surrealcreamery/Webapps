# Checkout Page -- WCAG 2.1 Audit

**Route:** `/checkout`
**File:** `src/pages/CheckoutPage.jsx`
**Overall Compliance:** AA

---

## 1. Perceivable

### 1.1 Text Alternatives (SC 1.1.1)

| Technique | Implementation |
|-----------|----------------|
| H37 | Cart item images: `alt={item.name}` |

| ARIA14 | `CircularProgress` spinners in buttons: `aria-label` on all loading spinners |

No significant gaps.

### 1.2 Time-based Media

Not applicable.

### 1.3 Adaptable (SC 1.3.1, 1.3.2)

| Technique | Implementation |
|-----------|----------------|
| H44 | MUI `TextField` with `label` prop on all form fields |
| G140 | Flexbox layout with responsive breakpoints via `useMediaQuery` |
| ARIA5 | `aria-expanded={mobileOrderExpanded}` on mobile summary toggle |
| H42 | Page title `component="h1"` ("Checkout") and section headings as `h2` |

No significant gaps.

### 1.4 Distinguishable (SC 1.4.1, 1.4.3)

| Technique | Implementation |
|-----------|----------------|
| G18 | Primary CTAs: `bgcolor: '#000'` with white text (21:1 ratio) |
| G14 | Delivery status uses color + text + icons (not color alone) |
| G179 | Flexbox with `flex: 1`, `minWidth: 0`, responsive breakpoints |

| G145 | Green text changed from `#4caf50` to `#2e7d32` (4.5:1+ contrast on white) |

No significant gaps.

---

## 2. Operable

### 2.1 Keyboard Accessible (SC 2.1.1)

| Technique | Implementation |
|-----------|----------------|
| G202 | All interactive elements use native `<button>`, `<input>`, or `tabIndex={0}` with `onKeyDown` |
| H91 | MUI `TextField`, `Button` render native HTML elements |
| SCR29 | Custom radio `Paper` elements: `tabIndex={0}` + `onKeyDown` Enter/Space |

| ARIA22 | Processing overlay: status message with `tabIndex={-1}`, `aria-live="assertive"` for focus management |

No significant gaps.

### 2.2 Enough Time (SC 2.2.1)

| Technique | Implementation |
|-----------|----------------|
| G198 | OTP 60-second cooldown is a security rate limit (exempt under "essential" exception) |

### 2.3 Seizures (SC 2.3.1)

| Technique | Implementation |
|-----------|----------------|
| G19 | CSS animations use 0.3-0.4s durations, opacity/transform only |

### 2.4 Navigable (SC 2.4.1, 2.4.2, 2.4.6)

| Technique | Implementation |
|-----------|----------------|
| H69 | Descriptive section headings: "Express Checkout", "Billing Address", "Payment", etc. |
| G130 | All headings are descriptive of their content |
| H4 | Logical tab order follows DOM flow: Express > Contact > Address > Shipping > Billing > Payment |

| H44 | Mobile order summary toggle: explicit `aria-label` |
| SCR26 | `nextSectionRef` focus management after contact form submission |

No significant gaps.

### 2.5 Input Modalities (SC 2.5.1)

| Technique | Implementation |
|-----------|----------------|
| G215 | No complex gestures; all interactions are simple clicks/taps |

---

## 3. Understandable

### 3.1 Readable (SC 3.1.1)

Clear, plain English throughout.

### 3.2 Predictable (SC 3.2.1, 3.2.3)

| Technique | Implementation |
|-----------|----------------|
| G61 | Consistent checkout flow: contact > address > shipping > billing > payment |
| H32 | "Continue" and "Place Order" are clearly labeled submit actions |
| G80 | Context changes only after explicit user action |

No significant gaps.

### 3.3 Input Assistance (SC 3.3.1, 3.3.2, 3.3.3)

| Technique | Implementation |
|-----------|----------------|
| G83 | `required` prop on TextFields (asterisk on label, `aria-required="true"`) |
| G85 | Specific validation messages: "First and last name are required", "A valid email address is required" |
| ARIA19 | MUI `Alert` components render with `role="alert"` |
| G84 | Error messages for out-of-range values |
| G199 | Order confirmation screen with receipt details |
| G98 | Contact/address review with Edit button before payment |

| ARIA21 | Per-field `error` prop + `helperText` association on invalid fields |
| ARIA21 | `aria-invalid="true"` set on invalid fields during validation |

No significant gaps.

---

## 4. Robust

### 4.1 Compatible (SC 4.1.1, 4.1.2)

| Technique | Implementation |
|-----------|----------------|
| ARIA2 | MUI `TextField required` adds `aria-required="true"` |
| ARIA4 | `role="dialog"` + `aria-modal="true"` + `aria-label` on processing overlay |
| ARIA4 | `role="radiogroup"` on address, shipping, payment selectors |
| ARIA4 | `role="radio"` + `aria-checked` on individual options |
| ARIA4 | `role="listbox"` + `role="option"` on address suggestion dropdowns |
| ARIA8 | `aria-label` on composite widgets: "Saved addresses", "Shipping rate", etc. |

| ARIA1 | Full combobox pattern: `role="combobox"`, `aria-controls`, `aria-autocomplete`, `aria-activedescendant` on TextField |
| ARIA4 | `role="option"` elements include `aria-selected` state |

No significant gaps.

---

## 5. Conformance

**Overall Level: Level AA. No remaining gaps.**

### Notes (Non-blocking)

| # | Note | WCAG SC | Level |
|---|------|---------|-------|
| 1 | "View Receipt" opens new window without notice | 3.2.5 | AAA |
