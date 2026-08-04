# Redeem Page -- WCAG 2.1 Audit

**Route:** `/redeem`, `/subscriptions/redeem`
**File:** `src/pages/Redeem.jsx`
**Overall Compliance:** AA

---

## 1. Perceivable

### 1.1 Text Alternatives (SC 1.1.1)

| Technique | Implementation |
|-----------|----------------|
| ARIA6 | Redemption code digits: `aria-label={`Redemption code: ${codeDigits.join('')}`}` with `aria-hidden="true"` on individual digits |

### 1.2 Time-based Media

Not applicable.

### 1.3 Adaptable (SC 1.3.1, 1.3.2)

| Technique | Implementation |
|-----------|----------------|
| H42 | Dynamic `<h1>` via `pageTitle()` function and `renderHeader()` |
| H42 | Section headings: `variant="h2"` |
| H42 | Sub-headings: `variant="h3"`, `variant="h4"` |
| H71 | `<fieldset>` and `<legend>` for payment card radio groups and account selection |
| G140 | `maxWidth: 'sm'` with flex column layout |

### 1.4 Distinguishable (SC 1.4.1, 1.4.3)

| Technique | Implementation |
|-----------|----------------|
| G17 | Black card with white text (21:1) |
| G18 | Status text uses both color AND text labels ("Ready to Redeem" / "Redeemed this period") |

| G179 | `modalStyle` uses `width: '90vw', maxWidth: 400` for responsive reflow |

No significant gaps.

---

## 2. Operable

### 2.1 Keyboard Accessible (SC 2.1.1)

| Technique | Implementation |
|-----------|----------------|
| H91 | All MUI `<Button>`, `<Radio>`, `<TextField>`, `<Link component="button">` are keyboard-accessible |
| G202 | MUI `<Modal>` provides focus trapping and Escape key |

### 2.2 Enough Time (SC 2.2.1)

| G4 | Auto-redirect replaced with manual "Continue" button after cancellation |

No significant gaps.

### 2.3 Seizures

Not applicable.

### 2.4 Navigable (SC 2.4.1, 2.4.2)

| Technique | Implementation |
|-----------|----------------|
| H42 | Dynamic `<h1>` on all views |
| H65 | Breadcrumb navigation via MUI `<Breadcrumbs>` |
| ARIA1 | Loading: `role="status" aria-live="polite" aria-busy="true"` |
| ARIA19 | Error/success alerts: `role="alert"` |
| ARIA12 | Cancel modal: `aria-labelledby="cancel-modal-title"` |
| H49 | `component="main"` on root |

| G1 | `<Helmet>` sets page `<title>` |

No significant gaps.

### 2.5 Input Modalities

Standard form controls and buttons.

---

## 3. Understandable

### 3.1 Readable

Plain language; human-readable dates via formatting helpers.

### 3.2 Predictable (SC 3.2.1)

| Technique | Implementation |
|-----------|----------------|
| G61 | Step-based flow: enterContact > enterOtp > selectAccount > completeProfile > success |

### 3.3 Input Assistance (SC 3.3.1, 3.3.2)

| Technique | Implementation |
|-----------|----------------|
| G83 | Inline error messages near form fields |
| H44 | `TextField` components with `label` prop |
| G84 | Clear validation: "Please enter a valid email or phone number", "All fields are required" |
| H90 | `type="email"` and `type="tel"` on inputs |
| G85 | `helperText` on email/phone fields |

---

## 4. Robust

### 4.1 Compatible (SC 4.1.1, 4.1.2)

| Technique | Implementation |
|-----------|----------------|
| H88 | Valid HTML via JSX/MUI |
| ARIA12 | `aria-labelledby` on modal |
| ARIA6 | `aria-label` on redemption code containers |

---

## 5. Conformance

**Overall Level: Level AA. No remaining gaps.**
