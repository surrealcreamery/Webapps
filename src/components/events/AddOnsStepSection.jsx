// src/components/events/AddOnsStepSection.jsx
// Optional registration upsell add-ons, shown on the payment screen. Each event's
// `registrationUpsellBundles` (embedded in the events feed) is an add-on bundle: a toggle to include
// it, plus a picker per slot so the customer configures it (e.g. choose a Drink, choose a dessert).
// Slot options are resolved from the published catalog.json (products in the slot's categories, plus
// any explicit extraItems). Pricing here is a PREVIEW only — the server re-derives every price from
// the catalog (lambda-events-api/bundlePricing.mjs). Supports free / flat / items slot modes; a slot
// with categories but no catalog match falls back to a "chosen at pickup" placeholder.
import React, { useMemo, useState, useEffect } from 'react';
import { Box, Typography, Stack, Checkbox, FormControlLabel, Paper, Select, MenuItem, FormControl, InputLabel, CircularProgress } from '@mui/material';

const CATALOG_URL = 'https://data.surrealcreamery.com/catalog.json';

// Dollars-vs-cents heuristic matching the server (< 100 ⇒ dollars).
const toCents = (raw) => {
  if (raw == null) return 0;
  if (typeof raw === 'object') raw = raw.amount;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  if (n == null || isNaN(n)) return 0;
  return n < 100 ? Math.round(n * 100) : Math.round(n);
};
const productPriceCents = (p) => toCents((p?.variants || [])[0]?.price ?? p?.price);
const bundleBaseCents = (b) => toCents((b.variants || [])[0]?.price);
const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

// Upcharge (cents) for choosing `product` in `slot`, mirroring the server's bundleExtraCents:
// explicit extraItems win; else the matching category's mode (flat → its upcharge, items → the item's
// upcharge, free/none → 0).
const slotPickUpchargeCents = (slot, product) => {
  const extra = (slot.extraItems || []).find(i => i.sku === product.sku);
  if (extra) return toCents(extra.upcharge);
  const cfg = slot.categoryConfig || {};
  for (const catId of (slot.categoryIds || [])) {
    if ((product.categoryIds || []).includes(catId)) {
      const c = cfg[catId] || {};
      if (c.mode === 'flat') return toCents(c.upcharge);
      if (c.mode === 'items') return toCents((c.items || []).find(i => i.sku === product.sku)?.upcharge);
      return 0; // free / unset
    }
  }
  return 0;
};

// Options a customer can choose for a slot = products in the slot's categories (from catalog.json) +
// any explicit extraItems. Each option: { sku, name, upchargeCents }.
const slotOptions = (slot, allProducts) => {
  const catSet = new Set(slot.categoryIds || []);
  const fromCats = (allProducts || [])
    .filter(p => !p.isBundle && p.productType !== 'bundle' && (p.categoryIds || []).some(c => catSet.has(c)))
    .map(p => ({ sku: p.sku, name: p.name || p.sku, upchargeCents: slotPickUpchargeCents(slot, p) }));
  const fromExtra = (slot.extraItems || []).map(i => ({ sku: i.sku, name: i.name || i.sku, upchargeCents: toCents(i.upcharge) }));
  // De-dupe by sku (extraItems take precedence for naming/upcharge).
  const bySku = new Map();
  for (const o of [...fromCats, ...fromExtra]) if (o.sku) bySku.set(o.sku, o);
  return [...bySku.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

export const AddOnsStepSection = ({ bundles = [], onChange }) => {
  const [enabled, setEnabled] = useState({});          // bundleSku → bool
  const [picks, setPicks] = useState({});              // `${bundleSku}:${slotId}` → chosen sku ('' = pick at pickup)
  const [allProducts, setAllProducts] = useState(null); // null = loading

  // Pull the published catalog once to resolve slot options (same source the commerce app uses).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${CATALOG_URL}?t=${Date.now()}`);
        const data = await r.json();
        if (!cancelled) setAllProducts(Array.isArray(data?.products) ? data.products : []);
      } catch { if (!cancelled) setAllProducts([]); }
    })();
    return () => { cancelled = true; };
  }, []);

  const offerable = useMemo(() => (bundles || []).filter(b => (b.bundleSlots || []).length), [bundles]);

  // Precompute each bundle's slots + resolved options.
  const bundleViews = useMemo(() => offerable.map(b => ({
    bundle: b,
    baseCents: bundleBaseCents(b),
    slots: (b.bundleSlots || []).map(s => ({ slot: s, options: slotOptions(s, allProducts || []) })),
  })), [offerable, allProducts]);

  // Build the selectedAddOns payload from enabled bundles + their slot picks.
  useEffect(() => {
    const out = [];
    for (const { bundle, baseCents, slots } of bundleViews) {
      if (!enabled[bundle.sku]) continue;
      let price = baseCents;
      const bundleItems = slots.map(({ slot, options }) => {
        const chosenSku = picks[`${bundle.sku}:${slot.id}`] || '';
        const opt = options.find(o => o.sku === chosenSku);
        if (opt) price += opt.upchargeCents || 0;
        return {
          slotId: slot.id,
          slotName: slot.name || '',
          productSku: opt ? opt.sku : null,
          name: opt ? opt.name : (slot.name || ''),
          ...(opt ? {} : { placeholder: true }),
        };
      });
      out.push({
        sku: bundle.sku,
        variantSku: (bundle.variants || [])[0]?.sku || bundle.sku,
        priceCents: price,
        bundleItems,
      });
    }
    onChange?.(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, picks, bundleViews]);

  if (!offerable.length) return null;

  const toggleBundle = (sku) => setEnabled(prev => ({ ...prev, [sku]: !prev[sku] }));
  const setPick = (key, sku) => setPicks(prev => ({ ...prev, [key]: sku }));

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>Add to your registration</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Optional extras — add a bundle and choose your options.
      </Typography>
      <Stack spacing={1.5}>
        {bundleViews.map(({ bundle, baseCents, slots }) => {
          const on = !!enabled[bundle.sku];
          return (
            <Paper key={bundle.sku} variant="outlined" sx={{ p: 1.5 }}>
              <FormControlLabel
                control={<Checkbox size="small" checked={on} onChange={() => toggleBundle(bundle.sku)} />}
                label={
                  <Typography variant="body2" fontWeight={700}>
                    {bundle.name} <Typography component="span" color="text.secondary" fontWeight={400}>— {fmt(baseCents)}</Typography>
                  </Typography>
                }
              />
              {on && (
                <Stack spacing={1.5} sx={{ mt: 1, pl: 3.5 }}>
                  {allProducts === null && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={14} />
                      <Typography variant="caption" color="text.secondary">Loading options…</Typography>
                    </Stack>
                  )}
                  {allProducts !== null && slots.map(({ slot, options }) => {
                    const key = `${bundle.sku}:${slot.id}`;
                    const val = picks[key] ?? '';
                    return (
                      <FormControl key={slot.id} size="small" fullWidth>
                        <InputLabel>{slot.name || 'Choose'}</InputLabel>
                        <Select label={slot.name || 'Choose'} value={val} onChange={(e) => setPick(key, e.target.value)}>
                          {/* Always allow deferring the choice to pickup */}
                          <MenuItem value=""><em>Choose at pickup</em></MenuItem>
                          {options.map(o => (
                            <MenuItem key={o.sku} value={o.sku}>
                              {o.name}{o.upchargeCents ? ` (+${fmt(o.upchargeCents)})` : ''}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    );
                  })}
                </Stack>
              )}
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};

export default AddOnsStepSection;
