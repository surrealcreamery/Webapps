# Subscriptions Page -- WCAG 2.1 Audit

**Route:** `/subscriptions`
**File:** `src/pages/Subscriptions.jsx`
**Overall Compliance:** AA

---

## 1. Perceivable

### 1.1 Text Alternatives (SC 1.1.1)

No images directly rendered; all visual content in child step components.

### 1.2 Time-based Media

Not applicable.

### 1.3 Adaptable (SC 1.3.1)

| Technique | Implementation |
|-----------|----------------|
| H42 | Visually-hidden `<h1>`: "Subscribe" (sr-only pattern) |
| G140 | Container `maxWidth: 'sm'` with flex layout |

### 1.4 Distinguishable

Styling delegated to child step components.

---

## 2. Operable

### 2.1 Keyboard Accessible (SC 2.1.1)

Orchestrator; interactive elements in child components. `ViewAllDrinksModal` relies on MUI Dialog focus trapping.

### 2.2 Enough Time (SC 2.2.1)

| Technique | Implementation |
|-----------|----------------|
| G198 | Error Snackbars persist (`autoHideDuration={null}`) with manual close button; success Snackbars use 20s duration |

No significant gaps.

### 2.3 Seizures

Not applicable.

### 2.4 Navigable (SC 2.4.1, 2.4.2)

| Technique | Implementation |
|-----------|----------------|
| H42 | Visually-hidden `<h1>` |
| ARIA1 | Loading: `role="status" aria-live="polite" aria-busy="true"` |
| ARIA19 | Error alerts with `role="alert"` |
| H49 | `component="main"` on root Box |

| G1 | `<Helmet>` sets page `<title>` |

No significant gaps.

### 2.5 Input Modalities

Managed by child step components.

---

## 3. Understandable

### 3.1 Readable

Clear language; step components handle user-facing text.

### 3.2 Predictable (SC 3.2.1)

| Technique | Implementation |
|-----------|----------------|
| G61 | State machine tags drive predictable flow |

### 3.3 Input Assistance (SC 3.3.1)

| Technique | Implementation |
|-----------|----------------|
| ARIA19 | Error via Snackbar Alert |

---

## 4. Robust

### 4.1 Compatible (SC 4.1.1)

| Technique | Implementation |
|-----------|----------------|
| H88 | Valid HTML via JSX/MUI |
| ARIA5 | Correct ARIA on loading/error states |

---

## 5. Conformance

**Overall Level: Level AA. No remaining gaps.**
