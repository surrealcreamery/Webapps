import { useState, useEffect, useCallback, useRef } from 'react';

const DISCOUNTS_URL = 'https://data.surrealcreamery.com/discounts.json';
const SHOPIFY_DOMAIN = 'surreal-9940.myshopify.com';
const STOREFRONT_ACCESS_TOKEN = 'b826d9dc5dacd8d58a91e1de899e2c9a';

// Module-level lock to prevent duplicate adds across re-renders
let isAddingGifts = false;

/**
 * Hook to fetch and manage discounts from static JSON
 * Auto-adds free gifts when conditions are met
 * @param {Object} checkout - Shopify checkout object
 * @param {Function} addToCart - Function to add items to cart
 * @param {Function} removeFromCart - Function to remove items from cart
 * @param {Object} selectedRewards - User's selected rewards { [threshold]: discountId }
 * @param {Array} products - Shopify products array (for identifying blind boxes)
 */
export const useDiscounts = (checkout, addToCart, removeFromCart, selectedRewards = {}, products = []) => {
    const [discounts, setDiscounts] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const addedGifts = useRef(new Set()); // Track which gifts we've already added
    const previousSelectedRewards = useRef({}); // Track previous selections for swap logic
    const [qualifyingProductIds, setQualifyingProductIds] = useState({}); // { collectionHandle: [productIds] }

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
                console.log('🔍 Looking for order discounts (percentage off)...');
                data.forEach((d, i) => {
                    console.log(`  [${i}] ${d.discount?.title} - status: ${d.discount?.status}, percentage: ${d.discount?.customerGets?.value?.percentage}, minReq: ${d.discount?.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount}, customerBuys: ${d.discount?.customerBuys?.value?.amount}`);
                });
                setDiscounts(data);
            } catch (err) {
                console.error('Error fetching discounts:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDiscounts();
    }, []);

    // Fetch products from a collection by handle
    const fetchCollectionProducts = useCallback(async (collectionHandle) => {
        try {
            const query = `
                query getCollectionProducts($handle: String!) {
                    collection(handle: $handle) {
                        products(first: 100) {
                            edges {
                                node {
                                    id
                                }
                            }
                        }
                    }
                }
            `;

            const response = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN
                },
                body: JSON.stringify({ query, variables: { handle: collectionHandle } })
            });

            const { data } = await response.json();
            const productIds = data?.collection?.products?.edges?.map(e => e.node.id) || [];
            console.log(`🎁 Fetched ${productIds.length} products from collection "${collectionHandle}"`);
            return productIds;
        } catch (err) {
            console.error(`Failed to fetch collection "${collectionHandle}":`, err);
            return [];
        }
    }, []);

    // Load qualifying products when discounts change
    useEffect(() => {
        if (!discounts) return;

        const loadQualifyingProducts = async () => {
            const newQualifyingIds = {};

            for (const d of discounts) {
                const collections = d.discount?.customerBuys?.items?.collections;
                if (collections?.length) {
                    for (const col of collections) {
                        if (col.handle && !qualifyingProductIds[col.handle]) {
                            const productIds = await fetchCollectionProducts(col.handle);
                            newQualifyingIds[col.handle] = productIds;
                        }
                    }
                }
            }

            if (Object.keys(newQualifyingIds).length > 0) {
                setQualifyingProductIds(prev => ({ ...prev, ...newQualifyingIds }));
            }
        };

        loadQualifyingProducts();
    }, [discounts, fetchCollectionProducts]);

    // Get cart total
    const cartTotal = parseFloat(checkout?.subtotalPrice?.amount || 0);
    
    // Get cart items
    const cartItems = checkout?.lineItems || [];
    
    // Check if a variant is already in cart
    const isInCart = useCallback((variantId) => {
        return cartItems.some(item => item.variant?.id === variantId);
    }, [cartItems]);

    // Count cart items that qualify for a discount based on its collection requirements
    const getQualifyingCount = useCallback((discount) => {
        if (!cartItems.length) return 0;

        // Get qualifying collection handles from the discount
        const collections = discount?.customerBuys?.items?.collections || [];
        const qualifyingCollectionHandles = collections.map(c => c.handle);

        // If no specific collection, count all items (shouldn't happen for BXGY)
        if (qualifyingCollectionHandles.length === 0) {
            return cartItems.reduce((sum, item) => sum + item.quantity, 0);
        }

        // Get all qualifying product IDs from the collections
        const allQualifyingIds = new Set();
        qualifyingCollectionHandles.forEach(handle => {
            const productIds = qualifyingProductIds[handle] || [];
            productIds.forEach(id => allQualifyingIds.add(id));
        });

        // If we haven't loaded the collection products yet, return 0
        if (allQualifyingIds.size === 0) {
            console.log('🎁 No qualifying product IDs loaded yet');
            return 0;
        }

        // Count cart items that match qualifying products
        return cartItems.reduce((count, item) => {
            const productId = item.variant?.product?.id;
            if (productId && allQualifyingIds.has(productId)) {
                return count + item.quantity;
            }
            return count;
        }, 0);
    }, [cartItems, qualifyingProductIds]);

    // Parse app discounts (like DealEasy)
    const getAppDiscounts = useCallback(() => {
        if (!discounts || !Array.isArray(discounts)) return [];
        
        return discounts
            .filter(d => d.discount?.appDiscountType)
            .map(d => ({
                id: d.id,
                title: d.discount.title,
                status: d.discount.status,
                startsAt: d.discount.startsAt,
                endsAt: d.discount.endsAt,
                appType: d.discount.appDiscountType?.title,
                targetType: d.discount.appDiscountType?.targetType,
                isActive: d.discount.status === 'ACTIVE'
            }));
    }, [discounts]);

    // Parse order percentage discounts (e.g., "10% off orders over $20")
    // Handles DiscountAutomaticBasic (Order Discounts) with minimumRequirement
    const getOrderDiscounts = useCallback(() => {
        if (!discounts || !Array.isArray(discounts)) return [];

        console.log('🔍 Parsing order discounts from:', discounts.length, 'discounts');

        const result = discounts
            .filter(d => {
                // Must be active
                if (d.discount?.status !== 'ACTIVE') {
                    console.log('  ❌ Skipping inactive:', d.discount?.title);
                    return false;
                }

                // Check for percentage discount at customerGets.value.percentage (Order Discount)
                // NOT customerGets.value.effect.percentage (that's Buy X Get Y)
                const percentage = d.discount?.customerGets?.value?.percentage;

                // Skip if no percentage or if it's 100% (free item, not a % off discount)
                if (percentage === undefined || percentage === null || percentage === 1) {
                    console.log('  ❌ Skipping (no percentage or 100% off):', d.discount?.title, 'percentage:', percentage);
                    return false;
                }

                // Must have minimumRequirement (Order Discount structure) OR customerBuys quantity
                const minAmount = d.discount?.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount;
                const minQuantity = d.discount?.customerBuys?.value?.quantity;
                if (!minAmount && !minQuantity) {
                    console.log('  ❌ Skipping (no minimumRequirement or quantity):', d.discount?.title);
                    return false;
                }

                console.log('  ✅ Found order discount:', d.discount?.title, 'percentage:', percentage, 'threshold:', minAmount, 'quantityThreshold:', minQuantity);
                return true;
            })
            .map(d => {
                const discount = d.discount;
                const percentage = discount.customerGets?.value?.percentage || 0;
                const minAmount = parseFloat(discount.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount || 0);
                const minQuantity = parseInt(discount.customerBuys?.value?.quantity || 0);

                return {
                    id: d.id,
                    title: discount.title,
                    status: discount.status,
                    startsAt: discount.startsAt,
                    endsAt: discount.endsAt,
                    percentOff: Math.round(percentage * 100), // 0.1 -> 10
                    threshold: minAmount,
                    quantityThreshold: minQuantity, // Quantity-based threshold (e.g., "Buy 2+")
                    isActive: discount.status === 'ACTIVE'
                };
            });

        console.log('🎯 Order discounts result:', result);
        return result;
    }, [discounts]);

    // Check if a specific discount is active by title (partial match)
    // Checks ALL discount types, not just app discounts
    const isDiscountActive = useCallback((titleSearch) => {
        if (!discounts || !Array.isArray(discounts)) return false;
        
        return discounts.some(d => 
            d.discount?.status === 'ACTIVE' && 
            d.discount?.title?.toLowerCase().includes(titleSearch.toLowerCase())
        );
    }, [discounts]);

    // Parse free gift discounts from Shopify format
    const getFreeGiftDiscounts = useCallback(() => {
        if (!discounts || !Array.isArray(discounts)) return [];
        
        return discounts
            .filter(d => {
                // Must be active
                if (d.discount?.status !== 'ACTIVE') return false;
                // Must be 100% off (free) - percentage of 1 = 100% off
                if (d.discount?.customerGets?.value?.effect?.percentage !== 1) return false;
                // Must have products or productVariants to give
                const items = d.discount?.customerGets?.items;
                if (!items?.products?.length && !items?.productVariants?.length) return false;
                return true;
            })
            .map(d => {
                const discount = d.discount;
                const items = discount.customerGets.items;
                
                // Collect all free products/variants
                const freeProducts = [];
                
                // Add products
                if (items.products?.length) {
                    items.products.forEach(p => {
                        freeProducts.push({
                            id: p.id,
                            title: p.title,
                            variantId: p.variants?.[0]?.id
                        });
                    });
                }
                
                // Add productVariants
                if (items.productVariants?.length) {
                    items.productVariants.forEach(v => {
                        freeProducts.push({
                            id: v.product?.id || v.id,
                            title: v.product?.title || v.title,
                            variantId: v.id,
                            variantTitle: v.title
                        });
                    });
                }
                
                // Determine trigger type
                const buyValue = discount.customerBuys?.value;
                let trigger = null;
                
                if (buyValue?.amount) {
                    trigger = {
                        type: 'minCartTotal',
                        amount: parseFloat(buyValue.amount)
                    };
                } else if (buyValue?.quantity) {
                    trigger = {
                        type: 'minQuantity',
                        quantity: parseInt(buyValue.quantity)
                    };
                }
                
                return {
                    id: d.id,
                    title: discount.title,
                    status: discount.status,
                    startsAt: discount.startsAt,
                    endsAt: discount.endsAt,
                    trigger,
                    freeProducts, // Array of all free products
                    freeProduct: freeProducts[0], // Keep for backward compatibility
                    customerBuys: discount.customerBuys // Include qualifying items info
                };
            });
    }, [discounts]);

    // Check and auto-add free gifts
    useEffect(() => {
        if (!discounts || !addToCart) return;
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
                    // Count qualifying items based on discount's collection requirements
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
                    
                    // Add items that aren't in cart
                    for (const freeProduct of itemsToAdd) {
                        console.log('🎁 Adding free gift:', freeProduct.title);
                        try {
                            await addToCart(freeProduct.variantId, 1);
                            console.log('🎁 Free gift added successfully!');
                        } catch (err) {
                            console.error('🎁 Error adding free gift:', err);
                        }
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
    }, [discounts, cartTotal, cartItems, addToCart, isInCart, getFreeGiftDiscounts, selectedRewards, getQualifyingCount]);

    // Reset added gifts when cart is emptied
    useEffect(() => {
        if (cartItems.length === 0) {
            addedGifts.current.clear();
            previousSelectedRewards.current = {};
        }
    }, [cartItems.length]);

    // Handle swapping free items when user changes selection
    useEffect(() => {
        if (!discounts || !removeFromCart) return;

        const freeGifts = getFreeGiftDiscounts();

        // Check each threshold for selection changes
        Object.keys(selectedRewards).forEach(async (thresholdKey) => {
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
                    // Find and remove the old free items from cart
                    for (const freeProduct of previousGift.freeProducts) {
                        const variantId = freeProduct.variantId;
                        // Find the line item in cart with this variant
                        const lineItem = cartItems.find(item => item.variant?.id === variantId);
                        if (lineItem) {
                            console.log(`🔄 Removing old free item: ${freeProduct.title}`);
                            try {
                                await removeFromCart(lineItem.id);
                                // Clear from addedGifts so the new one can be added
                                addedGifts.current.delete(previousSelectedId);
                            } catch (err) {
                                console.error('🔄 Error removing old free item:', err);
                            }
                        }
                    }
                }
            }

            // Update previous selection tracking
            if (newSelectedId) {
                previousSelectedRewards.current[threshold] = newSelectedId;
            }
        });
    }, [selectedRewards, discounts, cartItems, removeFromCart, getFreeGiftDiscounts]);

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
                // Count qualifying items based on discount's collection requirements
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
