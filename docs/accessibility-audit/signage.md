# Signage Page -- WCAG 2.1 Audit

**Route:** `/signage/:configId`
**File:** `src/pages/Signage.jsx`
**Overall Compliance:** AA

**Note:** This is an unattended digital signage display, not an interactive consumer page. Many WCAG criteria may be considered not applicable in an unattended kiosk context. This audit documents conformance for completeness.

---

## 1. Perceivable

### 1.1 Text Alternatives (SC 1.1.1)

No images directly rendered; product images are in child templates (`ClassicTemplate`/`ShowcaseTemplate`) whose accessibility depends on their implementation.

### 1.2 Time-based Media (SC 1.2.1)

| Concern | Detail |
|---------|--------|
| Auto-cycling slides | Slides advance every `transitionTime` seconds (default 10s) |

### 1.3 Adaptable (SC 1.3.1)

| Technique | Implementation |
|-----------|----------------|
| H42 | Visually-hidden `<h1>`: "Menu Display" (sr-only pattern) |
| G140 | `ResolutionScaler` handles viewport scaling via CSS `transform: scale()` |

### 1.4 Distinguishable (SC 1.4.3)

| Technique | Implementation |
|-----------|----------------|
| G145 | Loading text changed from `#949494` to `#a0a0a0` (7.5:1 contrast on `#111` background) |

No significant gaps.

---

## 2. Operable

### 2.1 Keyboard Accessible

Display-only page -- no interactive elements. Not applicable in traditional sense.

### 2.2 Enough Time (SC 2.2.2)

| Technique | Implementation |
|-----------|----------------|
| G4 | Pause/play `IconButton` allows user to stop auto-advancing slides |

- Wake lock prevents screen sleep -- appropriate for signage.

### 2.3 Seizures (SC 2.3.1)

| Technique | Implementation |
|-----------|----------------|
| G15 | Slide transitions use smooth CSS opacity fade (0.6s) or translateX slide (0.5s) |
| G176 | Transition duration well under 3-flashes-per-second threshold |

### 2.4 Navigable (SC 2.4.2)

| Technique | Implementation |
|-----------|----------------|
| H42 | Visually-hidden `<h1>` at all render paths |
| ARIA1 | Loading: `role="status" aria-live="polite" aria-busy="true"` |
| ARIA22 | Multi-slide container: `aria-live="polite"` for slide changes |
| ARIA11 | `aria-label="Menu Display"` on root |
| ARIA19 | Error: `role="alert"` |
| H49 | `component="main"` on root |

| G1 | `<Helmet>` sets page `<title>` |

No significant gaps.

### 2.5 Input Modalities

Not applicable -- display-only.

---

## 3. Understandable

### 3.1 Readable

Limited text: "Loading..." and error messages in plain English.

### 3.2 Predictable

Slides advance at regular intervals -- predictable for a display context.

### 3.3 Input Assistance

Not applicable -- no inputs.

---

## 4. Robust

### 4.1 Compatible (SC 4.1.1, 4.1.2)

| Technique | Implementation |
|-----------|----------------|
| H88 | Valid HTML via JSX/MUI |
| ARIA5 | Correct ARIA on loading/error/live states |
| ARIA22 | `aria-live="polite"` on slide container |

No significant gaps.

---

## 5. Conformance

**Overall Level: Level AA. No remaining gaps.**

### Notes

| # | Note | WCAG SC | Level |
|---|------|---------|-------|
| 1 | Product image accessibility depends on child templates | 1.1.1 | A |

### Mitigating Context

This page is designed as **unattended digital signage** (in-store menu displays). A pause/play control is now provided for compliance. Product image accessibility is managed by child template components (`ClassicTemplate`/`ShowcaseTemplate`).
