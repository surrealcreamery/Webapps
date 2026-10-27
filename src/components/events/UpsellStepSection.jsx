// src/components/events/UpsellStepSection.jsx
// Inline bundle-UPGRADE card, rendered on the payment screen (NOT a separate step). It's an optional
// add-on the customer can toggle on/off; toggling updates the order total live, and the single Pay
// button remains the only forward action. OFF by default so nothing is added by accident. The extra
// item (e.g. Dragon Shield sleeves) can be purchased in MULTIPLE units via a full-screen picker:
// "Decide at pickup" sits at the top and is the default; each option costs the upgrade delta plus any
// per-product upcharge configured in the bundle slot (e.g. $8 base + $1.50 upcharge = $9.50). The
// server re-derives every price (lambda-events-api createEventRegistration, isUpgrade add-on w/ units).
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box, Typography, Paper, Checkbox, Radio, Dialog, AppBar, Toolbar, IconButton, Container,
  List, ListItemButton, ListItemAvatar, Avatar, ListItemText, CircularProgress, Link, Divider, ListSubheader,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

const CATALOG_URL = 'https://data.surrealcreamery.com/catalog.json';
const PICKUP = '__pickup__'; // sentinel: one sleeve, color decided at the counter

const toCents = (raw) => {
  if (raw == null) return 0;
  if (typeof raw === 'object') raw = raw.amount;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return (n == null || isNaN(n)) ? 0 : (n < 100 ? Math.round(n * 100) : Math.round(n));
};
const fmt = (cents) => {
  const d = Math.max(0, cents || 0) / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
};
// An image entry can be a plain URL string or an object ({ thumb, url, pwa:{sm,md}, … }).
const imgUrl = (img) => {
  if (!img) return null;
  if (typeof img === 'string') return img;
  return img.thumb || img.url || img.pwa?.sm || img.pwa?.md || null;
};
const productImage = (p) => imgUrl((p?.images || [])[0]) || imgUrl(p?.masterImage) || (typeof p?.imageUrl === 'string' ? p.imageUrl : null);

// Per-pick upcharge (cents) for choosing `product` in `slot` — mirrors the server slotPickUpchargeCents.
const slotUpchargeCents = (slot, product) => {
  const extra = (slot?.extraItems || []).find(i => i.sku === product.sku);
  if (extra) return toCents(extra.upcharge);
  const cfg = slot?.categoryConfig || {};
  for (const catId of (slot?.categoryIds || [])) {
    if ((product.categoryIds || []).includes(catId)) {
      const c = cfg[catId] || {};
      if (c.mode === 'flat') return toCents(c.upcharge);
      if (c.mode === 'items') return toCents((c.items || []).find(i => i.sku === product.sku)?.upcharge);
      return 0;
    }
  }
  return 0;
};

