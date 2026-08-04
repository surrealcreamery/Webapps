# Locations Page -- WCAG 2.1 Audit

**Route:** `/locations`
**File:** `src/pages/Locations.jsx`
**Overall Compliance:** AA

---

## 1. Perceivable

### 1.1 Text Alternatives (SC 1.1.1)

| Technique | Implementation |
|-----------|----------------|
| H67 | Decorative icons (DirectionsIcon, PhoneIcon, etc.) hidden via MUI `startIcon` default `aria-hidden="true"` |

No significant gaps.

### 1.2 Time-based Media

Not applicable.

### 1.3 Adaptable (SC 1.3.1)

| Technique | Implementation |
|-----------|----------------|
| H42 | `<Typography variant="h5" component="h1">Our Locations</Typography>` |
| G140 | Flexbox with responsive `flexDirection` based on `isMobile` |
| C9 | CSS-only hover states |

| H40 | Hours rendered as semantic `<dl>/<dt>/<dd>` structure |

No significant gaps.

### 1.4 Distinguishable (SC 1.4.1, 1.4.3)

| Technique | Implementation |
|-----------|----------------|
| G18 | Open/Closed chip uses color + text label ("Open Now" / "Closed") |
| G145 | Button text `color: '#333'` on white (~12.6:1) |
| G17 | Black buttons with white text (21:1) |

---

## 2. Operable

### 2.1 Keyboard Accessible (SC 2.1.1)

| Technique | Implementation |
|-----------|----------------|
| H91 | All interactions use MUI `<Button>` (native `<button>`) |
| H91 | Phone link uses `href={tel:}` (native `<a>`) |

No significant gaps.

### 2.2 Enough Time

Not applicable.

### 2.3 Seizures

Not applicable -- no animated content.

### 2.4 Navigable (SC 2.4.1, 2.4.2)

| Technique | Implementation |
|-----------|----------------|
| G1 | `<Helmet>` sets `<title>` to "Store Locations \| Surreal Creamery" |
| H42 | Single `<h1>` "Our Locations" |
| ARIA11 | Map container: `role="application" aria-label="Store locations map"` |
| ARIA1 | Loading: `role="status" aria-live="polite" aria-busy="true"` |

No significant gaps.

### 2.5 Input Modalities (SC 2.5.5)

No significant gaps.

---

## 3. Understandable

### 3.1 Readable

Clear, plain language throughout.

### 3.2 Predictable (SC 3.2.5)

No significant gaps.

### 3.3 Input Assistance

Not applicable -- no form inputs.

---

## 4. Robust

### 4.1 Compatible (SC 4.1.1, 4.1.2)

| Technique | Implementation |
|-----------|----------------|
| H88 | Valid HTML via MUI JSX |
| ARIA5 | `role="status"`, `aria-live`, `aria-busy` on loading |
| ARIA5 | `role="application"` on map |
| H44 | `aria-label="Loading"` on CircularProgress |

---

## 5. Conformance

**Overall Level: Level AA. No remaining gaps.**

### Notes (AAA-level, non-blocking)

| # | Note | WCAG SC | Level |
|---|------|---------|-------|
| 1 | "Get Directions" opens new window without advance notice | 3.2.5 | AAA |
| 2 | Some buttons may be smaller than 44x44px due to `size="small"` | 2.5.5 | AAA |
