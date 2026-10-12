// src/components/events/AddOnsStepSection.jsx
// Optional registration upsell add-ons, shown on the payment screen. Each event's
// `registrationUpsellBundles` (embedded in the events feed) is an add-on bundle whose OPTIONAL
// flat-mode slots are offered as priced toggles. Selecting a slot adds a "pick the SKU at pickup"
// placeholder item; the actual product is chosen at fulfillment on the admin Bundles page.
//
// Pricing shown here is a preview only — the server re-derives every price from the catalog
// (see lambda-events-api/bundlePricing.mjs). v1 supports flat-mode slots (the recommended authoring
// pattern: a $0 bundle with one flat slot per add-on). Non-flat slots (per-SKU pick) are deferred.
import React, { useMemo, useState, useEffect } from 'react';
import { Box, Typography, Stack, Checkbox, FormControlLabel, Paper } from '@mui/material';

// Dollars-vs-cents heuristic matching the server (< 100 ⇒ dollars).
const toCents = (raw) => {
  if (raw == null) return 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  if (n == null || isNaN(n)) return 0;
  return n < 100 ? Math.round(n * 100) : Math.round(n);
};
const bundleBaseCents = (b) => toCents((b.variants || [])[0]?.price);
// The flat upcharge (cents) for a slot, if any category in it is configured flat.
const slotFlatUpchargeCents = (slot) => {
  const cfg = slot.categoryConfig || {};
  for (const catId of (slot.categoryIds || [])) {
    const c = cfg[catId];
    if (c && c.mode === 'flat') return toCents(c.upcharge);
  }
  return null; // not a flat slot
};
const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

// Build the selectedAddOns payload (for the machine → server) from the per-slot checkbox state.
function buildSelection(bundles, checked) {
  const out = [];
  for (const b of bundles) {
    const flatSlots = (b.bundleSlots || []).filter(s => slotFlatUpchargeCents(s) != null);
    const picked = flatSlots.filter(s => checked[`${b.sku}:${s.id}`]);
    if (!picked.length) continue;
    const base = bundleBaseCents(b);
    const priceCents = base + picked.reduce((sum, s) => sum + (slotFlatUpchargeCents(s) || 0), 0);
    out.push({
      sku: b.sku,
      variantSku: (b.variants || [])[0]?.sku || b.sku,
      priceCents,
      bundleItems: picked.map(s => ({ slotId: s.id, productSku: null, name: s.name || '', placeholder: true })),
    });
  }
  return out;
}

export function addOnsTotalCents(bundles, selected) {
  return (selected || []).reduce((sum, a) => sum + (a.priceCents || 0), 0);
}

export const AddOnsStepSection = ({ bundles = [], onChange }) => {
  const [checked, setChecked] = useState({});

  // Only bundles that actually have flat-mode slots are offerable in v1.
  const offerable = useMemo(
    () => (bundles || []).filter(b => (b.bundleSlots || []).some(s => slotFlatUpchargeCents(s) != null)),
    [bundles],
  );

  useEffect(() => {
    onChange?.(buildSelection(offerable, checked));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, offerable]);

  if (!offerable.length) return null;

  const toggle = (key) => setChecked(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>Add to your registration</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Optional extras — you&apos;ll pick the exact item at pickup, based on availability.
      </Typography>
      <Stack spacing={1.5}>
        {offerable.map((b) => {
          const flatSlots = (b.bundleSlots || []).filter(s => slotFlatUpchargeCents(s) != null);
          return (
            <Paper key={b.sku} variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>{b.name}</Typography>
              <Stack>
                {flatSlots.map((s) => {
                  const key = `${b.sku}:${s.id}`;
                  const up = slotFlatUpchargeCents(s) || 0;
                  return (
                    <FormControlLabel
                      key={key}
                      control={<Checkbox size="small" checked={!!checked[key]} onChange={() => toggle(key)} />}
                      label={
                        <Typography variant="body2">
                          {s.name || 'Add-on'} <Typography component="span" color="text.secondary">— {fmt(up)}</Typography>
                        </Typography>
                      }
                    />
                  );
                })}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};

export default AddOnsStepSection;