// Options for a slot = products in its categories + explicit extraItems. Each carries the subcategory
// it matched (`catId`) so the picker can group by subcategory. {sku,name,image,upchargeCents,catId}.
const resolveSlotOptions = (slot, allProducts) => {
  if (!slot) return [];
  const catSet = new Set(slot.categoryIds || []);
  const fromCats = (allProducts || [])
    .filter(p => !p.isBundle && p.productType !== 'bundle' && (p.categoryIds || []).some(c => catSet.has(c)))
    .map(p => ({ sku: p.sku, name: p.name || p.sku, image: productImage(p), upchargeCents: slotUpchargeCents(slot, p), catId: (p.categoryIds || []).find(c => catSet.has(c)) || null }));
  const fromExtra = (slot.extraItems || []).map(i => ({ sku: i.sku, name: i.name || i.sku, image: null, upchargeCents: toCents(i.upcharge), catId: null }));
  const bySku = new Map();
  for (const o of [...fromCats, ...fromExtra]) if (o.sku) bySku.set(o.sku, o);
  return [...bySku.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

export const UpsellCard = ({ offer, currentAddOns, onChange }) => {
  // Initialize from any upgrade already in the cart (so returning to payment keeps the selection).
  const existing = (currentAddOns || []).find(a => a && a.isUpgrade && a.sku === offer?.bundle?.sku);
  const existingSel = existing?.units?.map(u => u.productSku || PICKUP) || [];
  const [selected, setSelected] = useState(existingSel); // array of sku or PICKUP; [] = not added
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allProducts, setAllProducts] = useState(null); // null = loading
  const [categories, setCategories] = useState([]);     // for subcategory grouping in the picker

  const extraSlot = useMemo(() => {
    if (!offer?.bundle) return null;
    const extraNames = new Set((offer.upgrade?.extraItems || []).map(n => (n || '').trim().toLowerCase()));
    return (offer.bundle.bundleSlots || []).find(s => extraNames.has((s.name || '').trim().toLowerCase())) || null;
  }, [offer]);

  const options = useMemo(() => resolveSlotOptions(extraSlot, allProducts || []), [extraSlot, allProducts]);

  // Group options by their subcategory (e.g. Matte Sleeves / Classic / Matte Dual), in the slot's
  // category order; items with no category (explicit extras) fall into a trailing "More" group.
  const categoryName = (id) => (categories || []).find(c => (c.id || c.sk || c.categoryId) === id)?.name || '';
  const optionGroups = useMemo(() => {
    const order = extraSlot?.categoryIds || [];
    const byCat = new Map();
    const ungrouped = [];
    for (const o of options) {
      if (o.catId) { if (!byCat.has(o.catId)) byCat.set(o.catId, []); byCat.get(o.catId).push(o); }
      else ungrouped.push(o);
    }
    const out = [];
    for (const cid of order) { const items = byCat.get(cid); if (items?.length) out.push({ catId: cid, name: categoryName(cid), items }); }
    for (const [cid, items] of byCat) if (!order.includes(cid)) out.push({ catId: cid, name: categoryName(cid), items });
    if (ungrouped.length) out.push({ catId: null, name: out.length ? 'More' : null, items: ungrouped });
    return out;
  }, [options, extraSlot, categories]);
  const showGroupHeaders = optionGroups.filter(g => g.name).length > 1;
  const deltaCents = offer?.upgrade?.deltaCents || 0;
  const unitCents = (sku) => {
    if (sku === PICKUP || !sku) return deltaCents;
    const o = options.find(x => x.sku === sku);
    return deltaCents + (o?.upchargeCents || 0);
  };
  const added = selected.length > 0;
  const totalCents = selected.reduce((s, sku) => s + unitCents(sku), 0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${CATALOG_URL}?t=${Date.now()}`);
        const data = await r.json();
        if (!cancelled) {
          setAllProducts(Array.isArray(data?.products) ? data.products : (Array.isArray(data) ? data : []));
          setCategories(Array.isArray(data?.categories) ? data.categories : []);
        }
      } catch { if (!cancelled) setAllProducts([]); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Push the current selection up to the cart whenever it changes.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (!offer?.bundle) return;
    if (!selected.length) { onChangeRef.current?.([]); return; }
    const { bundle, upgrade } = offer;
    const units = selected.map(sku => ({ productSku: sku === PICKUP ? null : sku }));
    const baseSlotItems = (bundle.bundleSlots || []).filter(s => !extraSlot || s.id !== extraSlot.id).map(s => ({
      slotId: s.id, slotName: s.name || '', productSku: null, name: s.name || '', placeholder: true,
    }));
    const unitItems = selected.map(sku => {
      const o = sku === PICKUP ? null : options.find(x => x.sku === sku);
      return {
        slotId: extraSlot?.id || null, slotName: extraSlot?.name || '',
        productSku: o ? o.sku : null, name: o ? o.name : (extraSlot?.name || ''),
        ...(o ? {} : { placeholder: true }),
      };
    });
    onChangeRef.current?.([{
      sku: bundle.sku,
      variantSku: (bundle.variants || [])[0]?.sku || bundle.sku,
      isUpgrade: true,
      baseSku: upgrade.baseSku,
      extraSlotId: extraSlot?.id || null,
      units,
      priceCents: totalCents,
      bundleItems: [...baseSlotItems, ...unitItems],
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, options.length]);

  if (!offer || !offer.bundle || !offer.upgrade) return null;
  const { bundle, upgrade } = offer;
  const title = (upgrade.extraItems || []).filter(Boolean).join(', ') || bundle.name || 'Upgrade';

  const toggleCard = () => setSelected(prev => (prev.length ? [] : [PICKUP]));
  // Single selection only: picking an option REPLACES the current one and closes the picker.
  const pick = (sku) => { setSelected([sku]); setPickerOpen(false); };

  // Summary of what's chosen, for the card subtext.
  const chosenNames = selected.filter(s => s !== PICKUP).map(s => options.find(o => o.sku === s)?.name).filter(Boolean);
  const pickupCount = selected.filter(s => s === PICKUP).length;
  const subtext = !added ? ''
    : [chosenNames.join(', '), pickupCount ? `${pickupCount} chosen at pickup` : ''].filter(Boolean).join(' · ') || 'Chosen at pickup';

  const hasChoices = options.length > 0;

  return (
    <Box sx={{ mt: 3, mb: 3 }}>
      <Paper
        variant="outlined"
        sx={{
          p: 2, borderRadius: 2, borderWidth: 2,
          borderColor: added ? 'primary.main' : 'divider',
          bgcolor: added ? 'action.selected' : 'transparent',
          transition: 'border-color .15s, background-color .15s',
        }}
      >
        <Box
          onClick={toggleCard}
          role="checkbox"
          aria-checked={added}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleCard(); } }}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
        >
          <Checkbox checked={added} tabIndex={-1} sx={{ p: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body1" fontWeight={700} noWrap>
              {added && selected.length > 1 ? `${title} × ${selected.length}` : `Add ${title}`}
            </Typography>
            {subtext && <Typography variant="body2" color="text.secondary" noWrap>{subtext}</Typography>}
          </Box>
          <Typography variant="body1" fontWeight={700} color={added ? 'primary.main' : 'text.primary'}>
            +{fmt(added ? totalCents : deltaCents)}
          </Typography>
        </Box>

        {hasChoices && (
          <Box sx={{ pl: '34px', mt: 0.5 }}>
            <Link component="button" type="button" variant="body2" onClick={() => setPickerOpen(true)} sx={{ fontWeight: 600 }}>
              {added && chosenNames.length ? 'Change selection' : 'View available options'}
            </Link>
          </Box>
        )}
      </Paper>

      {/* Full-screen multi-select picker. "Decide at pickup" pinned to the top; price = delta + upcharge. */}
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullScreen>
        <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Toolbar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Choose your {title}</Typography>
              <Typography variant="caption" color="text.secondary">Pick one</Typography>
            </Box>
            <IconButton edge="end" onClick={() => setPickerOpen(false)} aria-label="Done"><CloseRoundedIcon /></IconButton>
          </Toolbar>
        </AppBar>
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          <Container maxWidth="sm" sx={{ px: 0 }}>
            {allProducts === null ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
            ) : (
              <List disablePadding>
                {/* Default option, at the top */}
                <ListItemButton selected={selected.includes(PICKUP)} onClick={() => pick(PICKUP)} sx={{ py: 1.5 }}>
                  <Radio edge="start" checked={selected.includes(PICKUP)} tabIndex={-1} disableRipple />
                  <ListItemText primary="Decide at pickup" secondary="Pick your color at the counter" primaryTypographyProps={{ fontWeight: 600 }} />
                </ListItemButton>
                <Divider />
                {optionGroups.map(g => (
                  <React.Fragment key={g.catId || 'more'}>
                    {showGroupHeaders && g.name && (
                      <ListSubheader disableSticky disableGutters sx={{ bgcolor: 'background.paper', fontWeight: 700, color: 'text.secondary', lineHeight: 1.6, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 11, px: 2, pt: 1.5, pb: 0.5 }}>
                        {g.name}
                      </ListSubheader>
                    )}
                    {g.items.map(o => (
                      <ListItemButton key={o.sku} selected={selected.includes(o.sku)} onClick={() => pick(o.sku)} sx={{ py: 1.5 }}>
                        <Radio edge="start" checked={selected.includes(o.sku)} tabIndex={-1} disableRipple />
                        {o.image && (
                          <ListItemAvatar>
                            <Avatar variant="rounded" src={o.image} alt={o.name} sx={{ width: 56, height: 56, bgcolor: 'grey.100' }} />
                          </ListItemAvatar>
                        )}
                        <ListItemText primary={o.name} primaryTypographyProps={{ fontWeight: 400 }} />
                        {/* Only flag a price when this color costs MORE than the base — no redundant "+$8". */}
                        {(o.upchargeCents || 0) > 0 && (
                          <Typography variant="body2" fontWeight={700} color="primary.main">+{fmt(deltaCents + o.upchargeCents)}</Typography>
                        )}
                      </ListItemButton>
                    ))}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Container>
        </Box>
      </Dialog>
    </Box>
  );
};

export default UpsellCard;
