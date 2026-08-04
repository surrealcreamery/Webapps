# Subscription Flow Components -- WCAG 2.1 Audit

**Scope:** Step components used in the `/subscriptions` flow
**Overall Compliance:** AA

---

## OtpInput

**File:** `src/components/subscription/otpInput.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| H44 | Each `TextField` has `aria-label="Digit ${i + 1} of 6"` |

### 1.3 Adaptable

| Technique | Implementation |
|-----------|----------------|
| ARIA1 | `role="group"` on wrapping Box |
| ARIA16 | `aria-label="6-digit verification code"` on group |
| H65 | Each input has unique positional label |
| H36 | `inputMode: 'numeric'` for mobile keyboard |
| G57 | Sequential DOM order via `.map()` |

### 2. Operable

| Technique | Implementation |
|-----------|----------------|
| G202 | All inputs natively keyboard-focusable |
| SCR26 | Auto-focus advances to next field on digit entry |

### 3. Understandable

| Technique | Implementation |
|-----------|----------------|
| G83 | Group label "6-digit verification code" implies all required |

### 5. Conformance

**Level AA.** `autocomplete="one-time-code"` and `aria-required="true"` now implemented on inputs. No remaining gaps.

---

## QuantityInput

**File:** `src/components/subscription/quantityInput.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| ARIA16 | Decrement: `aria-label="Decrease quantity"` |
| ARIA16 | Increment: `aria-label="Increase quantity"` |
| ARIA16 | Input: `aria-label="Quantity"` |

### 1.3 Adaptable

| Technique | Implementation |
|-----------|----------------|
| ARIA1 | `role="group" aria-label="Quantity selector"` |
| ARIA1 | `role="spinbutton"` on input |
| ARIA5 | `aria-valuenow={value}`, `aria-valuemin={1}` |
| ARIA17 | `aria-live="polite"` around quantity display |

### 2. Operable

| Technique | Implementation |
|-----------|----------------|
| G202 | `IconButton` components keyboard-focusable |

| G202 | Arrow key support (Up/Down) implemented for `role="spinbutton"` |
| ARIA5 | `aria-valuemax` specified |
| G145 | Border changed from `#ccc` to `#767676` (meets 3:1 non-text contrast) |

No significant gaps.

### 5. Conformance

**Level AA.** Arrow key support, `aria-valuemax`, and border contrast all implemented. No remaining gaps.

---

## StepPlanSelection

**File:** `src/components/subscription/stepPlanSelection.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| H42 | Heading: `variant="h5" component="h2"` "Choose Your Plan" |
| ARIA4 | `aria-pressed` on plan cards for selection state |
| ARIA7 | Icons: `aria-hidden="true"` on decorative icons |

### 2. Operable

| Technique | Implementation |
|-----------|----------------|
| H91 | MUI `Button` for plan selection and Continue |

### 3. Understandable

Clear plan names, prices, and descriptions displayed.

### 5. Conformance

**Level AA.**

---

## StepContactInfo

**File:** `src/components/subscription/stepContactInfo.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| H42 | Heading fix: proper semantic heading level |
| H44 | `TextField` with `label` props on all fields |

### 3. Understandable

| Technique | Implementation |
|-----------|----------------|
| G83 | `helperText` association on fields |
| ARIA5 | `aria-busy` on button loading state |

### 5. Conformance

**Level AA.**

---

## StepPayment

**File:** `src/components/subscription/stepPayment.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| ARIA14 | `CircularProgress` with `aria-label` on loading spinners |
| H44 | `Radio` components with labels |

### 2. Operable

| Technique | Implementation |
|-----------|----------------|
| H91 | Native MUI `Radio`, `Button` elements |
| ARIA5 | `aria-busy` on button loading state |

### 5. Conformance

**Level AA.**

---

## StepPlanSummary

**File:** `src/components/subscription/stepPlanSummary.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| ARIA1 | Loading state with `role="status"` |

### 3. Understandable

| Technique | Implementation |
|-----------|----------------|
| H44 | QuantityInput label association |

### 5. Conformance

**Level AA.**

---

## StepModelLocationSelection

**File:** `src/components/subscription/stepModelLocationSelection.jsx`
**Level:** AA

### 1. Perceivable

| Technique | Implementation |
|-----------|----------------|
| H42 | Heading fix: proper heading level |
| ARIA4 | `aria-pressed` on selection cards |

### 1.4 Distinguishable

| Technique | Implementation |
|-----------|----------------|
| G145 | Contrast fix on text elements |

### 2. Operable

| Technique | Implementation |
|-----------|----------------|
| H91 | Disabled non-functional buttons |

### 5. Conformance

**Level AA.**

---

## Cross-Component Summary

### Techniques Implemented Across All Step Components

| Technique | Description |
|-----------|-------------|
| H42 | Heading hierarchy with proper semantic levels |
| H91 | Native MUI form elements (Button, TextField, Radio) |
| ARIA5 | `aria-busy` / `aria-pressed` state communication |
| G83 | Error messages and helper text on form fields |
| ARIA1 | Loading states with `role="status"` |

### Common Gaps

No remaining gaps. All previously identified issues have been resolved.
