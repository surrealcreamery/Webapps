# Events Page -- WCAG 2.1 Audit

**Route:** `/events`, `/events/login`
**File:** `src/pages/Events.jsx`
**Overall Compliance:** AA

---

## 1. Perceivable

### 1.1 Text Alternatives (SC 1.1.1)

| Technique | Implementation |
|-----------|----------------|
| H37 | Event image: `alt={currentEvent.title}` |

### 1.2 Time-based Media

Not applicable.

### 1.3 Adaptable (SC 1.3.1)

| Technique | Implementation |
|-----------|----------------|
| H42 | Visually-hidden `<h1>`: "Fundraiser Events" (sr-only pattern) |
| H42 | Section headings as `component="h2"`: "Select a Location", event title |
| G140 | `Container maxWidth="sm"` for responsive reflow |

No significant gaps.

### 1.4 Distinguishable

No hardcoded contrast issues; relies on MUI theme defaults.

---

## 2. Operable

### 2.1 Keyboard Accessible (SC 2.1.1)

| Technique | Implementation |
|-----------|----------------|
| H91 | All navigation uses MUI `<Button>` components |

### 2.2 Enough Time

Not applicable.

### 2.3 Seizures

Not applicable.

### 2.4 Navigable (SC 2.4.1, 2.4.2)

| Technique | Implementation |
|-----------|----------------|
| H42 | Visually-hidden `<h1>` |
| ARIA1 | Loading states: `role="status" aria-live="polite" aria-busy="true"` |
| ARIA19 | Error: MUI `<Alert>` with `role="alert"` |
| SCR26 | `useEffect` scrolls to top on state changes |

| G1 | `<Helmet>` sets page `<title>` |

No significant gaps.

### 2.5 Input Modalities

Standard MUI buttons; touch targets depend on MUI defaults.

---

## 3. Understandable

### 3.1 Readable

Plain language; `date-fns` for human-readable dates.

### 3.2 Predictable (SC 3.2.1)

| Technique | Implementation |
|-----------|----------------|
| G61 | State machine drives predictable navigation flow |

### 3.3 Input Assistance (SC 3.3.1)

| Technique | Implementation |
|-----------|----------------|
| G83 | `formErrors` passed to `ContactFormSection` for inline errors |
| ARIA19 | Error/success alerts with `role="alert"` |

---

## 4. Robust

### 4.1 Compatible (SC 4.1.1, 4.1.2)

| Technique | Implementation |
|-----------|----------------|
| H88 | Valid HTML via JSX/MUI |
| ARIA5 | `role="status"`, `aria-live`, `aria-busy` on loading |
| ARIA19 | `role="alert"` on error/success |

---

## 5. Conformance

**Overall Level: Level AA. No remaining gaps.**

No additional notes.
