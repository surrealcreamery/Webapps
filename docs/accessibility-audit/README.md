# Surreal Creamery -- WCAG 2.1 Accessibility Audit

**Audit Date:** May 4, 2026
**Standard:** WCAG 2.1 (Web Content Accessibility Guidelines)
**Target Level:** AA

---

## Compliance Summary

| Page | Route(s) | Level A | Level AA | Level AAA | Overall |
|------|----------|---------|----------|-----------|---------|
| [Commerce (Shop)](#) | `/`, `/desserts`, `/collectibles`, `/product/:id` | Met | Met | -- | **AA** |
| [Checkout](#) | `/checkout` | Met | Met | -- | **AA** |
| [Locations](#) | `/locations` | Met | Met | -- | **AA** |
| [Events](#) | `/events` | Met | Met | -- | **AA** |
| [Catering](#) | `/catering` | Met | Met | -- | **AA** |
| [Subscriptions](#) | `/subscriptions` | Met | Met | -- | **AA** |
| [Redeem](#) | `/redeem` | Met | Met | -- | **AA** |
| [Delivery Check](#) | `/delivery-check` | Met | Met | -- | **AA** |
| [Account](#) | `/account` | Met | Met | -- | **AA** |
| [Signage](#) | `/signage/:configId` | Met | Met | -- | **AA** |
| [Shared Components](#) | Site-wide | Met | Met | -- | **AA** |
| [Subscription Components](#) | `/subscriptions/*` | Met | Met | -- | **AA** |

---

## Audit Scope

This audit evaluates every consumer-facing page and shared component of the Surreal Creamery web application against the full WCAG 2.1 specification. Each page is assessed across all five conformance areas:

1. **Perceivable** -- Information and UI must be presentable in ways users can perceive
2. **Operable** -- UI components and navigation must be operable
3. **Understandable** -- Information and UI operation must be understandable
4. **Robust** -- Content must be robust enough for assistive technologies
5. **Conformance** -- Overall level achieved and remaining gaps

### Technique Reference

All techniques use official W3C identifiers:
- **G** prefix: General techniques (e.g., G1, G18)
- **H** prefix: HTML techniques (e.g., H37, H44)
- **ARIA** prefix: WAI-ARIA techniques (e.g., ARIA1, ARIA5)
- **SCR** prefix: Client-side scripting techniques (e.g., SCR20, SCR35)
- **C** prefix: CSS techniques (e.g., C9, C22)

---

## Individual Page Reports

| Report | File |
|--------|------|
| Commerce (Shop) | [commerce.md](./commerce.md) |
| Checkout | [checkout.md](./checkout.md) |
| Locations | [locations.md](./locations.md) |
| Events | [events.md](./events.md) |
| Catering | [catering.md](./catering.md) |
| Subscriptions | [subscriptions.md](./subscriptions.md) |
| Redeem | [redeem.md](./redeem.md) |
| Delivery Check | [delivery-check.md](./delivery-check.md) |
| Account | [account.md](./account.md) |
| Signage | [signage.md](./signage.md) |
| Shared Components (Header, Footer, Cart, Menus, Modals) | [shared-components.md](./shared-components.md) |
| Subscription Flow Components | [subscription-components.md](./subscription-components.md) |

---

## Cross-Cutting Techniques (Implemented Site-Wide)

These techniques are consistently applied across all pages:

| Technique | Description | WCAG SC |
|-----------|-------------|---------|
| H42 | Heading hierarchy with `<h1>` on every page | 1.3.1, 2.4.6 |
| H49 | Semantic HTML: `<main>`, `<header>`, `<footer>`, `<nav>` landmarks | 1.3.1 |
| ARIA1 | `role="status"` + `aria-live="polite"` on all loading states | 4.1.3 |
| ARIA19 | `role="alert"` on all error/success Alert components | 4.1.3 |
| H88 | Valid HTML via React JSX / MUI component rendering | 4.1.1 |
| H91 | Native `<button>` elements via MUI Button/IconButton | 2.1.1 |
| G140 | Responsive layout via `maxWidth` / flexbox / media queries | 1.4.10 |
| G1 | Skip-to-content link at top of page | 2.4.1 |
| H37 | `alt` attributes on all `<img>` elements | 1.1.1 |
| SCR20 | `onKeyDown` handlers (Enter/Space) on custom interactive elements | 2.1.1 |
| G178 | `&:focus-visible` outlines on custom interactive elements | 2.4.7 |
| G18 | High-contrast CTA buttons (black bg / white text, 21:1 ratio) | 1.4.3 |

---

## Master Compliance Document

For a consolidated view of the full WCAG 2.1 AA compliance status, see [WCAG-2.1-AA-Compliance.md](./WCAG-2.1-AA-Compliance.md).

---

## Technology Stack

The Surreal Creamery web application relies on the following technologies:

- **HTML5** (via React JSX compilation)
- **WAI-ARIA 1.2** (roles, states, and properties)
- **CSS3** (via MUI `sx` prop and SCSS modules)
- **JavaScript / React 18** (client-side rendering)
- **Material UI (MUI) v5** (component library with built-in accessibility)

---

## Feedback

We welcome your feedback on the accessibility of Surreal Creamery. Please let us know if you encounter accessibility barriers:

- **Phone:** 917-539-9700
- **Email:** accessibility@surrealcreamery.com

We try to respond to feedback within 5 business days.
