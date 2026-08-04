import React, { useState, useMemo, useEffect } from 'react';
import {
    Dialog,
    Box,
    Typography,
    IconButton,
    Button,
    Chip,
    Stack,
    Card,
    CardActionArea,
    CardMedia,
    CardContent,
    Stepper,
    Step,
    StepLabel,
    Divider,
    MenuItem,
    Select,
    FormControl,
    Slide,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useCatalog } from '@/contexts/commerce/CatalogContext';
import { ModifierSelector } from './ModifierSelector';
import {
    productPriceDollars, slotUpcharge, slotUpchargeForProduct, addOnNextUnitPrice, addOnAddedCost, computeBundleTotal,
} from '@/utils/bundlePricing';

const SlideUpTransition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const money = (d) => `$${(Number(d) || 0).toFixed(2)}`;

/**
 * BundleConfigurator — full-screen configurator for bundle products.
 * Steps through each bundleSlot (whole-category or specific-item, each with upcharges), then a
 * Review step that also offers quantity add-ons (extra units at a tiered % discount). The running
 * total = bundle base + slot upcharges + add-on marginal costs. Prices are in dollars.
 */
export const BundleConfigurator = ({
    open,
    onClose,
    bundleProduct,
    onAddToCart,   // (bundleProduct, variant, bundleItems, extra) => void
}) => {
    const theme = useTheme();
    const { allProducts } = useCatalog();

    const slots = bundleProduct?.bundleSlots || [];
    const addOns = bundleProduct?.bundleAddOns || [];
    const bundleVariant = (bundleProduct?.variants || [])[0];

    const productBySku = useMemo(() => {
        const m = new Map();
        (allProducts || []).forEach(p => { if (p.sku) m.set(p.sku, p); });
        return m;
    }, [allProducts]);

    const [activeStep, setActiveStep] = useState(0); // 0..N-1 = slots, N = review
    const [slotSelections, setSlotSelections] = useState({});
    const [addOnState, setAddOnState] = useState({}); // { addOnId: { sku, name, unitPrice, addedQty } }

    useEffect(() => {
        if (open) {
            setActiveStep(0);
            setSlotSelections({});
            // Seed add-on state: item-target add-ons resolve immediately; category-target wait for a pick.
            const seed = {};
            for (const a of addOns) {
                if (a.target?.type === 'item' && a.target.sku) {
                    const p = productBySku.get(a.target.sku);
                    seed[a.id] = { sku: a.target.sku, name: p?.name || a.name, unitPrice: productPriceDollars(p), addedQty: 0 };
                } else {
                    seed[a.id] = { sku: '', name: '', unitPrice: 0, addedQty: 0 };
                }
            }
            setAddOnState(seed);
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const isReviewStep = activeStep === slots.length;
    const currentSlot = activeStep < slots.length ? slots[activeStep] : null;

    // Offered products = items in the slot's categories ∪ extra items listed on the slot.
    const slotProducts = useMemo(() => {
        if (!currentSlot) return [];
        const catSet = new Set(currentSlot.categoryIds || []);
        const catItems = (allProducts || []).filter(p => !p.isBundle && (p.categoryIds || []).some(cid => catSet.has(cid)));
        const have = new Set(catItems.map(p => p.sku));
        const extras = (currentSlot.extraItems || [])
            .filter(it => !have.has(it.sku))
            .map(it => productBySku.get(it.sku))
            .filter(Boolean);
        return [...catItems, ...extras];
    }, [allProducts, currentSlot, productBySku]);

    const productUpcharge = (p) => slotUpchargeForProduct(currentSlot, p);

    const handleSelectProduct = (product) => {
        const defaultVariant = (product.variants || [])[0];
        setSlotSelections(prev => ({
            ...prev,
            [currentSlot.id]: { product, variant: defaultVariant || null, modifiers: [], modifierSelections: null },
        }));
    };

    const handleModifierSelectionsChange = (selections, modifierCategories) => {
        if (!currentSlot) return;
        const mods = [];
        if (selections && modifierCategories) {
            modifierCategories.forEach(cat => {
                (selections[cat.id] || selections[cat.name] || []).forEach(sel => {
                    mods.push({ name: cat.name, value: sel.name || sel.value || sel });
                });
            });
        }
        setSlotSelections(prev => ({
            ...prev,
            [currentSlot.id]: { ...prev[currentSlot.id], modifiers: mods, modifierSelections: selections },
        }));
    };

    // Category add-on: choose which item to add.
    const pickAddOnItem = (addOnId, sku) => {
        const p = productBySku.get(sku);
        setAddOnState(prev => ({ ...prev, [addOnId]: { ...prev[addOnId], sku, name: p?.name || '', unitPrice: productPriceDollars(p), addedQty: 0 } }));
    };
    const changeAddOnQty = (addOn, delta) => {
        setAddOnState(prev => {
            const st = prev[addOn.id] || { addedQty: 0 };
            const max = addOn.maxAddQty === '' || addOn.maxAddQty == null ? Infinity : Number(addOn.maxAddQty);
            const next = Math.max(0, Math.min(max, (st.addedQty || 0) + delta));
            return { ...prev, [addOn.id]: { ...st, addedQty: next } };
        });
    };

    const canProceed = () => {
        if (!currentSlot) return false;
        const sel = slotSelections[currentSlot.id];
        if (currentSlot.required && !sel?.product) return false;
        return true;
    };

    const total = useMemo(
        () => computeBundleTotal({ bundleProduct, slotSelections, addOnState }),
        [bundleProduct, slotSelections, addOnState]
    );
    const upchargeTotal = useMemo(
        () => slots.reduce((s, slot) => s + slotUpcharge(slot, slotSelections[slot.id]), 0),
        [slots, slotSelections]
    );

    const handleAddToCart = () => {
        const bundleItems = slots.map(slot => {
            const sel = slotSelections[slot.id];
            if (!sel?.product) return null;
            return {
                slotId: slot.id, slotName: slot.name,
                productSku: sel.product.sku, variantSku: sel.variant?.sku || sel.product.sku,
                name: sel.product.name, variantName: sel.variant?.name || '',
                modifiers: sel.modifiers || [],
                upcharge: slotUpcharge(slot, sel),
            };
        }).filter(Boolean);

        const chosenAddOns = addOns.map(a => {
            const st = addOnState[a.id];
            if (!st?.sku || !(st.addedQty > 0)) return null;
            return {
                addOnId: a.id, name: a.name, sku: st.sku, itemName: st.name,
                addedQty: st.addedQty, unitPrice: st.unitPrice, tiers: a.tiers,
                addedCost: Math.round(addOnAddedCost(st.unitPrice, a.tiers, st.addedQty) * 100) / 100,
            };
        }).filter(Boolean);

        onAddToCart?.(bundleProduct, bundleVariant, bundleItems, {
            bundleAddOns: chosenAddOns,
            upchargeTotal: Math.round(upchargeTotal * 100) / 100,
            lineTotal: total,
        });
        onClose();
    };

    return (
        <Dialog fullScreen open={open} onClose={onClose} TransitionComponent={SlideUpTransition}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
                {/* Header */}
                <Box sx={{ px: 2, py: 1.5, bgcolor: '#4a148c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <IconButton onClick={onClose} sx={{ color: '#fff' }}><CloseIcon /></IconButton>
                        <Typography variant="h6" fontWeight={700}>{bundleProduct?.name || 'Bundle'}</Typography>
                    </Stack>
                    <Chip label={money(total)} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.2)', fontWeight: 700, fontSize: '1rem' }} />
                </Box>

                {/* Stepper */}
                <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Stepper activeStep={activeStep} alternativeLabel>
                        {slots.map((slot, i) => (
                            <Step key={slot.id} completed={!!slotSelections[slot.id]?.product}>
                                <StepLabel onClick={() => i < activeStep ? setActiveStep(i) : null} sx={{ cursor: i < activeStep ? 'pointer' : 'default' }}>
                                    {slot.name}
                                </StepLabel>
                            </Step>
                        ))}
                        <Step completed={isReviewStep}><StepLabel>Review</StepLabel></Step>
                    </Stepper>
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                    {isReviewStep ? (
                        <Box>
                            <Typography variant="h5" fontWeight={700} gutterBottom sx={{ textAlign: 'center' }}>
                                Your {bundleProduct?.name}
                            </Typography>
                            <Stack spacing={2} sx={{ maxWidth: 520, mx: 'auto', mt: 2 }}>
                                {slots.map(slot => {
                                    const sel = slotSelections[slot.id];
                                    const up = slotUpcharge(slot, sel);
                                    return (
                                        <Card key={slot.id} variant="outlined">
                                            <CardContent sx={{ py: 1.5 }}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                    <Box>
                                                        <Chip label={slot.name} size="small" color="secondary" variant="outlined" sx={{ mb: 0.5 }} />
                                                        <Typography variant="body1" fontWeight={600}>
                                                            {sel?.product?.name || '(skipped)'}{up > 0 ? ` (+${money(up)})` : ''}
                                                        </Typography>
                                                        {sel?.variant?.name && <Typography variant="caption" color="text.secondary">{sel.variant.name}</Typography>}
                                                        {(sel?.modifiers || []).map((m, i) => (
                                                            <Typography key={i} variant="caption" color="text.secondary" display="block">+ {m.name}: {m.value}</Typography>
                                                        ))}
                                                    </Box>
                                                    <Button size="small" onClick={() => setActiveStep(slots.indexOf(slot))}>Change</Button>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </Stack>

                            {/* Quantity add-ons */}
                            {addOns.length > 0 && (
                                <Box sx={{ maxWidth: 520, mx: 'auto', mt: 3 }}>
                                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>Add more &amp; save</Typography>
                                    <Stack spacing={1.5}>
                                        {addOns.map(a => {
                                            const st = addOnState[a.id] || { addedQty: 0 };
                                            const isCategory = a.target?.type === 'category';
                                            const catProducts = isCategory
                                                ? (allProducts || []).filter(p => !p.isBundle && (p.categoryIds || []).some(cid => (a.target.categoryIds || []).includes(cid)))
                                                : [];
                                            const nextPct = Number(a.tiers?.[Math.min(st.addedQty || 0, (a.tiers?.length || 1) - 1)]?.pct) || 0;
                                            const nextPrice = addOnNextUnitPrice(st.unitPrice, a.tiers, st.addedQty || 0);
                                            const ready = !!st.sku;
                                            return (
                                                <Card key={a.id} variant="outlined">
                                                    <CardContent sx={{ py: 1.5 }}>
                                                        <Typography variant="body1" fontWeight={700}>{a.name || 'Add-on'}</Typography>
                                                        {a.includedQty > 0 && (
                                                            <Typography variant="caption" color="text.secondary">Bundle includes {a.includedQty}. Add more below.</Typography>
                                                        )}
                                                        {isCategory && (
                                                            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                                                                <Select displayEmpty value={st.sku || ''} onChange={(e) => pickAddOnItem(a.id, e.target.value)}>
                                                                    <MenuItem value=""><em>Choose an item…</em></MenuItem>
                                                                    {catProducts.map(p => <MenuItem key={p.sku} value={p.sku}>{p.name} — {money(productPriceDollars(p))}</MenuItem>)}
                                                                </Select>
                                                            </FormControl>
                                                        )}
                                                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {ready ? (st.addedQty > 0
                                                                    ? `${st.addedQty} added · next unit ${money(nextPrice)}${nextPct ? ` (${nextPct}% off)` : ''}`
                                                                    : `Next unit ${money(nextPrice)}${nextPct ? ` (${nextPct}% off)` : ''}`)
                                                                    : 'Pick an item to add'}
                                                            </Typography>
                                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                                <IconButton size="small" disabled={!ready || !(st.addedQty > 0)} onClick={() => changeAddOnQty(a, -1)}><RemoveIcon fontSize="small" /></IconButton>
                                                                <Typography variant="body1" fontWeight={700} sx={{ minWidth: 20, textAlign: 'center' }}>{st.addedQty || 0}</Typography>
                                                                <IconButton size="small" disabled={!ready} onClick={() => changeAddOnQty(a, +1)}><AddIcon fontSize="small" /></IconButton>
                                                            </Stack>
                                                        </Stack>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </Stack>
                                </Box>
                            )}

                            <Box sx={{ textAlign: 'center', mt: 3 }}>
                                {upchargeTotal > 0 && (
                                    <Typography variant="body2" color="text.secondary">
                                        Base {money(productPriceDollars(bundleProduct))} + upcharges {money(upchargeTotal)}
                                        {total - productPriceDollars(bundleProduct) - upchargeTotal > 0.005 ? ` + add-ons ${money(total - productPriceDollars(bundleProduct) - upchargeTotal)}` : ''}
                                    </Typography>
                                )}
                                <Typography variant="h5" fontWeight={700}>Total: {money(total)}</Typography>
                            </Box>
                        </Box>
                    ) : (
                        <Box>
                            <Typography variant="h5" fontWeight={700} sx={{ textAlign: 'center', mb: 2 }}>{currentSlot?.name}</Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5, mb: 2 }}>
                                {slotProducts.map(p => {
                                    const isSelected = slotSelections[currentSlot?.id]?.product?.sku === p.sku;
                                    const img = p.masterImage?.url || p.imageUrl || p.images?.[0]?.url;
                                    const up = productUpcharge(p);
                                    return (
                                        <Card key={p.sku || p.id} sx={{ border: isSelected ? '3px solid' : '1px solid', borderColor: isSelected ? '#4a148c' : 'divider', borderRadius: 2 }}>
                                            <CardActionArea onClick={() => handleSelectProduct(p)}>
                                                {img && <CardMedia component="img" height={120} image={img} alt={p.name} sx={{ objectFit: 'cover' }} />}
                                                <CardContent sx={{ py: 1, px: 1 }}>
                                                    <Typography variant="body2" fontWeight={600} noWrap>{p.name}</Typography>
                                                    {up > 0 && <Typography variant="caption" color="secondary.main" fontWeight={700}>+{money(up)}</Typography>}
                                                    {isSelected && <Chip label="Selected" size="small" sx={{ bgcolor: '#4a148c', color: '#fff', mt: 0.5, display: 'block', width: 'fit-content' }} />}
                                                </CardContent>
                                            </CardActionArea>
                                        </Card>
                                    );
                                })}
                                {slotProducts.length === 0 && (
                                    <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1', py: 4, textAlign: 'center' }}>
                                        No products available for this selection.
                                    </Typography>
                                )}
                            </Box>
                            {slotSelections[currentSlot?.id]?.product?.sku && (
                                <Box sx={{ mt: 2, borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
                                    <ModifierSelector sku={slotSelections[currentSlot.id].product.sku} layout="flat" onSelectionsChange={handleModifierSelectionsChange} />
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>

                {/* Footer */}
                <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', bgcolor: 'background.paper' }}>
                    <Button variant="outlined" onClick={activeStep === 0 ? onClose : handleBack} startIcon={activeStep === 0 ? <CloseIcon /> : <ArrowBackIcon />}>
                        {activeStep === 0 ? 'Cancel' : 'Back'}
                    </Button>
                    {isReviewStep ? (
                        <Button variant="contained" onClick={handleAddToCart} startIcon={<ShoppingCartIcon />} sx={{ bgcolor: '#4a148c', '&:hover': { bgcolor: '#6a1b9a' } }}>
                            Add to Cart · {money(total)}
                        </Button>
                    ) : (
                        <Button variant="contained" onClick={handleNext} disabled={!canProceed()} endIcon={<ArrowForwardIcon />}>
                            {activeStep === slots.length - 1 ? 'Review' : 'Next'}
                        </Button>
                    )}
                </Box>
            </Box>
        </Dialog>
    );

    function handleNext() { if (activeStep < slots.length) setActiveStep(prev => prev + 1); }
    function handleBack() { if (activeStep > 0) setActiveStep(prev => prev - 1); }
};

export default BundleConfigurator;
