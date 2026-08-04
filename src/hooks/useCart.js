import { useState, useCallback, useRef } from 'react';

const STORAGE_KEY = 'surrealCart';
const CART_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Load cart from localStorage, returning null if expired or missing
 */
const loadCart = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const { items, cartId, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp > CART_EXPIRY_MS) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return { items: items || [], cartId: cartId || crypto.randomUUID() };
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
};

/**
 * Save cart to localStorage with timestamp
 */
const saveCart = (items, cartId) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items,
        cartId,
        timestamp: Date.now(),
    }));
};

/**
 * Local cart hook — manages cart state in React + localStorage.
 * All mutations save to localStorage synchronously (survives unmount/navigate).
 */
export const useCart = () => {
    const [cart, setCart] = useState(() => {
        const loaded = loadCart();
        return loaded?.items || [];
    });
    const [cartId] = useState(() => {
        const loaded = loadCart();
        return loaded?.cartId || crypto.randomUUID();
    });
    const cartIdRef = useRef(cartId);

    // Helper: update cart state AND save to localStorage synchronously
    const updateCart = useCallback((updater) => {
        setCart(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            saveCart(next, cartIdRef.current);
            return next;
        });
    }, []);

    /**
     * Add item to cart (merges by variantSku + modifiers key)
     */
    const addToCart = useCallback((product, variant, quantity = 1, modifiers = [], { isFreeGift = false, discountId = null, fulfillmentMethod = null, fulfillmentLocationId = null, fulfillmentLocationName = null, crossSellDiscount = null, triggerProductId = null } = {}) => {
        const variantSku = variant?.sku || variant?.id || product?.id;
        const modKey = modifiers.map(m => `${m.key}:${m.value}`).sort().join('|');

        updateCart(prev => {
            const existingIdx = prev.findIndex(item => {
                if (item.variantSku !== variantSku) return false;
                if ((item.fulfillmentMethod || null) !== (fulfillmentMethod || null)) return false;
                if ((item.fulfillmentLocationId || null) !== (fulfillmentLocationId || null)) return false;
                const existingModKey = (item.modifiers || []).map(m => `${m.key}:${m.value}`).sort().join('|');
                return existingModKey === modKey;
            });

            if (existingIdx !== -1) {
                return prev.map((item, idx) =>
                    idx === existingIdx
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }

            return [...prev, {
                id: crypto.randomUUID(),
                productId: product?.id || product?.sku || '',
                variantId: variant?.sku || variant?.id || '',
                sku: product?.sku || variant?.sku || '',
                variantSku,
                name: product?.name || product?.title || '',
                variantName: variant?.name || (variant?.title !== 'Default Title' ? (variant?.title || '') : ''),
                unitPrice: parseFloat(variant?.price?.amount || variant?.price || 0),
                quantity,
                modifiers: modifiers || [],
                image: variant?.image?.url || variant?.image?.src || product?.images?.[0]?.url || product?.imageUrl || '',
                isFreeGift,
                discountId,
                ...(fulfillmentMethod ? { fulfillmentMethod } : {}),
                ...(fulfillmentLocationId ? { fulfillmentLocationId, fulfillmentLocationName } : {}),
                ...(crossSellDiscount ? { crossSellDiscount, triggerProductId } : {}),
                ...(variant?.redeemableForPoints ? { redeemableForPoints: true } : {}),
            }];
        });
    }, [updateCart]);

    /**
     * Add a bundle to cart (no merge — bundles are always unique entries)
     */
    const addBundleToCart = useCallback((product, variant, bundleItems = [], opts = {}) => {
        const {
            fulfillmentMethod = null, fulfillmentLocationId = null, fulfillmentLocationName = null,
            bundleAddOns = [], lineTotal = null, upchargeTotal = 0,
        } = opts;
        const basePrice = parseFloat(variant?.price?.amount || variant?.price || 0);
        // Effective line price = the configurator's computed total (base + slot upcharges + add-ons).
        const unitPrice = (lineTotal != null && !Number.isNaN(Number(lineTotal))) ? Number(lineTotal) : basePrice;
        updateCart(prev => [...prev, {
            id: crypto.randomUUID(),
            productId: product?.id || product?.sku || '',
            variantId: variant?.sku || variant?.id || '',
            sku: product?.sku || variant?.sku || '',
            variantSku: variant?.sku || variant?.id || product?.id,
            name: product?.name || product?.title || '',
            variantName: variant?.name || '',
            unitPrice,
            basePrice,
            upchargeTotal: Number(upchargeTotal) || 0,
            quantity: 1,
            modifiers: [],
            image: variant?.image?.url || variant?.image?.src || product?.images?.[0]?.url || product?.imageUrl || '',
            isBundle: true,
            bundleItems: bundleItems.map(bi => ({
                slotId: bi.slotId,
                slotName: bi.slotName || '',
                productSku: bi.productSku || '',
                variantSku: bi.variantSku || '',
                name: bi.name || '',
                variantName: bi.variantName || '',
                modifiers: bi.modifiers || [],
                upcharge: Number(bi.upcharge) || 0,
            })),
            bundleAddOns: (bundleAddOns || []).map(a => ({
                addOnId: a.addOnId, name: a.name || '', sku: a.sku, itemName: a.itemName || '',
                addedQty: a.addedQty || 0, unitPrice: a.unitPrice || 0, addedCost: a.addedCost || 0, tiers: a.tiers || [],
            })),
            ...(fulfillmentMethod ? { fulfillmentMethod } : {}),
            ...(fulfillmentLocationId ? { fulfillmentLocationId, fulfillmentLocationName } : {}),
        }]);
    }, [updateCart]);

    /**
     * Remove item by id
     */
    const removeFromCart = useCallback((itemId) => {
        updateCart(prev => {
            const removed = prev.find(item => item.id === itemId);
            return prev.filter(item => item.id !== itemId).map(item => {
                if (item.crossSellDiscount && item.triggerProductId && removed && item.triggerProductId === removed.productId) {
                    const { crossSellDiscount, triggerProductId, ...rest } = item;
                    return rest;
                }
                return item;
            });
        });
    }, [updateCart]);

    /**
     * Remove item by variantId (for discount swap logic)
     */
    const removeByVariantId = useCallback((variantId) => {
        updateCart(prev => {
            const removed = prev.filter(item => item.variantId === variantId);
            const removedProductIds = new Set(removed.map(item => item.productId));
            return prev.filter(item => item.variantId !== variantId).map(item => {
                if (item.crossSellDiscount && item.triggerProductId && removedProductIds.has(item.triggerProductId)) {
                    const { crossSellDiscount, triggerProductId, ...rest } = item;
                    return rest;
                }
                return item;
            });
        });
    }, [updateCart]);

    /**
     * Update quantity for an item
     */
    const updateQuantity = useCallback((itemId, newQty) => {
        if (newQty < 1) {
            removeFromCart(itemId);
            return;
        }
        updateCart(prev => prev.map(item =>
            item.id === itemId ? { ...item, quantity: newQty } : item
        ));
    }, [updateCart, removeFromCart]);

    /**
     * Clear entire cart
     */
    const clearCart = useCallback(() => {
        setCart([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    /**
     * Total item count
     */
    const getCartCount = useCallback(() => {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    }, [cart]);

    /**
     * Subtotal = sum of (unitPrice + modifier prices) * quantity
     */
    const getSubtotal = useCallback(() => {
        return cart.reduce((sum, item) => {
            const modTotal = (item.modifiers || []).reduce((s, m) => s + (parseFloat(m.price) || 0), 0);
            let unitWithMods = item.unitPrice + modTotal;
            if (item.crossSellDiscount) {
                const csd = item.crossSellDiscount;
                unitWithMods = Math.max(0, csd.valueType === 'PERCENTAGE'
                    ? unitWithMods * (1 - csd.value / 100)
                    : unitWithMods - csd.value / 100);
            }
            return sum + unitWithMods * item.quantity;
        }, 0);
    }, [cart]);

    /**
     * Check if a variantId is already in cart
     */
    const isInCart = useCallback((variantId) => {
        return cart.some(item => item.variantId === variantId);
    }, [cart]);

    /**
     * Toggle usePoints flag on a cart item
     */
    const toggleUsePoints = useCallback((itemId) => {
        updateCart(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            if (!item.redeemableForPoints) return item; // only redeemable products can use points
            return { ...item, usePoints: !item.usePoints };
        }));
    }, [updateCart]);

    /**
     * Sum of point costs for items with usePoints=true
     */
    const getPointsTotal = useCallback((pointsPerDollar) => {
        return cart.reduce((sum, item) => {
            if (!item.usePoints) return sum;
            const modTotal = (item.modifiers || []).reduce((s, m) => s + (parseFloat(m.price) || 0), 0);
            let unitWithMods = item.unitPrice + modTotal;
            if (item.crossSellDiscount) {
                const csd = item.crossSellDiscount;
                unitWithMods = Math.max(0, csd.valueType === 'PERCENTAGE'
                    ? unitWithMods * (1 - csd.value / 100)
                    : unitWithMods - csd.value / 100);
            }
            return sum + Math.round(unitWithMods * item.quantity * pointsPerDollar);
        }, 0);
    }, [cart]);

    /**
     * Dollar total for items NOT using points
     */
    const getDollarTotal = useCallback(() => {
        return cart.reduce((sum, item) => {
            if (item.usePoints) return sum;
            const modTotal = (item.modifiers || []).reduce((s, m) => s + (parseFloat(m.price) || 0), 0);
            let unitWithMods = item.unitPrice + modTotal;
            if (item.crossSellDiscount) {
                const csd = item.crossSellDiscount;
                unitWithMods = Math.max(0, csd.valueType === 'PERCENTAGE'
                    ? unitWithMods * (1 - csd.value / 100)
                    : unitWithMods - csd.value / 100);
            }
            return sum + unitWithMods * item.quantity;
        }, 0);
    }, [cart]);

    /**
     * Clear all usePoints flags
     */
    const clearAllUsePoints = useCallback(() => {
        updateCart(prev => prev.map(item => {
            if (item.usePoints) {
                const { usePoints, ...rest } = item;
                return rest;
            }
            return item;
        }));
    }, [updateCart]);

    return {
        cart,
        cartId,
        addToCart,
        addBundleToCart,
        removeFromCart,
        removeByVariantId,
        updateQuantity,
        clearCart,
        getCartCount,
        getSubtotal,
        isInCart,
        toggleUsePoints,
        getPointsTotal,
        getDollarTotal,
        clearAllUsePoints,
    };
};

export default useCart;
