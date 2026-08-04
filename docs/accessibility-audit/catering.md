# Catering Page -- WCAG 2.1 Audit

**Route:** `/catering`
**File:** `src/pages/Catering.jsx`
**Overall Compliance:** AA

---

## 1. Perceivable

### 1.1 Text Alternatives (SC 1.1.1)

| Technique | Implementation |
|-----------|----------------|
| H25 | `<Helmet>` sets `<title>` to "Catering \| Surreal Creamery" |
| H25 | `<meta name="description">` set |

No images directly rendered; delegated to child components.

### 1.2 Time-based Media

Not applicable.

### 1.3 Adaptable (SC 1.3.1)

| Technique | Implementation |
|-----------|----------------|
| H42 | Visually-hidden `<h1>`: "Catering Menu" (sr-only pattern) |
| G140 | `<Container maxWidth="sm">` for responsive reflow |

### 1.4 Distinguishable

Styling managed by child components; no direct contrast issues.

---

## 2. Operable

### 2.1 Keyboard Accessible (SC 2.1.1)

Orchestrator component; all interactive elements in child components. No keyboard traps introduced.

### 2.2 Enough Time

Not applicable.

### 2.3 Seizures

Not applicable.

### 2.4 Navigable (SC 2.4.1, 2.4.2)

| Technique | Implementation |
|-----------|----------------|
| G1 | Page title via Helmet |
| H42 | Visually-hidden `<h1>` |
| ARIA1 | Loading states: `role="status" aria-live="polite" aria-busy="true"` |
| ARIA19 | Error: `<Alert severity="error" role="alert">` |
| H49 | `<Container component="main">` renders `<main>` landmark |

### 2.5 Input Modalities

Managed by child components.

---

## 3. Understandable

### 3.1 Readable

Loading messages in plain English ("Checking account...", "Saving your order...", "Creating account...").

### 3.2 Predictable (SC 3.2.1)

| Technique | Implementation |
|-----------|----------------|
| G61 | State machine drives sequential catering flow |

### 3.3 Input Assistance

Error handling delegated to child components. Global error via `Alert`.

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

### Notes (Non-blocking)

| # | Note | WCAG SC | Level |
|---|------|---------|-------|
| 1 | Full accessibility depends on child components | -- |
| 2 | Skip navigation provided by site-wide SkipToContent component | 2.4.1 | A |
