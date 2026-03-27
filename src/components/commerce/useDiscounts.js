import { useState, useEffect, useCallback, useRef } from 'react';

const DISCOUNTS_URL = 'https://data.surrealcreamery.com/discounts.json';

// Module-level lock to prevent duplicate adds across re-renders
let isAddingGifts = false;

/**
 * Hook to fetch and manage discounts from static JSON (admin-published format)
 * Auto-adds free gifts when conditions are met
 * @param {Object} localCart - useCart hook instance { cart, addToCart, removeByVariantId, isInCart, getSubtotal }
 * @param {Object} selectedRewards - User's selected rewards { [threshold]: discountId }
 * @param {Array} products - Shopify products array (for identifying blind boxes)
 */
export const useDiscounts = (localCart, selectedRewards = {}, products = []) => {
    const [discounts, setDiscounts] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const addedGifts = useRef(new Set()); // Track which gifts we've already added
    const previousSelectedRewards = useRef({}); // Track previous selections for swap logic

    // Fetch discounts JSON
    useEffect(() => {
        const fetchDiscounts = async () => {
            try {
                setLoading(true);
                const response = await fetch(DISCOUNTS_URL);
                if (!response.ok) {
                    throw new Error('Failed to fetch discounts');
                }
                const data = await response.json();
                console.log('🎁 Discounts loaded:', data);

                // Support both new format (object with .discounts) and legacy array
                const discountList = Array.isArray(data) ? data : (data.discounts || []);

                // Filter out expired discounts
                const now = new Date();
                const activeDiscounts = discountList.filter(d => {
                    if (d.validUntil && new Date(d.validUntil) < now) return false;
                    if (d.validFrom && new Date(d.validFrom) > now) return false;
                    return true;
                });

                console.log(`🎁 ${activeDiscounts.length} active discounts (filtered from ${discountList.length})`);
                setDiscounts(activeDiscounts);
            } catch (err) {
                console.error('Error fetching discounts:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDiscounts();
    }, []);

    // Get cart total from local cart
    const cartTotal = localCart?.getSubtotal?.() || 0;

    // Get cart items from local cart
    const cartItems = localCart?.cart || [];

    // Check if a variant is already in cart
    const isInCart = useCallback((variantId) => {
        return localCart?.isInCart?.(variantId) || false;
    }, [localCart?.cart]);

    // Count cart items that qualify for a discount based on buyProductSkus
    const getQualifyingCount = useCallback((discount) => {
        if (!cartItems.length) return 0;

        const qualifyingSkus = discount.buyProductSkus || [];

        // If no specific SKUs, count all items
        if (qualifyingSkus.length === 0) {
            return cartItems.reduce((sum, item) => sum + item.quantity, 0);
        }

        // Count cart items that match qualifying SKUs
        return cartItems.reduce((count, item) => {
            const itemSku = item.sku || item.variantSku;
            if (itemSku && qualifyingSkus.includes(itemSku)) {
                return count + item.quantity;
            }
            return count;
        }, 0);
    }, [cartItems]);

    // Parse order discounts (PERCENTAGE_OFF, AMOUNT_OFF, SPEND_THRESHOLD, AUTOMATIC)
    const getOrderDiscounts = useCallback(() => {
        if (!discounts || !Array.isArray(discounts)) return [];

        const ORDER_CATEGORIES = ['PERCENTAGE_OFF', 'AMOUNT_OFF', 'SPEND_THRESHOLD', 'AUTOMATIC'];

        return discounts
            .filter(d => ORDER_CATEGORIES.includes(d.discountCategory))
            .map(d => ({
                id: d.id,
                title: d.name,
                status: 'ACTIVE',
                percentOff: d.valueType === 'PERCENTAGE' ? d.value : null,
                amountOff: d.valueType === 'FIXED_AMOUNT' ? d.value : null,
                threshold: d.spendMinimum || 0,
                quantityThreshold: null,
                isActive: true,
                valueType: d.valueType,
            }));
    }, [discounts]);

    // Parse free gift discounts (BUY_X_GET_Y where getValueType is FREE)
    const getFreeGiftDiscounts = useCallback(() => {
        if (!discounts || !Array.isArray(discounts)) return [];

        return discounts
            .filter(d => d.discountCategory === 'BUY_X_GET_Y' && d.getValueType === 'FREE')
            .map(d => {
                const resolvedProducts = d.products || {};
                const freeProducts = (d.getProductSkus || []).map(sku => ({
                    id: sku,
                    title: resolvedProducts[sku]?.name,
                    variantId: resolvedProducts[sku]?.defaultVariantSku,
                    image: resolvedProducts[sku]?.image,
                }));

                // Determine trigger type
                let trigger = null;
                if (d.buyProductSkus?.length) {
                    trigger = {
                        type: 'minQuantity',
                        quantity: d.buyQuantity,
                    };
                } else if (d.spendMinimum) {
                    trigger = {
                        type: 'minCartTotal',
                        amount: d.spendMinimum,
                    };
                }

                return {
                    id: d.id,
                    title: d.name,
                    status: 'ACTIVE',
                    trigger,
                    freeProducts,
                    freeProduct: freeProducts[0],
                    buyProductSkus: d.buyProductSkus || [],
                };
            });
    }, [discounts]);

    // Parse app discounts (not used in new format, kept for interface compatibility)
    const getAppDiscounts = useCallback(() => {
        return [];
    }, []);

    // Check if a specific discount is active by title (partial match)
    const isDiscountActive = useCallback((titleSearch) => {
        if (!discounts || !Array.isArray(discounts)) return false;

        return discounts.some(d =>
            d.name?.toLowerCase().includes(titleSearch.toLowerCase())
        );
    }, [discounts]);

    // Check and auto-add free gifts
    useEffect(() => {
        if (!discounts || !localCart?.addToCart) return;
        if (isAddingGifts) return; // Prevent duplicate runs

        const freeGifts = getFreeGiftDiscounts();

        console.log('🎁 Free gift discounts found:', freeGifts.length, freeGifts.map(g => g.title));
        console.log('🎁 Selected rewards state:', selectedRewards);

        // Group quantity-based discounts by threshold to detect multiple options
        const quantityGiftsByThreshold = {};
        freeGifts.forEach(gift => {
            if (gift.trigger?.type === 'minQuantity') {
                const threshold = gift.trigger.quantity;
                if (!quantityGiftsByThreshold[threshold]) {
                    quantityGiftsByThreshold[threshold] = [];
                }
                quantityGiftsByThreshold[threshold].push(gift);
            }
        });

        // Check which thresholds have multiple options - these need user selection
        const thresholdsNeedingSelection = Object.entries(quantityGiftsByThreshold)
            .filter(([_, gifts]) => gifts.length > 1)
            .map(([threshold, _]) => parseInt(threshold));

        console.log('🎁 Thresholds needing user selection:', thresholdsNeedingSelection);

        const checkFreeGifts = async () => {
            for (const gift of freeGifts) {
                // Skip if no products to add
                if (!gift.freeProducts?.length) continue;

                // Skip if already processed this discount
                if (addedGifts.current.has(gift.id)) continue;

                // Check trigger conditions
                let conditionMet = false;

                if (gift.trigger?.type === 'minCartTotal') {
                    conditionMet = cartTotal >= gift.trigger.amount;
                    console.log(`🎁 Checking ${gift.title}: cart $${cartTotal} >= $${gift.trigger.amount}? ${conditionMet}`);
                } else if (gift.trigger?.type === 'minQuantity') {
                    // Count qualifying items based on buyProductSkus
                    const qualifyingQty = getQualifyingCount(gift);
                    const threshold = gift.trigger.quantity;
                    conditionMet = qualifyingQty >= threshold;

                    console.log(`🎁 Checking ${gift.title}: threshold=${threshold}, thresholdsNeedingSelection=${thresholdsNeedingSelection}`);

                    // Check if this threshold has multiple options
                    if (thresholdsNeedingSelection.includes(threshold)) {
                        // Multiple options at this threshold - MUST have explicit user selection
                        const userSelectedId = selectedRewards[threshold];
                        console.log(`🎁 Multiple options at threshold ${threshold}. User selected: ${userSelectedId}, this gift id: ${gift.id}`);

                        if (!userSelectedId) {
                            console.log(`🎁 NO USER SELECTION - skipping ${gift.title}`);
                            continue; // Skip - user hasn't selected yet
                        }
                        if (userSelectedId !== gift.id) {
                            console.log(`🎁 User selected different reward, skipping ${gift.title}`);
                            continue; // Skip - user selected a different option
                        }
                        console.log(`🎁 User explicitly selected ${gift.title}`);
                    }

                    console.log(`🎁 Checking ${gift.title}: qualifying qty ${qualifyingQty} >= ${threshold}? ${conditionMet}`);
                }

                // Add all free products if condition met
                if (conditionMet) {
                    // First, check which items need to be added
                    const itemsToAdd = gift.freeProducts.filter(freeProduct => {
                        if (!freeProduct.variantId) return false;
                        if (isInCart(freeProduct.variantId)) {
                            console.log('🎁 Free gift already in cart:', freeProduct.title);
                            return false;
                        }
                        return true;
                    });

                    // If all items already in cart, mark as processed
                    if (itemsToAdd.length === 0) {
                        console.log('🎁 All free gifts already in cart');
                        addedGifts.current.add(gift.id);
                        continue;
                    }

                    // Set lock before adding
                    isAddingGifts = true;

                    // Add items that aren't in cart (local cart — synchronous)
                    for (const freeProduct of itemsToAdd) {
                        console.log('🎁 Adding free gift:', freeProduct.title);
                        // Look up full product data for the local cart entry
                        const matchedProduct = products.find(p =>
                            p.id === freeProduct.id ||
                            p.shopifyId === freeProduct.id ||
                            p.variants?.some(v => v.id === freeProduct.variantId)
                        );
                        const matchedVariant = matchedProduct?.variants?.find(v => v.id === freeProduct.variantId)
                            || { id: freeProduct.variantId, title: freeProduct.title, price: { amount: '0' } };
                        localCart.addToCart(
                            matchedProduct || { id: freeProduct.id, title: freeProduct.title },
                            matchedVariant,
                            1,
                            [],
                            { isFreeGift: true, discountId: gift.id }
                        );
                        console.log('🎁 Free gift added successfully!');
                    }

                    addedGifts.current.add(gift.id);
                    isAddingGifts = false;
                    break; // Only process one discount at a time
                }
            }
        };

        // Only check if cart has items
        if (cartItems.length > 0) {
            checkFreeGifts();
        }
    }, [discounts, cartTotal, cartItems, localCart, isInCart, getFreeGiftDiscounts, selectedRewards, getQualifyingCount, products]);

    // Reset added gifts when cart is emptied
    useEffect(() => {
        if (cartItems.length === 0) {
            addedGifts.current.clear();
            previousSelectedRewards.current = {};
        }
    }, [cartItems.length]);

    // Handle swapping free items when user changes selection
    useEffect(() => {
        if (!discounts || !localCart?.removeByVariantId) return;

        const freeGifts = getFreeGiftDiscounts();

        // Check each threshold for selection changes
        Object.keys(selectedRewards).forEach((thresholdKey) => {
            // Skip non-numeric keys (like "3_showOptions")
            if (thresholdKey.includes('_')) return;

            const threshold = parseInt(thresholdKey);
            const newSelectedId = selectedRewards[threshold];
            const previousSelectedId = previousSelectedRewards.current[threshold];

            // If selection changed and there was a previous selection
            if (newSelectedId && previousSelectedId && newSelectedId !== previousSelectedId) {
                console.log(`🔄 Reward selection changed at threshold ${threshold}: ${previousSelectedId} -> ${newSelectedId}`);

                // Find the previous gift to get its variant IDs
                const previousGift = freeGifts.find(g => g.id === previousSelectedId);
                if (previousGift?.freeProducts) {
                    // Remove the old free items from cart by variantId
                    for (const freeProduct of previousGift.freeProducts) {
                        console.log(`🔄 Removing old free item: ${freeProduct.title}`);
                        localCart.removeByVariantId(freeProduct.variantId);
                        addedGifts.current.delete(previousSelectedId);
                    }
                }
            }

            // Update previous selection tracking
            if (newSelectedId) {
                previousSelectedRewards.current[threshold] = newSelectedId;
            }
        });
    }, [selectedRewards, discounts, cartItems, localCart, getFreeGiftDiscounts]);

    // Get applicable discounts for display in UI
    const getApplicableDiscounts = useCallback(() => {
        const freeGifts = getFreeGiftDiscounts();

        return freeGifts.map(gift => {
            if (gift.trigger?.type === 'minCartTotal') {
                const progress = (cartTotal / gift.trigger.amount) * 100;
                return {
                    ...gift,
                    triggerType: 'amount',
                    progress: Math.min(progress, 100),
                    unlocked: cartTotal >= gift.trigger.amount,
                    remaining: Math.max(0, gift.trigger.amount - cartTotal),
                    threshold: gift.trigger.amount
                };
            } else if (gift.trigger?.type === 'minQuantity') {
                // Count qualifying items based on buyProductSkus
                const qualifyingQuantity = getQualifyingCount(gift);
                const requiredQty = gift.trigger.quantity;
                const progress = (qualifyingQuantity / requiredQty) * 100;
                return {
                    ...gift,
                    triggerType: 'quantity',
                    progress: Math.min(progress, 100),
                    unlocked: qualifyingQuantity >= requiredQty,
                    remaining: Math.max(0, requiredQty - qualifyingQuantity),
                    currentQuantity: qualifyingQuantity,
                    requiredQuantity: requiredQty,
                    threshold: requiredQty
                };
            }
            return { ...gift, triggerType: 'unknown' };
        });
    }, [getFreeGiftDiscounts, cartTotal, getQualifyingCount]);

    // Group quantity-based discounts by threshold for reward selection UI
    const getQuantityDiscountsByThreshold = useCallback(() => {
        const applicableDiscounts = getApplicableDiscounts();
        const quantityDiscounts = applicableDiscounts.filter(d => d.triggerType === 'quantity');

        // Group by threshold
        const grouped = {};
        quantityDiscounts.forEach(discount => {
            const threshold = discount.threshold;
            if (!grouped[threshold]) {
                grouped[threshold] = {
                    threshold,
                    requiredQuantity: discount.requiredQuantity,
                    currentQuantity: discount.currentQuantity,
                    progress: discount.progress,
                    unlocked: discount.unlocked,
                    remaining: discount.remaining,
                    options: []
                };
            }
            grouped[threshold].options.push({
                id: discount.id,
                title: discount.title,
                freeProducts: discount.freeProducts,
                freeProduct: discount.freeProduct
            });
        });

        // Convert to array and sort by threshold
        return Object.values(grouped).sort((a, b) => a.threshold - b.threshold);
    }, [getApplicableDiscounts]);

    return {
        discounts,
        loading,
        error,
        freeGiftDiscounts: getFreeGiftDiscounts(),
        orderDiscounts: getOrderDiscounts(),
        getApplicableDiscounts,
        getQuantityDiscountsByThreshold,
        getAppDiscounts,
        getOrderDiscounts,
        isDiscountActive,
        cartTotal,
        cartQuantity: cartItems.reduce((sum, item) => sum + item.quantity, 0)
    };
};

export default useDiscounts;
