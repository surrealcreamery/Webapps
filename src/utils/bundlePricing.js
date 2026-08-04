// src/utils/bundlePricing.js
// Bundle pricing for the storefront — slot upcharges (flat $) + quantity add-ons (marginal % off
// per added unit). Prices are in DOLLARS (matching useCart / ProductModal; the catalog stores
// variant.price as dollars). Keep this formula in sync with the checkout Lambda (server authority).

export function productPriceDollars(p) {
  if (!p) return 0;
  const vs = p.variants || [];
  const def = vs.find(v => v.isDefault) || vs[0];
  const raw = def?.price ?? p.price ?? 0;
  const n = typeof raw === 'object' ? (raw.amount ?? 0) : raw;
  return parseFloat(String(n).replace(/[^0-9.]/g, '')) || 0;
}

// $ upcharge for a product picked in a slot. Resolution order:
//   1. extra item (not in a category) → its upcharge
//   2. first slot category the product belongs to → that category's config:
//        mode 'flat'  → categoryConfig.upcharge
//        mode 'items' → the item's listed upcharge (else $0)
//        else (free)  → $0
export function slotUpchargeForProduct(slot, product) {
  if (!product) return 0;
  const extra = (slot.extraItems || []).find(i => i.sku === product.sku);
  if (extra) return Number(extra.upcharge) || 0;
  const cfg = slot.categoryConfig || {};
  for (const catId of (slot.categoryIds || [])) {
    if ((product.categoryIds || []).includes(catId)) {
      const c = cfg[catId] || {};
      if (c.mode === 'flat') return Number(c.upcharge) || 0;
      if (c.mode === 'items') return Number((c.items || []).find(i => i.sku === product.sku)?.upcharge) || 0;
      return 0;
    }
  }
  return 0;
}

export function slotUpcharge(slot, selection) {
  return slotUpchargeForProduct(slot, selection?.product);
}

// Marginal cost of adding `addedQty` extra units at `unit` price, with tiered % off per unit.
// Unit i (0-based) uses tiers[min(i, last)].pct; extras beyond the last tier reuse the last tier.
export function addOnAddedCost(unit, tiers, addedQty) {
  let sum = 0;
  const last = (tiers?.length || 1) - 1;
  for (let i = 0; i < (addedQty || 0); i++) {
    const pct = Number(tiers?.[Math.min(i, last)]?.pct) || 0;
    sum += unit * (1 - pct / 100);
  }
  return Math.max(0, sum);
}

// Price of the NEXT added unit (for showing "add for $X").
export function addOnNextUnitPrice(unit, tiers, currentAddedQty) {
  const last = (tiers?.length || 1) - 1;
  const pct = Number(tiers?.[Math.min(currentAddedQty || 0, last)]?.pct) || 0;
  return Math.max(0, unit * (1 - pct / 100));
}

// Whole bundle total: base + Σ slot upcharges + Σ add-on marginal costs.
// addOnState: { [addOnId]: { unitPrice, addedQty } }
export function computeBundleTotal({ bundleProduct, slotSelections = {}, addOnState = {} }) {
  let total = productPriceDollars(bundleProduct);
  for (const slot of bundleProduct?.bundleSlots || []) {
    total += slotUpcharge(slot, slotSelections[slot.id]);
  }
  for (const a of bundleProduct?.bundleAddOns || []) {
    const st = addOnState[a.id];
    if (st?.addedQty > 0) total += addOnAddedCost(st.unitPrice, a.tiers, st.addedQty);
  }
  return Math.round(total * 100) / 100;
}
