# Account Page -- WCAG 2.1 Audit

**Route:** `/account`
**File:** `src/pages/AccountPage.jsx`
**Overall Compliance:** AA

---

## 1. Perceivable

### 1.1 Text Alternatives (SC 1.1.1)

| Technique | Implementation |
|-----------|----------------|
| H86 | Decorative icons `aria-hidden="true"`: EmailIcon, PhoneIcon |

| H86 | `LocalShippingIcon` and `StorefrontIcon`: `aria-hidden="true"` |

No significant gaps.

### 1.2 Time-based Media

Not applicable.

### 1.3 Adaptable (SC 1.3.1)

| Technique | Implementation |
|-----------|----------------|
| H42 | Login view: `<h1>My Account</h1>` |
| H42 | Orders view: `<h1>My Orders</h1>` |
| G140 | Content constrained to `maxWidth: 480` (login), `maxWidth: 600` (orders) |

| H40 | Order payment summary uses semantic `<dl>/<dt>/<dd>` structure |

No significant gaps.

### 1.4 Distinguishable (SC 1.4.1, 1.4.3)

| Technique | Implementation |
|-----------|----------------|
| G17 | Black buttons with white text (21:1) |
| G18 | Order status chips use MUI semantic color variants + text labels |

---

## 2. Operable

### 2.1 Keyboard Accessible (SC 2.1.1)

| Technique | Implementation |
|-----------|----------------|
| H91 | All `Button`, `TextField`, `Link component="button"` are keyboard-accessible |
| H91 | MUI `Accordion` is keyboard-accessible (Enter/Space) |
| SCR20 | `onKeyDown` Enter key submission on login fields |

### 2.2 Enough Time

Not applicable.

### 2.3 Seizures

Not applicable.

### 2.4 Navigable (SC 2.4.1, 2.4.2)

| Technique | Implementation |
|-----------|----------------|
| H42 | `<h1>` on both login and orders views |
| ARIA1 | Loading: `role="status" aria-live="polite" aria-busy="true"` |
| ARIA19 | Error: `role="alert"` |
| H49 | `component="main"` on root of both views |

| G1 | `<Helmet>` sets page `<title>` |
| SCR26 | `mainContentRef` focus management on login-to-orders transition |

No significant gaps.

### 2.5 Input Modalities (SC 2.5.3)

| Technique | Implementation |
|-----------|----------------|
| H90 | `inputMode: 'numeric'` and `maxLength: 6` on verification code input |
| G215 | Full-width buttons for large touch targets |

---

## 3. Understandable

### 3.1 Readable

Clear language: "Sign in with your email or phone to view your orders".

### 3.2 Predictable (SC 3.2.1)

| Technique | Implementation |
|-----------|----------------|
| G61 | Two-state flow: login > orders |

### 3.3 Input Assistance (SC 3.3.1, 3.3.2)

| Technique | Implementation |
|-----------|----------------|
| G83 | Error messages displayed inline |
| H44 | `TextField` with `label` prop |
| G84 | Input constraints: numeric filter, maxLength |

---

## 4. Robust

### 4.1 Compatible (SC 4.1.1, 4.1.2)

| Technique | Implementation |
|-----------|----------------|
| H88 | Valid HTML via JSX/MUI |
| ARIA5 | Correct ARIA on loading/error |

No significant gaps.

---

## 5. Conformance

**Overall Level: Level AA. No remaining gaps.**
