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
    const addToCart = useCallback((product, variant, quantity = 1, modifiers = [], { isFreeGift = false, discountId = null, fulfillmentMethod = null } = {}) => {
        const variantSku = variant?.sku || variant?.id || product?.id;
        const modKey = modifiers.map(m => `${m.key}:${m.value}`).sort().join('|');

        updateCart(prev => {
            const existingIdx = prev.findIndex(item => {
                if (item.variantSku !== variantSku) return false;
                if ((item.fulfillmentMethod || null) !== (fulfillmentMethod || null)) return false;
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
                productId: product?.shopifyId || product?.platformIds?.shopify || product?.id || '',
                variantId: variant?.shopifyVariantGid || variant?.platformIds?.shopify || variant?.id || '',
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
            }];
        });
    }, [updateCart]);

    /**
     * Remove item by id
     */
    const removeFromCart = useCallback((itemId) => {
        updateCart(prev => prev.filter(item => item.id !== itemId));
    }, [updateCart]);

    /**
     * Remove item by variantId (for discount swap logic)
     */
    const removeByVariantId = useCallback((variantId) => {
        updateCart(prev => prev.filter(item => item.variantId !== variantId));
    }, [updateCart]);

    /**
     * Update quantity for an item
     */
    const updateQuantity = useCallback((itemId, newQty) => {
        if (newQty < 1) {
            updateCart(prev => prev.filter(item => item.id !== itemId));
            return;
        }
        updateCart(prev => prev.map(item =>
            item.id === itemId ? { ...item, quantity: newQty } : item
        ));
    }, [updateCart]);

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
            return sum + (item.unitPrice + modTotal) * item.quantity;
        }, 0);
    }, [cart]);

    /**
     * Check if a variantId is already in cart
     */
    const isInCart = useCallback((variantId) => {
        return cart.some(item => item.variantId === variantId);
    }, [cart]);

    return {
        cart,
        cartId,
        addToCart,
        removeFromCart,
        removeByVariantId,
        updateQuantity,
        clearCart,
        getCartCount,
        getSubtotal,
        isInCart,
    };
};

export default useCart;
