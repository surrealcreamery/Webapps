import React, { useContext, useEffect, useRef, useLayoutEffect, useState, useMemo } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, Container, Grid, Card, CardMedia, CardContent, Modal, IconButton } from '@mui/material';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { useShopify } from '@/contexts/commerce/ShopifyContext_GraphQL';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';

// Import components
import { Section } from '@/components/commerce/Section';
import { ProductModal } from '@/components/commerce/ProductModal';
import { CartDrawer } from '@/components/commerce/CartDrawer';
import { useDiscounts } from '@/components/commerce/useDiscounts';
import { BlindBoxProgressIndicator } from '@/components/commerce/BlindBoxProgressIndicator';
import { DiscountZonePlaceholder } from '@/components/commerce/DiscountZonePlaceholder';

// Placeholder image for variants without images
const PLACEHOLDER_IMAGE = 'https://placehold.co/400x400/e0e0e0/666666?text=No+Image';

// Module-level variable to persist scroll position across navigations
let pendingScrollRestore = null;

// ===========================================
// DISCOUNT CONFIGURATION
// Values are now pulled dynamically from discounts.json
// ===========================================

// Reward thresholds configuration
// Free gift thresholds are now pulled dynamically from useDiscounts hook
// Free shipping threshold is kept here (could also be moved to Shopify metafields)
const REWARDS_CONFIG = {
    freeShipping: {
        threshold: 75,
        icon: 'shipping',
        title: 'Free Shipping',
        unlockedMessage: 'Free shipping unlocked!'
    }
};

/**
 * Commerce Homepage
 * Focuses on hero content, featured products, and new releases
 * Full product catalog moved to /directory
 */
export default function Commerce() {
    const { commerceState, sendToCommerce } = useContext(LayoutContext);
    const { products: shopifyProducts, loading: shopifyLoading, error: shopifyError, addToCart, removeFromCart, categories, dessertSubcategories, merchandiseSubcategories, getCartCount, checkout } = useShopify();
    
    // State for reward selection (for quantity-based discounts with multiple options)
    const [selectedRewards, setSelectedRewards] = useState({});
    
    // Handle selecting a reward at a threshold
    const handleSelectReward = (threshold, discountId) => {
        setSelectedRewards(prev => ({
            ...prev,
            [threshold]: discountId
        }));
    };
    
    const { freeGiftDiscounts, orderDiscounts, getApplicableDiscounts, getQuantityDiscountsByThreshold, isDiscountActive, loading: discountsLoading } = useDiscounts(checkout, addToCart, removeFromCart, selectedRewards, shopifyProducts);
    
    // Get quantity-based discounts grouped by threshold
    const quantityDiscountGroups = getQuantityDiscountsByThreshold ? getQuantityDiscountsByThreshold() : [];
    
    // Clear selected rewards when cart becomes empty
    useEffect(() => {
        const cartCount = checkout?.lineItems?.length || 0;
        if (cartCount === 0) {
            setSelectedRewards({});
            sessionStorage.removeItem('selectedRewards');
        }
    }, [checkout?.lineItems?.length]);
    
    // Debug: Log order discounts
    useEffect(() => {
        console.log('📊 Order discounts:', orderDiscounts);
        console.log('📊 Active order discount:', orderDiscounts?.find(d => d.isActive));
    }, [orderDiscounts]);
    
    // Check if an order percentage discount is active (for blind box and other promotions)
    // This replaces the old "Blind Box Collector" specific discount check
    // Now uses the "10% Off Orders Over $20" native discount
    const activeOrderPercentDiscount = orderDiscounts?.find(d => d.isActive);
    const isBlindBoxDiscountActive = discountsLoading ? true : !!activeOrderPercentDiscount;
    
    // Get discount percentage and quantity threshold from discounts file (no fallbacks - only show if data exists)
    const BLIND_BOX_DISCOUNT_PERCENT = activeOrderPercentDiscount?.percentOff;
    const BLIND_BOX_QUANTITY_THRESHOLD = activeOrderPercentDiscount?.quantityThreshold;
    const hasBlindBoxDiscount = !!(BLIND_BOX_DISCOUNT_PERCENT && BLIND_BOX_QUANTITY_THRESHOLD);
    
    const navigate = useNavigate();
    const location = useLocation();
    const { productId } = useParams();
    
    // Blind box selector modal state
    const [showBlindBoxSelector, setShowBlindBoxSelector] = useState(false);
    
    // Determine what to show based on route
    const currentPath = location.pathname;
    const isHomepage = currentPath === '/';
    
    // Dynamic category detection from API
    // Extract category handle from path (e.g., "/desserts" -> "desserts")
    const pathCategory = currentPath.startsWith('/') ? currentPath.slice(1).split('/')[0] : '';
    const currentCategory = categories?.find(c => c.handle === pathCategory || c.id === pathCategory);
    const isCategoryPage = !!currentCategory;
    
    // Legacy aliases for backward compatibility
    const isDesserts = currentCategory?.handle === 'desserts';
    const isMerchandise = currentCategory?.handle === 'merchandise';
    
    // Flag to skip scroll-to-top when returning from product modal
    const skipScrollToTop = useRef(false);
    
    // Scroll to top when navigating to category pages (but not when returning from modal)
    useEffect(() => {
        if (skipScrollToTop.current) {
            skipScrollToTop.current = false;
            return;
        }
        if (isCategoryPage || isHomepage) {
            window.scrollTo(0, 0);
        }
    }, [currentPath, isCategoryPage, isHomepage]);
    
    // Get UI state from machine
    const showProductModal = commerceState.context.showProductModal;
    const selectedProductId = commerceState.context.selectedProductId;
    const showCartDrawer = commerceState.context.showCartDrawer;
    
    // Added to cart view state - restore from sessionStorage if available
    const [showAddedToCart, setShowAddedToCart] = useState(() => {
        try {
            const saved = sessionStorage.getItem('addedToCart');
            console.log('📦 [INIT] sessionStorage addedToCart:', saved);
            if (saved) {
                const parsed = JSON.parse(saved);
                console.log('📦 [INIT] Parsed - show:', parsed.show, 'hasProduct:', !!parsed.product, 'productName:', parsed.product?.name);
                return parsed.show;
            }
            return false;
        } catch (e) {
            console.error('Error parsing addedToCart from sessionStorage:', e);
            sessionStorage.removeItem('addedToCart');
            return false;
        }
    });
    const [addedProduct, setAddedProduct] = useState(() => {
        try {
            const saved = sessionStorage.getItem('addedToCart');
            const product = saved ? JSON.parse(saved).product : null;
            console.log('📦 [INIT] addedProduct:', product?.name || 'null');
            return product;
        } catch (e) {
            return null;
        }
    });
    const [addedVariant, setAddedVariant] = useState(() => {
        try {
            const saved = sessionStorage.getItem('addedToCart');
            return saved ? JSON.parse(saved).variant : null;
        } catch (e) {
            return null;
        }
    });
    const [addedQuantity, setAddedQuantity] = useState(() => {
        try {
            const saved = sessionStorage.getItem('addedToCart');
            return saved ? JSON.parse(saved).quantity : 1;
        } catch (e) {
            return 1;
        }
    });
    
    // Refs for tracking navigation intent
    const prevPathRef = useRef(currentPath);
    const intentionalCrossSell = useRef(false); // Track intentional cross-sell navigation
    const returningFromAddToCart = useRef(false); // Track if returning from add-to-cart (don't clear AddedToCart)
    
    // Clear added-to-cart view when navigating to main category pages
    // This ensures clicking category pages shows the normal page, not cross-sell
    // The cross-sell should only show when triggered by specific banners (handleReturnToCrossSell)
    useEffect(() => {
        const prevPath = prevPathRef.current;
        prevPathRef.current = currentPath;
        
        // Skip if this is an intentional cross-sell navigation or returning from add-to-cart
        if (intentionalCrossSell.current) {
            intentionalCrossSell.current = false;
            return;
        }
        if (returningFromAddToCart.current) {
            returningFromAddToCart.current = false;
            return;
        }
        
        // If path changed TO a category page, clear the added-to-cart view
        // This handles: URL bar navigation, header nav links, browser back/forward
        if (prevPath !== currentPath && (isCategoryPage || isHomepage)) {
            if (showAddedToCart) {
                console.log('🧭 Route changed to category page - clearing cross-sell view');
                setShowAddedToCart(false);
                setAddedProduct(null);
                setAddedVariant(null);
                setAddedQuantity(1);
                sessionStorage.removeItem('addedToCart');
            }
        }
    }, [currentPath, isCategoryPage, isHomepage, showAddedToCart]);
    
    // Handle browser back/forward cache (bfcache) restoration
    // When user returns from Shopify checkout, browser might restore page from cache
    useEffect(() => {
        const handlePageShow = (event) => {
            if (event.persisted) {
                console.log('📄 Page restored from bfcache - checking sessionStorage');
                try {
                    const saved = sessionStorage.getItem('addedToCart');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        console.log('📄 Restoring state from sessionStorage after bfcache:', parsed);
                        setShowAddedToCart(parsed.show);
                        setAddedProduct(parsed.product);
                        setAddedVariant(parsed.variant);
                        setAddedQuantity(parsed.quantity);
                    }
                } catch (e) {
                    console.error('Error restoring from bfcache:', e);
                }
            }
        };
        
        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, []);
    
    // Listen for clearAddedToCart event from menu navigation
    useEffect(() => {
        const handleClearAddedToCart = () => {
            console.log('🧹 Clearing AddedToCart state from menu navigation');
            setShowAddedToCart(false);
            setAddedProduct(null);
            setAddedVariant(null);
            setAddedQuantity(1);
        };
        
        window.addEventListener('clearAddedToCart', handleClearAddedToCart);
        return () => window.removeEventListener('clearAddedToCart', handleClearAddedToCart);
    }, []);
    
    // Persist addedToCart state to sessionStorage (but don't clear on first render)
    const hasPersistedOnce = useRef(false);
    useEffect(() => {
        if (showAddedToCart && addedProduct) {
            console.log('💾 Persisting AddedToCart to sessionStorage');
            sessionStorage.setItem('addedToCart', JSON.stringify({
                show: true,
                product: addedProduct,
                variant: addedVariant,
                quantity: addedQuantity
            }));
            hasPersistedOnce.current = true;
        } else if (hasPersistedOnce.current) {
            // Only clear if we've persisted at least once (prevents clearing on initial load)
            console.log('🗑️ Clearing AddedToCart from sessionStorage');
            sessionStorage.removeItem('addedToCart');
        }
    }, [showAddedToCart, addedProduct, addedVariant, addedQuantity]);
    
    // Navigation effect is simplified - we no longer auto-clear on URL changes
    // Instead, we only clear AddedToCart state when:
    // 1. User clicks "Continue Shopping" (handleCloseAddedToCart)
    // 2. User adds a new product to cart (handleAddToCart replaces state)
    // This allows browser back from checkout to restore the AddedToCart view
    useEffect(() => {
        console.log('🔄 Navigation Effect (simplified):', {
            currentPath,
            showAddedToCart,
            hasAddedProduct: !!addedProduct,
            isHomepage,
            isDesserts,
            isMerchandise
        });
    }, [currentPath, showAddedToCart, addedProduct, isDesserts, isMerchandise, isHomepage]);
    
    // If showAddedToCart is true but product is missing (e.g., after refresh), reset to normal view
    // But skip on first render to allow sessionStorage restoration
    const resetEffectFirstRender = useRef(true);
    useEffect(() => {
        if (resetEffectFirstRender.current) {
            resetEffectFirstRender.current = false;
            console.log('🔄 Reset effect - skipping first render');
            return;
        }
        if (showAddedToCart && !addedProduct) {
            console.log('⚠️ showAddedToCart is true but no addedProduct - resetting');
            setShowAddedToCart(false);
        }
    }, [showAddedToCart, addedProduct]);
    
    // Debug: Log render state
    useEffect(() => {
        console.log('🎨 Render State:', {
            showAddedToCart,
            hasAddedProduct: !!addedProduct,
            isHomepage,
            isDesserts,
            isMerchandise,
            productId,
            willShowAddedToCart: showAddedToCart && addedProduct,
            willShowHomepage: !showAddedToCart && isHomepage,
            willShowDesserts: !showAddedToCart && isDesserts,
            willShowMerchandise: !showAddedToCart && isMerchandise,
            willShowProductFallback: !showAddedToCart && !isHomepage && !isDesserts && !isMerchandise && productId
        });
    }, [showAddedToCart, addedProduct, isHomepage, isDesserts, isMerchandise, productId]);
    
    const isInternalNavigation = useRef(false);
    const returnPath = useRef(null); // Track where to return when closing modal (null = direct visit)
    const savedScrollPosition = useRef(0); // Track scroll position to restore when closing modal
    const selectedVariantInfo = useRef(null); // Track selected variant info for modal
    const returningFromProductModal = useRef(false); // Track if returning from modal (don't clear AddedToCart)
    const isFirstRender = useRef(true); // Track first render (don't clear AddedToCart on page load/refresh)
    
    // Restore scroll position BEFORE browser paints (runs synchronously after DOM update)
    // This prevents visible scrolling animation when:
    // - Closing product modal (returns to saved position)
    // - Adding to cart (goes to top to show banner + recommendations)
    useLayoutEffect(() => {
        if (pendingScrollRestore !== null && !productId) {
            window.scrollTo({ top: pendingScrollRestore, behavior: 'instant' });
            pendingScrollRestore = null;
        }
    }, [productId]);
    
    // Scroll is handled by useLayoutEffect above - no visible animation
    
    // Handle product URL
    useEffect(() => {
        if (productId) {
            const navigationType = performance.getEntriesByType('navigation')[0]?.type;
            const isRefresh = navigationType === 'reload';
            
            if (isInternalNavigation.current) {
                sendToCommerce({ type: 'VIEW_PRODUCT', productId });
                isInternalNavigation.current = false;
            } else if (!isRefresh) {
                sendToCommerce({ type: 'VIEW_PRODUCT', productId });
            }
        }
    }, [productId, sendToCommerce]);
    
    // Handle closing product modal
    const handleCloseProductModal = () => {
        sendToCommerce({ type: 'CLOSE_PRODUCT' });
        
        // Navigate back to where the user came from
        if (productId) {
            // Set pending scroll restore BEFORE navigation
            pendingScrollRestore = savedScrollPosition.current;
            
            // Skip the scroll-to-top effect when returning from modal
            skipScrollToTop.current = true;
            
            // Mark that we're returning from modal (don't clear AddedToCart state)
            if (showAddedToCart) {
                returningFromProductModal.current = true;
                returningFromAddToCart.current = true;
            }
            
            // If returnPath is null (direct URL visit), determine from product category
            if (!returnPath.current) {
                const product = shopifyProducts.find(p => p.id === productId);
                const productCategory = product?.category;
                
                // Navigate to the product's category page
                if (productCategory) {
                    navigate(`/${productCategory}`, { replace: true });
                } else {
                    navigate('/', { replace: true });
                }
            } else {
                navigate(returnPath.current, { replace: true });
            }
            
            // Reset refs for next product view
            returnPath.current = null;
            savedScrollPosition.current = 0;
            selectedVariantInfo.current = null;
        }
    };
    
    // Handle product selection
    const handleChooseProduct = (productId) => {
        // Ensure productId is a string, not an object
        const id = typeof productId === 'string' ? productId : productId?.id || String(productId);
        
        console.log('🖱️ Product clicked:', id);
        
        // Save current path and scroll position to restore when modal closes
        returnPath.current = location.pathname + location.search;
        savedScrollPosition.current = window.scrollY;
        
        // Check if this is a variant product (has compound ID)
        let lookupId = id;
        selectedVariantInfo.current = null; // Reset variant info
        
        // Match compound IDs: product-subcat-container or legacy -variant- / -subcat-
        const variantProduct = displayProducts.find(p => p.id === id);
        if (variantProduct?.originalProductId) {
            lookupId = variantProduct.originalProductId;
            // Save variant-specific info for the modal
            selectedVariantInfo.current = {
                name: variantProduct.name,
                price: variantProduct.price,
                variantId: variantProduct.variantId,
                variantTitle: variantProduct.variantTitle,
                imageUrl: variantProduct.imageUrl,
                imageAlt: variantProduct.imageAlt,
                variantOptions: variantProduct.variantOptions,
                sizeOptions: variantProduct.sizeOptions,
                container: variantProduct.container,
                containerData: variantProduct.containerData,
                // For grouped products, pass all variants for selection
                availableVariants: variantProduct.availableVariants || variantProduct.variants || null
            };
            console.log('🔄 Product clicked, using original product:', lookupId);
            console.log('🎯 Saved variant info:', selectedVariantInfo.current);
        }
        
        console.log('📦 Available products:', shopifyProducts.length);
        console.log('🔍 Looking up product:', lookupId);
        
        isInternalNavigation.current = true;
        sendToCommerce({ type: 'VIEW_PRODUCT', productId: lookupId });
        navigate(`/product/${lookupId}`, { replace: false });
    };
    
    // Handle add to cart
    const handleAddToCart = async (productId, variantId, quantity = 1, customAttributes = []) => {
        console.log('🛒 handleAddToCart called:', { productId, variantId, quantity, customAttributes });
        try {
            await addToCart(variantId, quantity, customAttributes);
            console.log('✅ Added to cart');
            
            // Find the product and variant info
            const product = shopifyProducts.find(p => p.id === productId);
            const variant = product?.variants?.find(v => v.id === variantId) || product?.variants?.[0];
            
            // Close the modal via state machine
            sendToCommerce({ type: 'CLOSE_PRODUCT' });
            
            // Set added to cart view state
            setAddedProduct(product);
            setAddedVariant(variant);
            setAddedQuantity(quantity);
            setShowAddedToCart(true);
            
            // Mark that we're navigating programmatically (don't clear AddedToCart state)
            returningFromProductModal.current = true;
            returningFromAddToCart.current = true;
            
            // Navigate away from /product/xyz URL so browser back works correctly
            // Use the product's category to determine where to go
            const productCategory = product?.category;
            if (productCategory) {
                navigate(`/${productCategory}`, { replace: true });
            } else {
                navigate('/', { replace: true });
            }
            
            // Scroll to top to show the added to cart view
            window.scrollTo(0, 0);
            
            console.log('📤 Showing AddedToCart view');
            
            // Reset refs for next product view
            returnPath.current = null;
            savedScrollPosition.current = 0;
            selectedVariantInfo.current = null;
        } catch (error) {
            console.error('❌ Error adding to cart:', error);
        }
    };
    
    // Handle closing added to cart view
    const handleCloseAddedToCart = () => {
        setShowAddedToCart(false);
        setAddedProduct(null);
        setAddedVariant(null);
        setAddedQuantity(1);
        sessionStorage.removeItem('addedToCart');
    };
    
    // Get all available blind boxes (excluding the one just added)
    const getAvailableBlindBoxes = useMemo(() => {
        return shopifyProducts.filter(p => 
            p.merchandiseType === 'blind_box_collectible' && 
            p.id !== addedProduct?.id
        );
    }, [shopifyProducts, addedProduct]);
    
    // Count blind boxes in cart
    const blindBoxesInCart = useMemo(() => {
        console.log('🎁 Blind box count - checkout:', checkout);
        console.log('🎁 Blind box count - lineItems:', checkout?.lineItems);
        
        if (!checkout?.lineItems) return 0;
        
        return checkout.lineItems.reduce((count, item) => {
            // Check if this item is a blind box
            const variantId = item.variant?.id;
            const matchedProduct = shopifyProducts.find(p => 
                p.variantId === variantId || 
                p.variants?.some(v => v.id === variantId)
            );
            
            console.log('🎁 Checking item:', item.title, 'variantId:', variantId, 'matched:', matchedProduct?.merchandiseType);
            
            if (matchedProduct?.merchandiseType === 'blind_box_collectible') {
                return count + item.quantity;
            }
            return count;
        }, 0);
    }, [checkout?.lineItems, shopifyProducts]);

    // Calculate how many more blind boxes needed for discount (dynamic, no hardcoding)
    const blindBoxesNeededForDiscount = hasBlindBoxDiscount ? Math.max(0, BLIND_BOX_QUANTITY_THRESHOLD - blindBoxesInCart) : 0;

    // Get blind box items from cart with product details and discount info
    const blindBoxCartItems = useMemo(() => {
        if (!checkout?.lineItems) return [];
        
        const items = [];
        checkout.lineItems.forEach(item => {
            const variantId = item.variant?.id;
            const matchedProduct = shopifyProducts.find(p => 
                p.variantId === variantId || 
                p.variants?.some(v => v.id === variantId)
            );
            
            if (matchedProduct?.merchandiseType === 'blind_box_collectible') {
                // Get price and discount info from checkout
                const originalPrice = parseFloat(item.variant?.price?.amount || item.variant?.price || matchedProduct?.price?.replace(/[^0-9.]/g, '') || 0);
                
                // Calculate per-item discount (total discount divided by quantity)
                const discountAllocations = item.discountAllocations || [];
                const totalDiscount = discountAllocations.reduce((sum, alloc) => {
                    const amount = parseFloat(alloc.allocatedAmount?.amount || alloc.amount?.amount || 0);
                    return sum + amount;
                }, 0);
                const perItemDiscount = totalDiscount / item.quantity;
                const discountedPrice = originalPrice - perItemDiscount;
                const hasDiscount = perItemDiscount > 0;
                const discountPercent = hasDiscount ? Math.round((perItemDiscount / originalPrice) * 100) : 0;
                
                // Add one entry per quantity
                for (let i = 0; i < item.quantity; i++) {
                    items.push({
                        id: `${item.id}-${i}`,
                        product: matchedProduct,
                        variant: item.variant,
                        title: item.title,
                        imageUrl: item.variant?.image?.src || matchedProduct?.imageUrl || matchedProduct?.images?.[0]?.url,
                        originalPrice: originalPrice,
                        discountedPrice: discountedPrice,
                        hasDiscount: hasDiscount,
                        discountPercent: discountPercent
                    });
                }
            }
        });
        
        // Reverse so newest items appear last (Shopify adds new items at beginning)
        items.reverse();
        
        console.log('🎁 Blind box cart items:', items);
        return items;
    }, [checkout?.lineItems, shopifyProducts]);
    
    // Check if the added product is a blind box
    const isBlindBoxAdded = addedProduct?.merchandiseType === 'blind_box_collectible';
    
    // Check if discount is unlocked (dynamic threshold from discounts file)
    const isDiscountUnlocked = hasBlindBoxDiscount && blindBoxesInCart >= BLIND_BOX_QUANTITY_THRESHOLD;
    
    // Calculate progress toward rewards
    const cartTotal = parseFloat(checkout?.subtotalPrice?.amount || 0);
    
    // Get dynamic free gift discounts
    const applicableDiscounts = getApplicableDiscounts();
    const activeFreeGift = applicableDiscounts.find(d => d.trigger?.type === 'minCartTotal');
    
    const shippingProgress = useMemo(() => {
        const threshold = REWARDS_CONFIG.freeShipping.threshold;
        const progress = Math.min((cartTotal / threshold) * 100, 100);
        const remaining = Math.max(threshold - cartTotal, 0);
        const unlocked = cartTotal >= threshold;
        return { progress, remaining, unlocked, threshold };
    }, [cartTotal]);
    
    // Find active order discount (e.g., "10% off orders over $20")
    const activeOrderDiscount = orderDiscounts?.find(d => d.isActive && d.threshold <= (activeFreeGift?.trigger?.amount || 20));
    
    const giftProgress = useMemo(() => {
        // Use dynamic threshold from discounts JSON, fallback to shipping threshold if no gift discount
        const threshold = activeFreeGift?.trigger?.amount || activeOrderDiscount?.threshold || REWARDS_CONFIG.freeShipping.threshold;
        const progress = Math.min((cartTotal / threshold) * 100, 100);
        const remaining = Math.max(threshold - cartTotal, 0);
        const unlocked = cartTotal >= threshold;
        
        // Get all gift names
        const giftNames = activeFreeGift?.freeProducts?.map(p => p.title).join(' + ') 
            || activeFreeGift?.freeProduct?.title 
            || 'Free Gift';
        
        // Get order discount percentage if active at same threshold
        const percentOff = activeOrderDiscount?.percentOff || 0;
        
        // Determine if we have any reward at this threshold (gift or percentage)
        const hasActiveReward = !!activeFreeGift || !!activeOrderDiscount;
        
        return { 
            progress, 
            remaining, 
            unlocked, 
            threshold, 
            giftName: giftNames, 
            percentOff,
            hasActiveGift: !!activeFreeGift,
            hasActiveReward
        };
    }, [cartTotal, activeFreeGift, activeOrderDiscount]);
    
    // Calculate progress for quantity-based rewards (Buy X Get Y Free)
    const quantityProgress = useMemo(() => {
        if (!quantityDiscountGroups || quantityDiscountGroups.length === 0) {
            return { hasActiveReward: false };
        }
        
        // Get the first (lowest) quantity threshold group
        const firstGroup = quantityDiscountGroups[0];
        const required = firstGroup.requiredQuantity;
        const current = firstGroup.currentQuantity;
        const progress = Math.min((current / required) * 100, 100);
        const remaining = Math.max(0, required - current);
        const unlocked = current >= required;
        
        // Get selected option or first option for display name
        const selectedId = selectedRewards[required];
        const options = firstGroup.options || [];
        const hasMultipleOptions = options.length > 1;
        const selectedOption = selectedId ? options.find(o => o.id === selectedId) : null;
        
        // Get gift name
        let giftName = 'Free Reward';
        if (selectedOption) {
            giftName = selectedOption.freeProducts?.[0]?.variantTitle 
                || selectedOption.freeProducts?.[0]?.title 
                || selectedOption.freeProduct?.title 
                || 'Free Item';
        } else if (!hasMultipleOptions && options[0]) {
            giftName = options[0].freeProducts?.[0]?.variantTitle 
                || options[0].freeProducts?.[0]?.title 
                || options[0].freeProduct?.title 
                || 'Free Item';
        }
        
        return {
            hasActiveReward: true,
            required,
            current,
            progress,
            remaining,
            unlocked,
            giftName,
            options,
            hasMultipleOptions,
            threshold: required
        };
    }, [quantityDiscountGroups, selectedRewards]);
    
    // Clear AddedToCart view when all blind boxes are removed from cart
    useEffect(() => {
        if (showAddedToCart && isBlindBoxAdded && blindBoxesInCart === 0) {
            console.log('🗑️ All blind boxes removed - clearing AddedToCart view');
            setShowAddedToCart(false);
            setAddedProduct(null);
            setAddedVariant(null);
            setAddedQuantity(1);
            sessionStorage.removeItem('addedToCart');
        }
    }, [showAddedToCart, isBlindBoxAdded, blindBoxesInCart]);
    
    // Handle adding a blind box from the selector modal
    const handleAddBlindBoxFromSelector = async (product) => {
        try {
            const variantId = product.variantId || product.variants?.[0]?.id;
            if (!variantId) {
                console.error('No variant ID found for blind box');
                return;
            }
            
            await addToCart(variantId, 1);
            setShowBlindBoxSelector(false);
            
            // Update the added product to show the new one
            setAddedProduct(product);
            setAddedVariant(product.variants?.[0] || null);
            setAddedQuantity(1);
        } catch (error) {
            console.error('Error adding blind box:', error);
        }
    };
    
    // Return to cross-sell page with first blind box in cart
    const handleReturnToCrossSell = () => {
        if (blindBoxCartItems.length > 0) {
            const firstBlindBox = blindBoxCartItems[0];
            const product = firstBlindBox.product;
            const variant = firstBlindBox.variant;
            
            // Set state to show AddedToCart view
            setShowAddedToCart(true);
            setAddedProduct(product);
            setAddedVariant(variant);
            setAddedQuantity(1);
            
            // Save to sessionStorage
            sessionStorage.setItem('addedToCart', JSON.stringify({
                show: true,
                product: product,
                variant: variant,
                quantity: 1
            }));
            
            // Mark this as intentional cross-sell navigation (don't clear on route change)
            intentionalCrossSell.current = true;
            
            // Navigate to base path to show the AddedToCart view
            navigate('/');
        }
    };
    
    // Get recommendations for added to cart view
    const getAddedToCartRecommendations = () => {
        if (!addedProduct) return [];
        
        // Priority 1: Cross-sell collection products
        const crosssell = addedProduct.crosssellProducts || [];
        if (crosssell.length > 0) {
            console.log('✅ Using crosssellProducts:', crosssell);
            return crosssell.slice(0, 4);
        }
        
        // Fallback: Same category products
        const fallback = shopifyProducts.filter(p => 
            p.category === addedProduct.category && 
            p.id !== addedProduct.id
        ).slice(0, 4);
        console.log('📦 Using same category products:', fallback);
        return fallback;
    };
    
    // Get featured/filtered products based on route
    let displayProducts;
    let pageTitle;
    let pageDescription;
    
    // Helper function to explode products into cards, grouping by subcategory → container
    // Result: One card per product-container combination, with sizes as variant options
    const explodeProductVariants = (products) => {
        const exploded = [];
        products.forEach(product => {
            if (product.variants && product.variants.length > 0) {
                // Group variants by subcategory first, then by container
                const variantsBySubcatContainer = {};
                
                product.variants.forEach(variant => {
                    const subcat = variant.subcategory || 'other';
                    const container = variant.container || 'other';
                    const key = `${subcat}|${container}`;
                    
                    if (!variantsBySubcatContainer[key]) {
                        variantsBySubcatContainer[key] = {
                            subcategory: subcat,
                            container: container,
                            subcategoryData: variant.subcategoryData,
                            containerData: variant.containerData,
                            variants: []
                        };
                    }
                    variantsBySubcatContainer[key].variants.push(variant);
                });
                
                // Create one card per subcategory-container group
                Object.values(variantsBySubcatContainer).forEach(group => {
                    const { subcategory, container, subcategoryData, containerData, variants } = group;
                    
                    // Destructure to exclude original variants array
                    const { variants: _allVariants, ...productWithoutVariants } = product;
                    
                    if (variants.length === 1) {
                        // Single variant (single size) - show container name
                        const variant = variants[0];
                        const sizeTitle = variant.sizeData?.title || variant.size || '';
                        const containerTitle = containerData?.title || container;
                        
                        // Image: only show if hasVariantImage === true
                        const variantImage = (variant.hasVariantImage === true && variant.image?.url)
                            ? variant.image.url 
                            : PLACEHOLDER_IMAGE;
                        
                        exploded.push({
                            ...productWithoutVariants,
                            id: `${product.id}-${subcategory}-${container}`,
                            variantId: variant.id,
                            name: product.name,
                            price: `$${parseFloat(variant.price).toFixed(2)}`,
                            originalProductId: product.id,
                            variantTitle: variant.title,
                            subcategory: subcategory,
                            subcategoryData: subcategoryData,
                            container: container,
                            containerData: containerData,
                            imageUrl: variantImage,
                            imageAlt: variant.image?.alt || product.name,
                            variantOptions: containerTitle, // e.g., "Cup", "Mason Jar"
                            sizeOptions: sizeTitle ? [sizeTitle] : null, // Single size
                            variants: null,
                            availableVariants: [variant] // For modal
                        });
                    } else {
                        // Multiple variants (multiple sizes) - show container with size selector
                        const prices = variants.map(v => parseFloat(v.price)).sort((a, b) => a - b);
                        const minPrice = prices[0];
                        const maxPrice = prices[prices.length - 1];
                        const priceDisplay = minPrice === maxPrice 
                            ? `$${minPrice.toFixed(2)}`
                            : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
                        
                        // Get size names for display
                        const sizeNames = variants.map(v => v.sizeData?.title || v.size || v.title);
                        const sizeDescription = sizeNames.join(' | ');
                        const containerTitle = containerData?.title || container;
                        
                        // Find variants with hasVariantImage === true
                        const variantsWithImages = variants.filter(v => 
                            v.hasVariantImage === true && v.image?.url
                        );
                        
                        let imageUrl = PLACEHOLDER_IMAGE;
                        let imageAlt = product.name;
                        
                        if (variantsWithImages.length > 0) {
                            // Sort by price descending and use most expensive with image
                            const sortedByPrice = [...variantsWithImages].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
                            imageUrl = sortedByPrice[0].image.url;
                            imageAlt = sortedByPrice[0].image.alt || product.name;
                        }
                        
                        exploded.push({
                            ...productWithoutVariants,
                            id: `${product.id}-${subcategory}-${container}`,
                            variantId: variants[0].id, // Default to first variant
                            variants: variants, // All size variants for this container
                            name: product.name,
                            price: priceDisplay,
                            originalProductId: product.id,
                            variantTitle: null,
                            subcategory: subcategory,
                            subcategoryData: subcategoryData,
                            container: container,
                            containerData: containerData,
                            imageUrl: imageUrl,
                            imageAlt: imageAlt,
                            variantOptions: containerTitle, // e.g., "Cup", "Mason Jar"
                            sizeOptions: sizeDescription, // e.g., "Kids | Regular"
                            availableVariants: variants // For modal size selector
                        });
                    }
                });
            } else {
                // No variants - keep as is
                exploded.push(product);
            }
        });
        return exploded;
    };
    
    // Subcategory definitions for Desserts
    // Dynamically loaded from Shopify metaobjects (no fallback defaults)
    const DESSERT_SUBCATEGORIES = dessertSubcategories?.length > 0
        ? dessertSubcategories.map(subcat => ({
            id: subcat.id,
            title: subcat.title,
            description: subcat.description || '',
            image: subcat.image?.url || `https://placehold.co/300x300/e0e0e0/666666?text=${encodeURIComponent(subcat.title)}`,
            // Case-insensitive filter
            filter: (p) => p.subcategory?.toLowerCase() === subcat.id?.toLowerCase()
        }))
        : [];
    
    // Helper function to filter by variant subcategory metafield
    const filterBySubcategory = (products, subcategory) => {
        if (subcategory === 'all') return products;
        
        const subcategoryDef = DESSERT_SUBCATEGORIES.find(s => s.id === subcategory);
        if (!subcategoryDef) return products;
        
        return products.filter(subcategoryDef.filter);
    };
    
    // Subcategory definitions for Merchandise
    // Dynamically loaded from Shopify metaobjects (no fallback defaults)
    // Uses product-level subcategory (not variant-level like desserts)
    const MERCHANDISE_SUBCATEGORIES = merchandiseSubcategories?.length > 0
        ? merchandiseSubcategories.map(subcat => ({
            id: subcat.id,
            title: subcat.title,
            description: subcat.description || '',
            image: subcat.image?.url || `https://placehold.co/300x300/e0e0e0/666666?text=${encodeURIComponent(subcat.title)}`,
            filter: (p) => p.merchandiseSubcategory === subcat.id
        }))
        : [];
    
    // Scroll to section helper
    const scrollToSection = (sectionId) => {
        const element = document.getElementById(`section-${sectionId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };
    
    // Products organized by subcategory (for section view)
    let productsBySubcategory = {};
    
    // Get subcategories for current category
    const currentSubcategories = isDesserts ? DESSERT_SUBCATEGORIES : 
                                  isMerchandise ? MERCHANDISE_SUBCATEGORIES : 
                                  [];
    
    if (isCategoryPage && currentCategory) {
        // Filter products by current category (dynamic)
        // Check against: category metafield, productType, or case-insensitive matches
        const categoryHandle = currentCategory.handle?.toLowerCase();
        let categoryProducts = shopifyProducts.filter(p => {
            const pCategory = p.category?.toLowerCase();
            const pType = p.productType?.toLowerCase();
            return pCategory === categoryHandle || 
                   pType === categoryHandle ||
                   pCategory === currentCategory.id?.toLowerCase();
        });
        
        console.log(`📦 Filtering for category "${categoryHandle}":`, categoryProducts.length, 'products');
        
        // Special handling for desserts - explode variants
        if (isDesserts) {
            categoryProducts = explodeProductVariants(categoryProducts);
        }
        
        // Group products by subcategory for section display
        currentSubcategories.forEach(subcat => {
            productsBySubcategory[subcat.id] = categoryProducts.filter(subcat.filter);
        });
        
        // displayProducts is all products in this category
        displayProducts = categoryProducts;
        
        // Use dynamic title/description from category
        pageTitle = currentCategory.title;
        pageDescription = currentCategory.description || `Shop ${currentCategory.title}`;
    } else {
        // Homepage - show first 6 products
        displayProducts = shopifyProducts.slice(0, 6);
        pageTitle = null;
        pageDescription = null;
    }
    
    // Get product recommendations
    const getRecommendations = () => {
        if (!selectedProductId) return [];
        
        const selectedProduct = shopifyProducts.find(p => p.id === selectedProductId);
        if (!selectedProduct) return [];
        
        // Filter products by same category, exclude current
        return shopifyProducts
            .filter(p => 
                p.category === selectedProduct.category && 
                p.id !== selectedProductId
            )
            .slice(0, 4);
    };
    
    // Find selected product - handle if selectedProductId is an object or string
    const selectedProduct = selectedProductId 
        ? shopifyProducts.find(p => {
            const idToMatch = typeof selectedProductId === 'string' 
                ? selectedProductId 
                : selectedProductId?.id;
            return p.id === idToMatch;
        })
        : null;
    
    // Debug logging
    useEffect(() => {
        const idToLog = typeof selectedProductId === 'string' 
            ? selectedProductId 
            : selectedProductId?.id || selectedProductId;
            
        console.log('🔍 Commerce state:', {
            showProductModal,
            selectedProductId: idToLog,
            selectedProductIdType: typeof selectedProductId,
            selectedProduct: selectedProduct?.name,
            productsCount: shopifyProducts.length,
            firstProduct: shopifyProducts[0]?.id
        });
        
        if (showProductModal && selectedProductId && !selectedProduct) {
            console.error('❌ MODAL ERROR: Product not found!');
            console.error('Looking for ID:', idToLog);
            console.error('Available IDs:', shopifyProducts.map(p => p.id));
        }
    }, [showProductModal, selectedProductId, selectedProduct, shopifyProducts]);
    
    if (shopifyLoading) {
        return (
            <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
                <CircularProgress />
                <Typography sx={{ mt: 2 }}>Loading products...</Typography>
            </Container>
        );
    }
    
    if (shopifyError) {
        return (
            <Container maxWidth="sm" sx={{ py: 8 }}>
                <Alert severity="error">
                    Error loading products: {shopifyError}
                </Alert>
            </Container>
        );
    }
    
    // Log what we're about to render
    console.log('🖼️ [RENDER] Decision:', {
        showAddedToCart,
        hasAddedProduct: !!addedProduct,
        addedProductName: addedProduct?.name,
        willShowAddedToCart: showAddedToCart && addedProduct,
        currentPath
    });
    
    return (
        <>
            <Helmet>
                <title>{pageTitle ? `${pageTitle} | Surreal Creamery x tokidoki` : 'Surreal Creamery x tokidoki | Shop'}</title>
                <meta name="description" content={pageDescription || "Shop exclusive tokidoki x Surreal Creamery collaboration. Limited edition desserts, blind box collectibles, and more!"} />
            </Helmet>

            <Box sx={{ minHeight: '100vh', backgroundColor: 'white', overflowX: 'hidden' }}>
                {/* ADDED TO CART VIEW */}
                {showAddedToCart && addedProduct ? (
                    <Box sx={{ pb: 6 }}>
                        {/* Combined Product Info + Rewards Progress */}
                        <Box sx={{ bgcolor: 'white', py: 2, px: 2, borderBottom: '1px solid', borderColor: 'grey.200' }}>
                            <Container maxWidth="sm" disableGutters>
                                {/* Product Info Row */}
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'flex-start', 
                                    justifyContent: 'space-between',
                                    gap: 2,
                                    mb: 2
                                }}>
                                    {/* Left: Product info */}
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1, minWidth: 0 }}>
                                        {/* Product Image */}
                                        <Box
                                            sx={{
                                                width: 50,
                                                height: 50,
                                                flexShrink: 0,
                                                borderRadius: 1,
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {(addedVariant?.image?.url || addedProduct.imageUrl || addedProduct.images?.[0]?.url) ? (
                                                <img
                                                    src={addedVariant?.image?.url || addedProduct.imageUrl || addedProduct.images?.[0]?.url}
                                                    alt={addedProduct.name}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <Box sx={{ width: '100%', height: '100%', bgcolor: 'grey.200' }} />
                                            )}
                                        </Box>
                                        
                                        {/* Product Title */}
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography 
                                                variant="body1" 
                                                sx={{ 
                                                    color: '#333', 
                                                    fontWeight: 600
                                                }}
                                            >
                                                {addedProduct.name || addedProduct.title}
                                            </Typography>
                                            {addedVariant?.title && addedVariant.title !== 'Default Title' && (
                                                <Typography 
                                                    sx={{ 
                                                        color: '#333',
                                                        display: 'block',
                                                        fontSize: '1.6rem'
                                                    }}
                                                >
                                                    {addedVariant.title} × {addedQuantity}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                    
                                    {/* Right: Review Bag Button */}
                                    <Button
                                        variant="contained"
                                        size="small"
                                        startIcon={<ShoppingBagOutlinedIcon sx={{ fontSize: '1.6rem' }} />}
                                        onClick={() => sendToCommerce({ type: 'OPEN_CART' })}
                                        sx={{ 
                                            flexShrink: 0,
                                            bgcolor: '#333',
                                            fontSize: '1.6rem',
                                            '&:hover': { bgcolor: '#000' }
                                        }}
                                    >
                                        Bag ({getCartCount()})
                                    </Button>
                                </Box>
                                
                                {/* Discounts Section - Single Card */}
                                <Box sx={{ 
                                    mt: 2,
                                    border: '1px solid',
                                    borderColor: 'grey.300',
                                    borderRadius: 2,
                                    overflow: 'hidden'
                                }}>
                                    {(() => {
                                        // Build unified list of all discounts
                                        const allDiscounts = [];
                                        
                                        // 1. Free Shipping
                                        allDiscounts.push({
                                            id: 'free-shipping',
                                            type: 'shipping',
                                            title: `Free Shipping for orders over $${REWARDS_CONFIG.freeShipping.threshold}`,
                                            shortTitle: 'Free Shipping',
                                            threshold: REWARDS_CONFIG.freeShipping.threshold,
                                            current: parseFloat(checkout?.subtotalPrice?.amount || 0),
                                            progress: shippingProgress.progress,
                                            unlocked: shippingProgress.unlocked,
                                            remaining: shippingProgress.remaining,
                                            priority: 3
                                        });
                                        
                                        // 2. Order Discounts (percentage off)
                                        orderDiscounts?.forEach(discount => {
                                            const current = parseFloat(checkout?.subtotalPrice?.amount || 0);
                                            const threshold = discount.threshold;
                                            const progress = Math.min((current / threshold) * 100, 100);
                                            const unlocked = current >= threshold;
                                            const remaining = Math.max(0, threshold - current);
                                            
                                            allDiscounts.push({
                                                id: discount.id,
                                                type: 'order',
                                                title: `${discount.percentOff}% Off Your Order for orders over $${threshold}`,
                                                shortTitle: `${discount.percentOff}% Off`,
                                                threshold,
                                                current,
                                                progress,
                                                unlocked,
                                                remaining,
                                                percentOff: discount.percentOff,
                                                priority: 2
                                            });
                                        });
                                        
                                        // 3. Quantity-based rewards
                                        if (quantityProgress?.hasActiveReward) {
                                            allDiscounts.push({
                                                id: 'quantity-reward',
                                                type: 'quantity',
                                                title: `Free Item for ${quantityProgress.required} or more blind boxes`,
                                                shortTitle: 'Free Item',
                                                threshold: quantityProgress.required,
                                                current: quantityProgress.current,
                                                progress: quantityProgress.progress,
                                                unlocked: quantityProgress.unlocked,
                                                remaining: quantityProgress.remaining,
                                                options: quantityProgress.options,
                                                hasMultipleOptions: quantityProgress.hasMultipleOptions,
                                                priority: 1
                                            });
                                        }
                                        
                                        // Sort: unlocked last, then by progress (highest first)
                                        allDiscounts.sort((a, b) => {
                                            if (a.unlocked && !b.unlocked) return 1;
                                            if (!a.unlocked && b.unlocked) return -1;
                                            if (b.progress !== a.progress) return b.progress - a.progress;
                                            return a.priority - b.priority;
                                        });
                                        
                                        const activeDiscountIndex = allDiscounts.findIndex(d => !d.unlocked);
                                        
                                        return allDiscounts.map((discount, index) => {
                                            const isActive = index === activeDiscountIndex;
                                            const isLast = index === allDiscounts.length - 1;
                                            
                                            return (
                                                <Box key={discount.id} sx={{ 
                                                    p: 1.5,
                                                    bgcolor: discount.unlocked ? '#e8f5e9' : (isActive ? 'grey.50' : 'white'),
                                                    borderBottom: !isLast ? '1px solid' : 'none',
                                                    borderColor: 'grey.200'
                                                }}>
                                                    {/* Title Row */}
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        {discount.type === 'shipping' && (
                                                            <LocalShippingOutlinedIcon sx={{ 
                                                                fontSize: '1.6rem', 
                                                                color: discount.unlocked ? 'success.main' : 'text.secondary'
                                                            }} />
                                                        )}
                                                        {discount.type === 'order' && (
                                                            <Box sx={{ 
                                                                fontSize: '1.6rem', 
                                                                fontWeight: 700,
                                                                color: discount.unlocked ? 'success.main' : '#e65100',
                                                                minWidth: 36
                                                            }}>
                                                                {discount.percentOff}%
                                                            </Box>
                                                        )}
                                                        {discount.type === 'quantity' && (
                                                            <CardGiftcardIcon sx={{ 
                                                                fontSize: '1.6rem', 
                                                                color: discount.unlocked ? 'success.main' : '#e65100'
                                                            }} />
                                                        )}
                                                        
                                                        <Typography sx={{ 
                                                            flex: 1,
                                                            fontSize: '1.6rem', 
                                                            fontWeight: discount.unlocked ? 600 : (isActive ? 600 : 400),
                                                            color: discount.unlocked ? 'success.main' : 'text.primary'
                                                        }}>
                                                            {discount.title}
                                                        </Typography>
                                                        
                                                        {discount.unlocked && (
                                                            <CheckCircleIcon sx={{ fontSize: '1.6rem', color: 'success.main' }} />
                                                        )}
                                                    </Box>
                                                    
                                                    {/* Expanded Content for active discount */}
                                                    {isActive && !discount.unlocked && (
                                                        <Box sx={{ mt: 1.5 }}>
                                                            {/* Progress Bar for dollar-based discounts */}
                                                            {(discount.type === 'shipping' || discount.type === 'order') && (
                                                                <>
                                                                    <Box sx={{ 
                                                                        height: 8, 
                                                                        bgcolor: 'grey.200', 
                                                                        borderRadius: 4,
                                                                        overflow: 'hidden',
                                                                        mb: 1
                                                                    }}>
                                                                        <Box sx={{ 
                                                                            height: '100%', 
                                                                            width: `${discount.progress}%`,
                                                                            bgcolor: discount.type === 'shipping' ? 'primary.main' : '#ff9800',
                                                                            borderRadius: 4,
                                                                            transition: 'width 0.3s ease'
                                                                        }} />
                                                                    </Box>
                                                                    <Typography sx={{ 
                                                                        fontSize: '1.6rem', 
                                                                        color: 'text.secondary',
                                                                        textAlign: 'center'
                                                                    }}>
                                                                        ${discount.remaining.toFixed(2)} needed to unlock {discount.shortTitle}
                                                                    </Typography>
                                                                </>
                                                            )}
                                                            
                                                            {/* Quantity-based rewards - show locked options */}
                                                            {discount.type === 'quantity' && (
                                                                <>
                                                                    <Typography sx={{
                                                                        fontSize: '1.6rem',
                                                                        color: 'text.secondary',
                                                                        textAlign: 'center',
                                                                        mb: 0.5
                                                                    }}>
                                                                        Add {discount.remaining} more blind box{discount.remaining !== 1 ? 'es' : ''} to receive your free item
                                                                    </Typography>
                                                                    <BlindBoxProgressIndicator
                                                                        current={discount.current}
                                                                        required={discount.threshold}
                                                                        onClickIncomplete={() => setShowBlindBoxSelector(true)}
                                                                    />
                                                                    
                                                                    {discount.options?.map((option, optIndex) => {
                                                                        const rewardName = option.freeProducts?.[0]?.variantTitle 
                                                                            || option.freeProducts?.[0]?.title 
                                                                            || option.freeProduct?.title
                                                                            || 'Free Item';
                                                                        const productTitle = option.freeProducts?.[0]?.title 
                                                                            || option.freeProduct?.title
                                                                            || option.title;
                                                                        
                                                                        // Look up image from shopifyProducts
                                                                        const variantId = option.freeProducts?.[0]?.variantId || option.freeProduct?.variantId;
                                                                        const productId = option.freeProducts?.[0]?.id || option.freeProduct?.id;
                                                                        const matchedProduct = shopifyProducts?.find(p => 
                                                                            p.id === productId || 
                                                                            p.shopifyId === productId ||  // Check shopifyId (full GID)
                                                                            p.variantId === variantId ||
                                                                            p.variants?.some(v => v.id === variantId)
                                                                        );
                                                                        
                                                                        // Debug: Log image lookup
                                                                        console.log('🖼️ Image lookup:', {
                                                                            productId,
                                                                            variantId,
                                                                            matchedProduct: matchedProduct ? {
                                                                                id: matchedProduct.id,
                                                                                shopifyId: matchedProduct.shopifyId,
                                                                                imageUrl: matchedProduct.imageUrl,
                                                                                images: matchedProduct.images?.slice(0, 1),
                                                                            } : 'NOT FOUND',
                                                                            shopifyProductsCount: shopifyProducts?.length
                                                                        });
                                                                        
                                                                        const imageUrl = matchedProduct?.imageUrl 
                                                                            || matchedProduct?.images?.[0]?.url
                                                                            || matchedProduct?.variants?.find(v => v.id === variantId)?.image?.url
                                                                            || PLACEHOLDER_IMAGE;
                                                                        
                                                                        return (
                                                                            <Box key={option.id}>
                                                                                <Box sx={{ 
                                                                                    display: 'flex',
                                                                                    alignItems: 'flex-start',
                                                                                    gap: 1.5,
                                                                                    p: 1.5,
                                                                                    borderRadius: 2,
                                                                                    bgcolor: 'white',
                                                                                    opacity: 0.7
                                                                                }}>
                                                                                    <Box sx={{
                                                                                        width: 60,
                                                                                        height: 60,
                                                                                        borderRadius: 1,
                                                                                        overflow: 'hidden',
                                                                                        flexShrink: 0,
                                                                                        bgcolor: 'grey.100'
                                                                                    }}>
                                                                                        <img
                                                                                            src={imageUrl}
                                                                                            alt={rewardName}
                                                                                            style={{
                                                                                                width: '100%',
                                                                                                height: '100%',
                                                                                                objectFit: 'cover'
                                                                                            }}
                                                                                        />
                                                                                    </Box>
                                                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                                        <Typography sx={{ 
                                                                                            fontSize: '1.6rem', 
                                                                                            fontWeight: 600,
                                                                                            color: '#333',
                                                                                            lineHeight: 1.3
                                                                                        }}>
                                                                                            {rewardName}
                                                                                        </Typography>
                                                                                        <Typography sx={{ 
                                                                                            fontSize: '1.6rem', 
                                                                                            color: 'text.secondary',
                                                                                            mt: 0.25
                                                                                        }}>
                                                                                            {productTitle}
                                                                                        </Typography>
                                                                                    </Box>
                                                                                </Box>
                                                                                {optIndex < discount.options.length - 1 && (
                                                                                    <Typography sx={{ 
                                                                                        textAlign: 'center', 
                                                                                        color: 'text.secondary',
                                                                                        fontSize: '1.6rem',
                                                                                        py: 0.5
                                                                                    }}>
                                                                                        — or —
                                                                                    </Typography>
                                                                                )}
                                                                            </Box>
                                                                        );
                                                                    })}
                                                                </>
                                                            )}
                                                        </Box>
                                                    )}
                                                    
                                                    {/* Selection UI when quantity reward is unlocked */}
                                                    {discount.type === 'quantity' && discount.unlocked && (
                                                        <Box sx={{ mt: 1.5 }}>
                                                            {(() => {
                                                                const selectedId = selectedRewards[discount.threshold];
                                                                const showOptions = selectedRewards[`${discount.threshold}_showOptions`];
                                                                
                                                                if (selectedId && !showOptions) {
                                                                    const selectedOption = discount.options?.find(o => o.id === selectedId);
                                                                    if (selectedOption) {
                                                                        const rewardName = selectedOption.freeProducts?.[0]?.variantTitle 
                                                                            || selectedOption.freeProducts?.[0]?.title 
                                                                            || selectedOption.freeProduct?.title
                                                                            || 'Free Item';
                                                                        const productTitle = selectedOption.freeProducts?.[0]?.title 
                                                                            || selectedOption.freeProduct?.title
                                                                            || selectedOption.title;
                                                                        
                                                                        // Look up image from shopifyProducts
                                                                        const variantId = selectedOption.freeProducts?.[0]?.variantId || selectedOption.freeProduct?.variantId;
                                                                        const productId = selectedOption.freeProducts?.[0]?.id || selectedOption.freeProduct?.id;
                                                                        const matchedProduct = shopifyProducts?.find(p => 
                                                                            p.id === productId || 
                                                                            p.shopifyId === productId ||  // Check shopifyId (full GID)
                                                                            p.variantId === variantId ||
                                                                            p.variants?.some(v => v.id === variantId)
                                                                        );
                                                                        const imageUrl = matchedProduct?.imageUrl 
                                                                            || matchedProduct?.images?.[0]?.url
                                                                            || matchedProduct?.variants?.find(v => v.id === variantId)?.image?.url
                                                                            || PLACEHOLDER_IMAGE;
                                                                        
                                                                        return (
                                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                <Box sx={{ 
                                                                                    display: 'flex',
                                                                                    alignItems: 'flex-start',
                                                                                    gap: 1.5,
                                                                                    flex: 1,
                                                                                    p: 1.5,
                                                                                    borderRadius: 2,
                                                                                    bgcolor: 'white'
                                                                                }}>
                                                                                    <Box sx={{
                                                                                        width: 60,
                                                                                        height: 60,
                                                                                        borderRadius: 1,
                                                                                        overflow: 'hidden',
                                                                                        flexShrink: 0,
                                                                                        bgcolor: 'grey.100'
                                                                                    }}>
                                                                                        <img
                                                                                            src={imageUrl}
                                                                                            alt={rewardName}
                                                                                            style={{
                                                                                                width: '100%',
                                                                                                height: '100%',
                                                                                                objectFit: 'cover'
                                                                                            }}
                                                                                        />
                                                                                    </Box>
                                                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                                        <Typography sx={{ 
                                                                                            fontSize: '1.6rem', 
                                                                                            fontWeight: 600,
                                                                                            color: 'success.main',
                                                                                            lineHeight: 1.3
                                                                                        }}>
                                                                                            {rewardName}
                                                                                        </Typography>
                                                                                        <Typography sx={{ 
                                                                                            fontSize: '1.6rem', 
                                                                                            color: 'text.secondary',
                                                                                            mt: 0.25
                                                                                        }}>
                                                                                            {productTitle}
                                                                                        </Typography>
                                                                                    </Box>
                                                                                </Box>
                                                                                {discount.hasMultipleOptions && (
                                                                                    <Button
                                                                                        size="small"
                                                                                        onClick={() => handleSelectReward(`${discount.threshold}_showOptions`, true)}
                                                                                        sx={{ fontSize: '1.6rem', textTransform: 'none' }}
                                                                                    >
                                                                                        Change
                                                                                    </Button>
                                                                                )}
                                                                            </Box>
                                                                        );
                                                                    }
                                                                }
                                                                
                                                                // Show selection UI
                                                                return (
                                                                    <>
                                                                        {discount.hasMultipleOptions && !selectedId && (
                                                                            <Typography sx={{ 
                                                                                fontSize: '1.6rem', 
                                                                                color: '#e65100',
                                                                                fontWeight: 600,
                                                                                mb: 1,
                                                                                textAlign: 'center'
                                                                            }}>
                                                                                Select your free reward:
                                                                            </Typography>
                                                                        )}
                                                                        
                                                                        {discount.options?.map((option, optIndex) => {
                                                                            const isSelected = selectedRewards[discount.threshold] === option.id;
                                                                            const rewardName = option.freeProducts?.[0]?.variantTitle 
                                                                                || option.freeProducts?.[0]?.title 
                                                                                || option.freeProduct?.title
                                                                                || 'Free Item';
                                                                            const productTitle = option.freeProducts?.[0]?.title 
                                                                                || option.freeProduct?.title
                                                                                || option.title;
                                                                            
                                                                            // Look up image from shopifyProducts
                                                                            const variantId = option.freeProducts?.[0]?.variantId || option.freeProduct?.variantId;
                                                                            const productId = option.freeProducts?.[0]?.id || option.freeProduct?.id;
                                                                            const matchedProduct = shopifyProducts?.find(p => 
                                                                                p.id === productId || 
                                                                                p.shopifyId === productId ||  // Check shopifyId (full GID)
                                                                                p.variantId === variantId ||
                                                                                p.variants?.some(v => v.id === variantId)
                                                                            );
                                                                            const imageUrl = matchedProduct?.imageUrl 
                                                                                || matchedProduct?.images?.[0]?.url
                                                                                || matchedProduct?.variants?.find(v => v.id === variantId)?.image?.url
                                                                                || PLACEHOLDER_IMAGE;
                                                                            
                                                                            return (
                                                                                <Box key={option.id}>
                                                                                    <Box 
                                                                                        onClick={() => {
                                                                                            handleSelectReward(discount.threshold, option.id);
                                                                                            handleSelectReward(`${discount.threshold}_showOptions`, false);
                                                                                        }}
                                                                                        sx={{ 
                                                                                            display: 'flex',
                                                                                            alignItems: 'flex-start',
                                                                                            gap: 1.5,
                                                                                            p: 1.5,
                                                                                            borderRadius: 2,
                                                                                            cursor: 'pointer',
                                                                                            bgcolor: 'white',
                                                                                            border: '2px solid',
                                                                                            borderColor: isSelected ? '#000' : 'grey.300',
                                                                                            transition: 'all 0.2s ease',
                                                                                            '&:hover': {
                                                                                                borderColor: isSelected ? '#000' : 'grey.500',
                                                                                                bgcolor: 'grey.50'
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <Box sx={{
                                                                                            width: 60,
                                                                                            height: 60,
                                                                                            borderRadius: 1,
                                                                                            overflow: 'hidden',
                                                                                            flexShrink: 0,
                                                                                            bgcolor: 'grey.100'
                                                                                        }}>
                                                                                            <img
                                                                                                src={imageUrl}
                                                                                                alt={rewardName}
                                                                                                style={{
                                                                                                    width: '100%',
                                                                                                    height: '100%',
                                                                                                    objectFit: 'cover'
                                                                                                }}
                                                                                            />
                                                                                        </Box>
                                                                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                                            <Typography sx={{ 
                                                                                                fontSize: '1.6rem', 
                                                                                                fontWeight: 600,
                                                                                                color: '#333',
                                                                                                lineHeight: 1.3
                                                                                            }}>
                                                                                                {rewardName}
                                                                                            </Typography>
                                                                                            <Typography sx={{ 
                                                                                                fontSize: '1.6rem', 
                                                                                                color: 'text.secondary',
                                                                                                mt: 0.25
                                                                                            }}>
                                                                                                {productTitle}
                                                                                            </Typography>
                                                                                        </Box>
                                                                                        {isSelected && (
                                                                                            <CheckCircleIcon sx={{ 
                                                                                                fontSize: '2rem', 
                                                                                                color: '#000',
                                                                                                flexShrink: 0
                                                                                            }} />
                                                                                        )}
                                                                                    </Box>
                                                                                    {optIndex < discount.options.length - 1 && (
                                                                                        <Typography sx={{ 
                                                                                            textAlign: 'center', 
                                                                                            color: 'text.secondary',
                                                                                            fontSize: '1.6rem',
                                                                                            py: 0.5
                                                                                        }}>
                                                                                            — or —
                                                                                        </Typography>
                                                                                    )}
                                                                                </Box>
                                                                            );
                                                                        })}
                                                                        
                                                                        {showOptions && selectedId && (
                                                                            <Button
                                                                                fullWidth
                                                                                variant="outlined"
                                                                                size="small"
                                                                                onClick={() => handleSelectReward(`${discount.threshold}_showOptions`, false)}
                                                                                sx={{ mt: 1, fontSize: '1.6rem' }}
                                                                            >
                                                                                Cancel
                                                                            </Button>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </Box>
                                                    )}
                                                </Box>
                                            );
                                        });
                                    })()}
                                </Box>
                            </Container>
                        </Box>
                        
                        {/* Blind Box Collector UI - Only show when a blind box is added AND we have valid discount data */}
                        {isBlindBoxAdded && hasBlindBoxDiscount ? (
                            <Container maxWidth="sm" sx={{ mt: 4, px: 2 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                    Build Your Collection
                                </Typography>
                                
                                {/* Discount status banner */}
                                {blindBoxCartItems.some(item => item.hasDiscount) ? (
                                    // Discount IS unlocked
                                    <Box sx={{ 
                                        bgcolor: '#e8f5e9', 
                                        borderRadius: 2, 
                                        p: 2, 
                                        mb: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5
                                    }}>
                                        <CheckCircleOutlineIcon sx={{ color: '#2e7d32', fontSize: '1.5rem' }} />
                                        <Box>
                                            <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 600, fontSize: '1.6rem' }}>
                                                {blindBoxCartItems[0]?.discountPercent || BLIND_BOX_DISCOUNT_PERCENT}% off unlocked!
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#1b5e20', fontSize: '1.6rem' }}>
                                                All {blindBoxesInCart} blind boxes are discounted
                                            </Typography>
                                        </Box>
                                    </Box>
                                ) : (hasBlindBoxDiscount && blindBoxesInCart > 0 && blindBoxesNeededForDiscount > 0) ? (
                                    // Has boxes but discount NOT yet unlocked - show potential savings
                                    <Box sx={{
                                        bgcolor: '#e8f5e9',
                                        borderRadius: 2,
                                        p: 2,
                                        mb: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5
                                    }}>
                                        <LocalOfferIcon sx={{ color: '#2e7d32', fontSize: '1.5rem' }} />
                                        <Box>
                                            <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 600, fontSize: '1.6rem' }}>
                                                Add {blindBoxesNeededForDiscount} more for {BLIND_BOX_DISCOUNT_PERCENT}% off!
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#1b5e20', fontSize: '1.6rem' }}>
                                                Save on your entire blind box order
                                            </Typography>
                                        </Box>
                                    </Box>
                                ) : null}
                                
                                <Box sx={{ 
                                    display: 'flex', 
                                    flexWrap: 'wrap', 
                                    gap: 2
                                }}>
                                    {/* Show ALL blind boxes in cart */}
                                    {blindBoxCartItems.map((item, index) => {
                                        // Calculate potential discounted price when not yet at threshold
                                        const showPotentialDiscount = hasBlindBoxDiscount && blindBoxesNeededForDiscount > 0 && !item.hasDiscount;
                                        const potentialDiscountedPrice = hasBlindBoxDiscount ? item.originalPrice * (1 - BLIND_BOX_DISCOUNT_PERCENT / 100) : item.originalPrice;
                                        
                                        return (
                                        <Box 
                                            key={item.id}
                                            sx={{ 
                                                width: 'calc(50% - 8px)',
                                                maxWidth: 'calc(50% - 8px)'
                                            }}
                                        >
                                            <Box sx={{ 
                                                position: 'relative', 
                                                borderRadius: 2, 
                                                overflow: 'hidden', 
                                                paddingTop: '100%', 
                                                backgroundColor: 'grey.200' 
                                            }}>
                                                <img 
                                                    src={item.imageUrl || PLACEHOLDER_IMAGE} 
                                                    alt={item.title} 
                                                    style={{ 
                                                        position: 'absolute', 
                                                        top: 0, 
                                                        left: 0, 
                                                        width: '100%', 
                                                        height: '100%', 
                                                        objectFit: 'cover' 
                                                    }} 
                                                />
                                                {/* Discount badge - show when discount applied OR when showing potential */}
                                                {(item.hasDiscount || showPotentialDiscount) && (
                                                    <Box
                                                        sx={{
                                                            position: 'absolute',
                                                            top: 8,
                                                            left: 8,
                                                            bgcolor: '#2e7d32',
                                                            color: 'white',
                                                            px: 1,
                                                            py: 0.5,
                                                            borderRadius: 1,
                                                            fontSize: '1.6rem',
                                                            fontWeight: 700,
                                                            boxShadow: 1
                                                        }}
                                                    >
                                                        {item.hasDiscount ? `${item.discountPercent}% OFF` : `${BLIND_BOX_DISCOUNT_PERCENT}% OFF`}
                                                    </Box>
                                                )}
                                                {/* Checkmark badge - top right corner */}
                                                <Box
                                                    sx={{
                                                        position: 'absolute',
                                                        top: 8,
                                                        right: 8,
                                                        bgcolor: '#2e7d32',
                                                        color: 'white',
                                                        borderRadius: '50%',
                                                        width: 28,
                                                        height: 28,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />
                                                </Box>
                                            </Box>
                                            <Typography variant="body2" sx={{ mt: 1, fontWeight: 600, fontSize: '1.6rem' }} noWrap>
                                                {item.product?.name || item.title}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '1.6rem' }}>
                                                {item.hasDiscount ? (
                                                    <>
                                                        <Typography 
                                                            component="span" 
                                                            sx={{ 
                                                                color: '#2e7d32', 
                                                                fontWeight: 600,
                                                                fontSize: '1.6rem',
                                                                mr: 1
                                                            }}
                                                        >
                                                            ${item.discountedPrice.toFixed(2)}
                                                        </Typography>
                                                        <Typography 
                                                            component="span" 
                                                            sx={{ 
                                                                textDecoration: 'line-through',
                                                                color: 'text.disabled',
                                                                fontSize: '1.6rem'
                                                            }}
                                                        >
                                                            ${item.originalPrice.toFixed(2)}
                                                        </Typography>
                                                    </>
                                                ) : showPotentialDiscount ? (
                                                    // Show potential discounted price when 1 box in cart
                                                    <>
                                                        <Typography 
                                                            component="span" 
                                                            sx={{ 
                                                                color: '#2e7d32', 
                                                                fontWeight: 600,
                                                                fontSize: '1.6rem',
                                                                mr: 1
                                                            }}
                                                        >
                                                            ${potentialDiscountedPrice.toFixed(2)}
                                                        </Typography>
                                                        <Typography 
                                                            component="span" 
                                                            sx={{ 
                                                                textDecoration: 'line-through',
                                                                color: 'text.disabled',
                                                                fontSize: '1.6rem'
                                                            }}
                                                        >
                                                            ${item.originalPrice.toFixed(2)}
                                                        </Typography>
                                                    </>
                                                ) : (
                                                    `$${item.originalPrice.toFixed(2)}`
                                                )}
                                            </Typography>
                                        </Box>
                                    );
                                    })}
                                    
                                    {/* Add another box CTA - always show */}
                                    <Box 
                                        onClick={() => {
                                            setShowBlindBoxSelector(true);
                                        }}
                                        sx={{ 
                                            cursor: 'pointer',
                                            width: 'calc(50% - 8px)',
                                            maxWidth: 'calc(50% - 8px)',
                                            '&:hover': { 
                                                '& .add-box': {
                                                    borderColor: '#000',
                                                    bgcolor: '#f5f5f5'
                                                }
                                            }
                                        }}
                                    >
                                        <Box 
                                            className="add-box"
                                            sx={{ 
                                                position: 'relative', 
                                                borderRadius: 2, 
                                                paddingTop: '100%', 
                                                backgroundColor: 'white',
                                                border: '2px dashed #333',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    p: 2,
                                                    textAlign: 'center'
                                                }}
                                            >
                                                <AddIcon sx={{ fontSize: 40, color: '#333', mb: 1 }} />
                                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', fontSize: '1.6rem' }}>
                                                    Add another blind box
                                                </Typography>
                                                <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 700, mt: 0.5, fontSize: '1.6rem' }}>
                                                    {blindBoxCartItems.some(item => item.hasDiscount)
                                                        ? 'Keep saving!'
                                                        : `Unlock ${BLIND_BOX_DISCOUNT_PERCENT}% off all!`
                                                    }
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>
                            </Container>
                        ) : (
                            /* Regular Recommendations Section - For non-blind-box products */
                            getAddedToCartRecommendations().length > 0 && (
                            <Container maxWidth="sm" sx={{ mt: 4, px: 2 }}>
                                {/* Promotion Banner */}
                                {addedProduct?.crosssellPromotion && (
                                    <Box 
                                        sx={{ 
                                            bgcolor: '#e8f5e9', 
                                            borderRadius: 2, 
                                            p: 2, 
                                            mb: 2,
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 1.5
                                        }}
                                    >
                                        <LocalOfferIcon sx={{ color: '#2e7d32', flexShrink: 0, mt: 0.25 }} />
                                        <Box>
                                            {addedProduct.crosssellPromotion.title && (
                                                <Typography variant="body1" sx={{ fontWeight: 600, color: '#2e7d32', fontSize: '1.6rem' }}>
                                                    {addedProduct.crosssellPromotion.title}
                                                </Typography>
                                            )}
                                            {addedProduct.crosssellPromotion.description && (
                                                <Typography variant="body2" sx={{ color: '#1b5e20', fontSize: '1.6rem' }}>
                                                    {addedProduct.crosssellPromotion.description}
                                                </Typography>
                                            )}
                                            {addedProduct.crosssellPromotion.discount && !addedProduct.crosssellPromotion.description && (
                                                <Typography variant="body2" sx={{ color: '#1b5e20', fontWeight: 600, fontSize: '1.6rem' }}>
                                                    {addedProduct.crosssellPromotion.discount}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                )}
                                
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                    You might also like
                                </Typography>
                                <Box sx={{ 
                                    display: 'flex', 
                                    flexWrap: 'wrap', 
                                    gap: 2
                                }}>
                                    {getAddedToCartRecommendations().map((product) => (
                                        <Box 
                                            key={product.id}
                                            onClick={() => {
                                                handleChooseProduct(product.id);
                                            }}
                                            sx={{ 
                                                cursor: 'pointer', 
                                                width: 'calc(50% - 8px)',
                                                maxWidth: 'calc(50% - 8px)',
                                                '&:hover': { opacity: 0.8 }
                                            }}
                                        >
                                            <Box sx={{ 
                                                position: 'relative', 
                                                borderRadius: 2, 
                                                overflow: 'hidden', 
                                                paddingTop: '100%', 
                                                backgroundColor: 'grey.200' 
                                            }}>
                                                <img 
                                                    src={product.imageUrl || product.images?.[0]?.url || PLACEHOLDER_IMAGE} 
                                                    alt={product.name || product.title} 
                                                    style={{ 
                                                        position: 'absolute', 
                                                        top: 0, 
                                                        left: 0, 
                                                        width: '100%', 
                                                        height: '100%', 
                                                        objectFit: 'cover' 
                                                    }} 
                                                />
                                                {/* Discount badge - if crosssell promotion exists */}
                                                {addedProduct?.crosssellPromotion?.discount && (
                                                    <Box
                                                        sx={{
                                                            position: 'absolute',
                                                            top: 8,
                                                            left: 8,
                                                            bgcolor: '#2e7d32',
                                                            color: 'white',
                                                            px: 1,
                                                            py: 0.5,
                                                            borderRadius: 1,
                                                            fontSize: '1.6rem',
                                                            fontWeight: 700,
                                                            boxShadow: 1
                                                        }}
                                                    >
                                                        {addedProduct.crosssellPromotion.discount}
                                                    </Box>
                                                )}
                                            </Box>
                                            <Typography variant="body1" sx={{ mt: 1, fontWeight: 600 }}>
                                                {product.name || product.title}
                                            </Typography>
                                            {/* Price with discount */}
                                            {(() => {
                                                const discount = addedProduct?.crosssellPromotion?.discount;
                                                const originalPrice = parseFloat(product.price?.replace('$', '') || 0);
                                                
                                                if (discount && originalPrice > 0) {
                                                    // Parse discount - handle formats like "50% OFF", "50%", "$5 OFF", "FREE"
                                                    let discountedPrice = originalPrice;
                                                    const discountLower = discount.toLowerCase();
                                                    
                                                    if (discountLower === 'free' || discountLower === '100% off' || discountLower === '100%') {
                                                        discountedPrice = 0;
                                                    } else if (discount.includes('%')) {
                                                        const percent = parseFloat(discount.match(/(\d+)/)?.[1] || 0);
                                                        discountedPrice = originalPrice * (1 - percent / 100);
                                                    } else if (discount.includes('$')) {
                                                        const amount = parseFloat(discount.match(/(\d+\.?\d*)/)?.[1] || 0);
                                                        discountedPrice = Math.max(0, originalPrice - amount);
                                                    }
                                                    
                                                    return (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 600, fontSize: '1.6rem' }}>
                                                                ${discountedPrice.toFixed(2)}
                                                            </Typography>
                                                            <Typography 
                                                                variant="body2" 
                                                                sx={{ textDecoration: 'line-through', color: 'text.disabled', fontSize: '1.6rem' }}
                                                            >
                                                                {product.price}
                                                            </Typography>
                                                        </Box>
                                                    );
                                                }
                                                
                                                return (
                                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '1.6rem' }}>
                                                        {product.price}
                                                    </Typography>
                                                );
                                            })()}
                                        </Box>
                                    ))}
                                </Box>
                            </Container>
                            )
                        )}
                        
                        {/* Continue Exploring Section */}
                        <Container maxWidth="sm" sx={{ mt: 4, px: 2 }}>
                            <Box sx={{ borderTop: '1px solid', borderColor: 'grey.200', pt: 3 }} />
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, textAlign: 'center' }}>
                                Continue Exploring
                            </Typography>
                            
                            {/* Category Tiles - 2 Column Grid - Dynamic from API */}
                            <Box sx={{ 
                                display: 'flex', 
                                flexWrap: 'wrap', 
                                gap: 2
                            }}>
                                {categories?.map((cat) => (
                                    <Box 
                                        key={cat.id}
                                        onClick={() => {
                                            handleCloseAddedToCart();
                                            navigate(`/${cat.handle}`);
                                            window.scrollTo(0, 0);
                                        }}
                                        sx={{ 
                                            cursor: 'pointer', 
                                            width: 'calc(50% - 8px)',
                                            maxWidth: 'calc(50% - 8px)',
                                            '&:hover': { opacity: 0.8 }
                                        }}
                                    >
                                        <Box sx={{ 
                                            position: 'relative', 
                                            borderRadius: 2, 
                                            overflow: 'hidden', 
                                            paddingTop: '100%', 
                                            backgroundColor: 'grey.200' 
                                        }}>
                                            <img 
                                                src={cat.image?.url || `https://placehold.co/400x400/e0e0e0/666666?text=${encodeURIComponent(cat.title)}`} 
                                                alt={cat.title} 
                                                style={{ 
                                                    position: 'absolute', 
                                                    top: 0, 
                                                    left: 0, 
                                                    width: '100%', 
                                                    height: '100%', 
                                                    objectFit: 'cover' 
                                                }}
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = `https://placehold.co/400x400/e0e0e0/666666?text=${encodeURIComponent(cat.title)}`;
                                                }}
                                            />
                                        </Box>
                                        <Typography variant="body1" align="center" sx={{ mt: 1, fontWeight: 600 }}>
                                            {cat.title}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Container>
                    </Box>
                ) : (
                <>
                {/* Category Tiles - ONLY show on homepage - Dynamic from API */}
                {isHomepage && (
                    <Container maxWidth="sm" sx={{ pt: 3, pb: 2 }}>
                        <Box 
                            sx={{ 
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 2,
                                maxWidth: '500px',
                                margin: '0 auto',
                                justifyContent: 'center'
                            }}
                        >
                            {categories?.map((cat) => (
                                <Box 
                                    key={cat.id}
                                    onClick={() => {
                                        navigate(`/${cat.handle}`);
                                        window.scrollTo(0, 0);
                                    }}
                                    sx={{ 
                                        cursor: 'pointer',
                                        width: 'calc(50% - 8px)',
                                        '&:hover': { opacity: 0.8 }
                                    }}
                                >
                                    <Box
                                        sx={{
                                            position: 'relative',
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                            paddingTop: '100%',
                                            backgroundColor: 'grey.200'
                                        }}
                                    >
                                        <img
                                            src={cat.image?.url || `https://placehold.co/300x300/e0e0e0/666666?text=${encodeURIComponent(cat.title)}`}
                                            alt={cat.title}
                                            onError={(e) => {
                                                e.target.src = `https://placehold.co/300x300/e0e0e0/666666?text=${encodeURIComponent(cat.title)}`;
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    </Box>
                                    <Typography variant="body1" align="center" sx={{ mt: 1, fontWeight: 600 }}>
                                        {cat.title}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </Container>
                )}

                {/* Hero Section - ONLY show on homepage */}
                {isHomepage && (
                    <Box 
                        sx={{ 
                            position: 'relative',
                            width: '100%',
                            maxWidth: '600px',
                            margin: '0 auto',
                            mb: 4
                        }}
                    >
                    <img
                        src="https://images.surrealcreamery.com/commerce/mozzarella_hero_image.png"
                        alt="tokidoki x Surreal Creamery"
                        style={{
                            width: '100%',
                            height: 'auto',
                            display: 'block',
                            borderRadius: '2px'
                        }}
                    />
                </Box>
                )}

                {/* Main Headline - ONLY show on homepage */}
                {isHomepage && (
                    <Container maxWidth="sm" sx={{ mb: 4 }}>
                    <Typography 
                        variant="h2" 
                        component="h1" 
                        align="center" 
                        sx={{ 
                            mb: 2, 
                            px: 2,
                            fontWeight: 700,
                            fontSize: { xs: '2rem', md: '2.5rem' }
                        }}
                    >
                        Let's celebrate tokidoki at Surreal Creamery
                    </Typography>
                    <Typography 
                        variant="h5" 
                        align="center" 
                        color="text.secondary"
                        sx={{ px: 2 }}
                    >
                        Exclusive desserts, merch, giveaways & kawaii photo ops!
                    </Typography>
                </Container>
                )}

                {/* Product Section - Different layouts based on route */}
                {isHomepage ? (
                    /* HOMEPAGE VIEW */
                    <>
                        {/* Featured Products Section */}
                        <Section
                            title="Featured tokidoki Collection"
                            description="Limited edition exclusives"
                            products={displayProducts}
                            onProductClick={handleChooseProduct}
                            showDivider={false}
                        />

                        {/* Browse All CTA */}
                        <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={() => {
                                    // Navigate to first category
                                    const firstCategory = categories?.[0];
                                    navigate(firstCategory ? `/${firstCategory.handle}` : '/desserts');
                                    window.scrollTo(0, 0);
                                }}
                                sx={{
                                    backgroundColor: 'black',
                                    color: 'white',
                                    fontSize: '1.6rem',
                                    fontWeight: 400,
                                    textTransform: 'none',
                                    px: 4,
                                    py: 1.5,
                                    borderRadius: '50px',
                                    '&:hover': {
                                        backgroundColor: '#333'
                                    }
                                }}
                            >
                                Browse All Products
                            </Button>
                        </Container>
                    </>
                ) : isDesserts ? (
                    /* DESSERTS CATALOG VIEW - Sections by subcategory */
                    <Box sx={{ mb: 6 }}>
                        {/* Breadcrumb Navigation */}
                        <Container maxWidth="sm" sx={{ pt: 2, pb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography
                                    onClick={() => {
                                        navigate('/');
                                        window.scrollTo(0, 0);
                                    }}
                                    sx={{
                                        color: 'text.secondary',
                                        cursor: 'pointer',
                                        '&:hover': { textDecoration: 'underline' }
                                    }}
                                >
                                    Shop
                                </Typography>
                                <Typography sx={{ color: 'text.secondary' }}>/</Typography>
                                <Typography sx={{ fontWeight: 600 }}>
                                    {pageTitle}
                                </Typography>
                            </Box>
                        </Container>

                        <Container maxWidth="sm" sx={{ mb: 4 }}>

                            {/* Subcategory Navigation Tiles - Click to scroll to section */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 2,
                                    maxWidth: '500px',
                                    mx: 'auto',
                                    mb: 4,
                                    justifyContent: 'center'
                                }}
                            >
                                {DESSERT_SUBCATEGORIES.map((subcat) => (
                                    <Box
                                        key={subcat.id}
                                        onClick={() => scrollToSection(subcat.id)}
                                        sx={{
                                            cursor: 'pointer',
                                            width: 'calc(33.333% - 11px)',
                                            '&:hover': { opacity: 0.8 }
                                        }}
                                    >
                                        <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', paddingTop: '100%', backgroundColor: 'grey.200' }}>
                                            <img
                                                src={subcat.image}
                                                alt={subcat.title}
                                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            {/* ZONE 1: Banner on subcategory tile (no discount for desserts) */}
                                            <DiscountZonePlaceholder zone={1} variant="banner" />
                                        </Box>
                                        <Typography variant="body1" align="center" sx={{ mt: 1, fontWeight: 600 }}>
                                            {subcat.title}
                                        </Typography>
                                        {/* ZONE 1: Below subcategory name */}
                                        <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'center' }}>
                                            <DiscountZonePlaceholder zone={1} variant="inline" />
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Container>

                        {/* Product Sections - One per subcategory */}
                        {DESSERT_SUBCATEGORIES.map((subcat, index) => {
                            const sectionProducts = productsBySubcategory[subcat.id] || [];
                            
                            // Skip empty sections
                            if (sectionProducts.length === 0) return null;
                            
                            return (
                                <Box 
                                    key={subcat.id} 
                                    id={`section-${subcat.id}`}
                                    sx={{ scrollMarginTop: '80px' }} // Offset for fixed header if any
                                >
                                    <Section
                                        title={subcat.title}
                                        description={subcat.description}
                                        products={sectionProducts}
                                        onProductClick={handleChooseProduct}
                                        showDivider={index > 0}
                                    />
                                </Box>
                            );
                        })}
                    </Box>
                ) : isMerchandise ? (
                    /* MERCHANDISE CATALOG VIEW - Sections by subcategory */
                    <Box sx={{ mb: 6 }}>
                        {/* Breadcrumb Navigation */}
                        <Container maxWidth="sm" sx={{ pt: 2, pb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography
                                    onClick={() => navigate('/')}
                                    sx={{
                                        color: 'text.secondary',
                                        cursor: 'pointer',
                                        '&:hover': { textDecoration: 'underline' }
                                    }}
                                >
                                    Shop
                                </Typography>
                                <Typography sx={{ color: 'text.secondary' }}>/</Typography>
                                <Typography sx={{ fontWeight: 600 }}>
                                    {pageTitle}
                                </Typography>
                            </Box>
                        </Container>

                        <Container maxWidth="sm" sx={{ mb: 4 }}>

                            {/* Subcategory Navigation Tiles - Click to scroll to section */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 2,
                                    maxWidth: '500px',
                                    mx: 'auto',
                                    mb: 4,
                                    justifyContent: 'center'
                                }}
                            >
                                {MERCHANDISE_SUBCATEGORIES.map((subcat) => {
                                    const isBlindBoxTile = subcat.id === 'blind-box' || subcat.title?.toLowerCase().includes('blind box');
                                    // Get the free gift discount for blind boxes
                                    const blindBoxFreeGift = isBlindBoxTile && quantityDiscountGroups.length > 0 ? {
                                        type: 'freeItem',
                                        quantityRequired: quantityDiscountGroups[0]?.threshold,
                                        current: blindBoxesInCart,
                                        remaining: Math.max(0, (quantityDiscountGroups[0]?.threshold || 3) - blindBoxesInCart),
                                        freeItemName: 'gift',
                                        options: quantityDiscountGroups[0]?.options || []
                                    } : null;

                                    return (
                                        <Box
                                            key={subcat.id}
                                            sx={{
                                                width: 'calc(50% - 8px)'
                                            }}
                                        >
                                            <Box
                                                onClick={() => scrollToSection(subcat.id)}
                                                sx={{
                                                    cursor: 'pointer',
                                                    '&:hover': { opacity: 0.8 }
                                                }}
                                            >
                                                <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', paddingTop: '100%', backgroundColor: 'grey.200' }}>
                                                    <img
                                                        src={subcat.image}
                                                        alt={subcat.title}
                                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                    {/* ZONE 1: Banner on subcategory tile */}
                                                    <DiscountZonePlaceholder
                                                        zone={1}
                                                        variant="banner"
                                                        discount={blindBoxFreeGift}
                                                        subcategoryName="Blind Boxes"
                                                        products={shopifyProducts}
                                                    />
                                                </Box>
                                                <Typography variant="body1" align="center" sx={{ mt: 1, fontWeight: 600 }}>
                                                    {subcat.title}
                                                </Typography>
                                                {/* ZONE 1: Below subcategory name */}
                                                <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'center' }}>
                                                    <DiscountZonePlaceholder
                                                        zone={1}
                                                        variant="inline"
                                                        discount={blindBoxFreeGift}
                                                        subcategoryName="Blind Boxes"
                                                        products={shopifyProducts}
                                                    />
                                                </Box>
                                            </Box>

                                            {/* Contextual offer below blind box tile - only show when 1+ in cart AND we have valid discount data */}
                                            {isBlindBoxTile && blindBoxesInCart >= 1 && hasBlindBoxDiscount && (
                                                <Box 
                                                    onClick={handleReturnToCrossSell}
                                                    sx={{ 
                                                        mt: 1,
                                                        p: 1,
                                                        borderRadius: 1,
                                                        cursor: 'pointer',
                                                        bgcolor: '#e8f5e9',
                                                        border: '1px solid',
                                                        borderColor: '#4caf50',
                                                        '&:hover': { 
                                                            transform: 'translateY(-1px)',
                                                            boxShadow: 1
                                                        },
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <Typography 
                                                        align="center" 
                                                        sx={{ 
                                                            fontSize: '1.6rem', 
                                                            fontWeight: 600,
                                                            color: '#1b5e20'
                                                        }}
                                                    >
                                                        {isDiscountUnlocked
                                                            ? `✓ ${blindBoxesInCart} in bag`
                                                            : (hasBlindBoxDiscount ? `Add ${blindBoxesNeededForDiscount} more for ${BLIND_BOX_DISCOUNT_PERCENT}% off!` : `✓ ${blindBoxesInCart} in bag`)
                                                        }
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Container>
                        
                        {/* Product Sections - One per subcategory */}
                        {MERCHANDISE_SUBCATEGORIES.map((subcat, index) => {
                            const sectionProducts = productsBySubcategory[subcat.id] || [];
                            
                            // Skip empty sections
                            if (sectionProducts.length === 0) return null;
                            
                            // Check if this is the blind box section
                            const isBlindBoxSection = subcat.id === 'blind-box' || subcat.title?.toLowerCase().includes('blind box');
                            
                            // Offer banner for blind box section - changes based on cart state
                            // Only show if we have valid discount data (percent AND quantity threshold)
                            const blindBoxOfferBanner = isBlindBoxSection && hasBlindBoxDiscount ? (
                                isDiscountUnlocked ? (
                                    // Active discount - show clickable "continue" banner
                                    <Box
                                        onClick={handleReturnToCrossSell}
                                        sx={{
                                            bgcolor: '#e8f5e9',
                                            border: '2px solid #4caf50',
                                            borderRadius: 2,
                                            p: 2,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            '&:hover': {
                                                bgcolor: '#c8e6c9',
                                                transform: 'translateY(-2px)',
                                                boxShadow: 2
                                            },
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <CheckCircleIcon sx={{ fontSize: '2rem', color: '#2e7d32' }} />
                                        <Box sx={{ flex: 1 }}>
                                            <Typography sx={{ fontWeight: 700, fontSize: '1.6rem', color: '#1b5e20' }}>
                                                {BLIND_BOX_DISCOUNT_PERCENT}% Off Unlocked!
                                            </Typography>
                                            <Typography sx={{ fontSize: '1.6rem', color: '#2e7d32' }}>
                                                {blindBoxesInCart} in bag. Add more to save even more!
                                            </Typography>
                                        </Box>
                                        <Typography sx={{ fontSize: '1.6rem', color: '#2e7d32', fontWeight: 600 }}>
                                            View Bag →
                                        </Typography>
                                    </Box>
                                ) : blindBoxesInCart > 0 && blindBoxesNeededForDiscount > 0 ? (
                                    // Has blind boxes but not enough - show clickable "almost there" banner
                                    <Box
                                        onClick={handleReturnToCrossSell}
                                        sx={{
                                            bgcolor: '#fff8e1',
                                            border: '2px solid #ffb300',
                                            borderRadius: 2,
                                            p: 2,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            '&:hover': {
                                                bgcolor: '#fff3c4',
                                                transform: 'translateY(-2px)',
                                                boxShadow: 2
                                            },
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <LocalOfferIcon sx={{ fontSize: '2rem', color: '#ff6f00' }} />
                                        <Box sx={{ flex: 1 }}>
                                            <Typography sx={{ fontWeight: 700, fontSize: '1.6rem', color: '#e65100' }}>
                                                Almost There!
                                            </Typography>
                                            <Typography sx={{ fontSize: '1.6rem', color: '#6d4c00' }}>
                                                Add {blindBoxesNeededForDiscount} more to unlock {BLIND_BOX_DISCOUNT_PERCENT}% off!
                                            </Typography>
                                        </Box>
                                        <Typography sx={{ fontSize: '1.6rem', color: '#ff6f00', fontWeight: 600 }}>
                                            View Bag →
                                        </Typography>
                                    </Box>
                                ) : (
                                    // No blind boxes - show static promo banner
                                    <Box
                                        sx={{
                                            bgcolor: '#e8f5e9',
                                            border: '2px solid #4caf50',
                                            borderRadius: 2,
                                            p: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2
                                        }}
                                    >
                                        <LocalOfferIcon sx={{ fontSize: '2rem', color: '#2e7d32' }} />
                                        <Box>
                                            <Typography sx={{ fontWeight: 700, fontSize: '1.6rem', color: '#1b5e20' }}>
                                                {BLIND_BOX_DISCOUNT_PERCENT}% Off When You Buy {BLIND_BOX_QUANTITY_THRESHOLD}+
                                            </Typography>
                                            <Typography sx={{ fontSize: '1.6rem', color: '#2e7d32' }}>
                                                Mix & match any blind boxes to unlock the discount!
                                            </Typography>
                                        </Box>
                                    </Box>
                                )
                            ) : null;
                            
                            // Build discount data for blind box section
                            const blindBoxSectionDiscount = isBlindBoxSection && quantityDiscountGroups.length > 0 ? {
                                type: 'freeItem',
                                title: `Buy ${quantityDiscountGroups[0]?.threshold}, get free item!`,
                                quantityRequired: quantityDiscountGroups[0]?.threshold,
                                current: blindBoxesInCart,
                                remaining: Math.max(0, (quantityDiscountGroups[0]?.threshold || 3) - blindBoxesInCart),
                                freeItemName: 'gift',
                                options: quantityDiscountGroups[0]?.options || []
                            } : null;

                            // Zone 3 is for product-specific discounts only, not collection discounts
                            // Collection discounts are shown in Zone 2 (sectionDiscount)
                            const blindBoxProductDiscount = null;

                            return (
                                <Box
                                    key={subcat.id}
                                    id={`section-${subcat.id}`}
                                    sx={{ scrollMarginTop: '80px' }} // Offset for fixed header if any
                                >
                                    <Section
                                        title={subcat.title}
                                        description={subcat.description}
                                        products={sectionProducts}
                                        onProductClick={handleChooseProduct}
                                        showDivider={index > 0}
                                        afterDescription={blindBoxOfferBanner}
                                        discountPercent={isBlindBoxSection && hasBlindBoxDiscount && blindBoxesInCart >= 1 ? BLIND_BOX_DISCOUNT_PERCENT : null}
                                        sectionDiscount={blindBoxSectionDiscount}
                                        productDiscount={blindBoxProductDiscount}
                                        subcategoryName={isBlindBoxSection ? "Blind Boxes" : subcat.title}
                                        allProducts={shopifyProducts}
                                    />
                                </Box>
                            );
                        })}
                    </Box>
                ) : productId ? (
                    /* PRODUCT PAGE - Show minimal background content while modal is open */
                    <Box sx={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            Loading product...
                        </Typography>
                        <Button 
                            variant="outlined" 
                            onClick={() => navigate('/')}
                            sx={{ mt: 2 }}
                        >
                            Back to Shop
                        </Button>
                    </Box>
                ) : null}
                </>
                )}

                {/* About Section */}
                <Box sx={{ backgroundColor: 'grey.50', py: 6, mt: 6 }}>
                    <Container maxWidth="sm">
                        <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                            About the Collaboration
                        </Typography>
                        <Typography variant="body1" paragraph>
                            Surreal Creamery partners with tokidoki to bring you an exclusive collection of desserts and collectibles. Each item features beloved tokidoki characters reimagined in delicious new ways.
                        </Typography>
                        <Typography variant="body1">
                            Available for a limited time at select Surreal Creamery locations.
                        </Typography>
                    </Container>
                </Box>
            </Box>

            {/* Product Modal */}
            {(() => {
                console.log('🎭 Modal Render Check:', {
                    showProductModal,
                    hasSelectedProductId: !!selectedProductId,
                    hasSelectedProduct: !!selectedProduct,
                    selectedProductName: selectedProduct?.name
                });
                
                if (!showProductModal || !selectedProductId) {
                    console.log('❌ Modal NOT rendering - conditions not met');
                    return null;
                }
                
                if (!selectedProduct) {
                    console.log('⏳ Modal NOT rendering - product loading...');
                    return (
                        <Box sx={{ p: 4, textAlign: 'center' }}>
                            <CircularProgress />
                            <Typography sx={{ mt: 2, fontSize: '1.6rem' }}>
                                Loading product...
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, display: 'block', fontSize: '1.6rem' }}>
                                ID: {typeof selectedProductId === 'string' ? selectedProductId : selectedProductId?.id || 'Unknown'}
                            </Typography>
                        </Box>
                    );
                }
                
                console.log('✅ Modal SHOULD BE RENDERING - calling ProductModal component');
                console.log('📦 Passing product:', selectedProduct.name);
                console.log('📦 Passing open:', showProductModal);
                console.log('📦 Variant info:', selectedVariantInfo.current);
                
                // Merge variant info with base product if a specific variant was clicked
                const variantInfo = selectedVariantInfo.current;
                let productForModal;
                
                if (variantInfo?.availableVariants && variantInfo.availableVariants.length > 1) {
                    // Grouped product with multiple variants - show selector
                    // Exclude original variants array from selectedProduct
                    const { variants: _allVariants, ...productWithoutVariants } = selectedProduct;
                    
                    productForModal = {
                        ...productWithoutVariants,
                        name: variantInfo.name,
                        price: variantInfo.price,
                        imageUrl: variantInfo.imageUrl,
                        imageAlt: variantInfo.imageAlt,
                        images: variantInfo.imageUrl 
                            ? [{ url: variantInfo.imageUrl, alt: variantInfo.imageAlt }]
                            : selectedProduct.images,
                        // Pass only the subcategory-specific variants for selector
                        availableVariants: variantInfo.availableVariants,
                        variantId: null // Will be set when user selects
                    };
                } else if (variantInfo) {
                    // Single variant product - show full name with variant
                    let variantDisplay = variantInfo.variantTitle;
                    if (variantInfo.variantTitle && variantInfo.variantTitle !== 'Default') {
                        variantDisplay = variantInfo.variantTitle
                            .replace(/Ice Cream Cake /i, '')
                            .replace(/ Ice Cream/i, '');
                    }
                    const fullName = variantInfo.variantTitle && variantInfo.variantTitle !== 'Default'
                        ? `${variantInfo.name} - ${variantDisplay}`
                        : variantInfo.name;
                    
                    // Exclude original variants array from selectedProduct
                    const { variants: _allVariants, ...productWithoutVariants } = selectedProduct;
                    
                    productForModal = {
                        ...productWithoutVariants,
                        name: fullName,
                        price: variantInfo.price,
                        variantId: variantInfo.variantId,
                        variantTitle: variantInfo.variantTitle,
                        imageUrl: variantInfo.imageUrl,
                        imageAlt: variantInfo.imageAlt,
                        images: variantInfo.imageUrl 
                            ? [{ url: variantInfo.imageUrl, alt: variantInfo.imageAlt }]
                            : selectedProduct.images,
                        // Pass availableVariants so modal can check hasVariantImage
                        availableVariants: variantInfo.availableVariants || null
                    };
                } else {
                    productForModal = selectedProduct;
                }
                
                // Determine if this product has a discount (blind box products get free gift discount)
                const isBlindBoxProduct = productForModal?.merchandiseType === 'blind_box_collectible';
                console.log('🎯 ProductModal discount check:', {
                    merchandiseType: productForModal?.merchandiseType,
                    isBlindBoxProduct,
                    quantityDiscountGroups: quantityDiscountGroups.length,
                    blindBoxesInCart
                });
                const modalDiscount = isBlindBoxProduct && quantityDiscountGroups.length > 0 ? {
                    type: 'freeItem',
                    title: `Buy ${quantityDiscountGroups[0]?.threshold}, get free item!`,
                    quantityRequired: quantityDiscountGroups[0]?.threshold,
                    current: blindBoxesInCart,
                    remaining: Math.max(0, (quantityDiscountGroups[0]?.threshold || 3) - blindBoxesInCart),
                    freeItemName: 'gift',
                    options: quantityDiscountGroups[0]?.options || []
                } : null;
                console.log('🎯 Modal discount:', modalDiscount);

                return (
                    <ProductModal
                        open={showProductModal}
                        product={productForModal}
                        onClose={handleCloseProductModal}
                        onAddToCart={handleAddToCart}
                        discount={modalDiscount}
                    />
                );
            })()}

            {/* Cart Drawer */}
            <CartDrawer
                open={showCartDrawer}
                onClose={() => sendToCommerce({ type: 'CLOSE_CART' })}
                recommendations={getRecommendations()}
                onProductClick={handleChooseProduct}
                quantityProgress={quantityProgress}
                selectedRewards={selectedRewards}
                onSelectReward={handleSelectReward}
                orderDiscounts={orderDiscounts}
                onAddBlindBox={() => setShowBlindBoxSelector(true)}
            />
            
            {/* Blind Box Selector Modal */}
            <Modal
                open={showBlindBoxSelector}
                onClose={() => setShowBlindBoxSelector(false)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2
                }}
            >
                <Box
                    sx={{
                        bgcolor: 'white',
                        borderRadius: 2,
                        maxWidth: 500,
                        width: '100%',
                        maxHeight: '80vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {/* Modal Header */}
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        p: 2,
                        borderBottom: '1px solid',
                        borderColor: 'grey.200'
                    }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.8rem' }}>
                                Select a Blind Box
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 600, fontSize: '1.6rem' }}>
                                {hasBlindBoxDiscount
                                    ? (blindBoxCartItems.some(item => item.hasDiscount)
                                        ? `Save ${blindBoxCartItems[0]?.discountPercent || BLIND_BOX_DISCOUNT_PERCENT}%!`
                                        : `Unlock ${BLIND_BOX_DISCOUNT_PERCENT}% off all blind boxes!`)
                                    : 'Choose your surprise!'
                                }
                            </Typography>
                        </Box>
                        <IconButton onClick={() => setShowBlindBoxSelector(false)} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    
                    {/* Blind Box List */}
                    <Box sx={{ 
                        flex: 1, 
                        overflowY: 'auto',
                        p: 2
                    }}>
                        {getAvailableBlindBoxes.map((product) => (
                            <Box
                                key={product.id}
                                onClick={() => handleAddBlindBoxFromSelector(product)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    p: 1.5,
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    border: '1px solid',
                                    borderColor: 'grey.200',
                                    mb: 1.5,
                                    '&:hover': {
                                        bgcolor: '#f5f5f5',
                                        borderColor: '#333'
                                    },
                                    '&:last-child': {
                                        mb: 0
                                    }
                                }}
                            >
                                {/* Product Image */}
                                <Box
                                    sx={{
                                        width: 70,
                                        height: 70,
                                        borderRadius: 1,
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                        bgcolor: 'grey.100',
                                        position: 'relative'
                                    }}
                                >
                                    <img
                                        src={product.imageUrl || product.images?.[0]?.url || PLACEHOLDER_IMAGE}
                                        alt={product.name}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                    {/* Discount badge when 1+ in cart and we have valid discount data */}
                                    {blindBoxesInCart >= 1 && hasBlindBoxDiscount && (
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                top: 4,
                                                left: 4,
                                                bgcolor: '#2e7d32',
                                                color: 'white',
                                                px: 0.5,
                                                py: 0.25,
                                                borderRadius: 0.5,
                                                fontSize: '1rem',
                                                fontWeight: 700
                                            }}
                                        >
                                            {BLIND_BOX_DISCOUNT_PERCENT}%
                                        </Box>
                                    )}
                                </Box>
                                
                                {/* Product Info */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1.6rem' }} noWrap>
                                        {product.name}
                                    </Typography>
                                    {/* Show discounted price when adding would unlock/continue discount */}
                                    {blindBoxesInCart >= 1 && hasBlindBoxDiscount ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 600, fontSize: '1.6rem' }}>
                                                ${(parseFloat(product.price?.replace('$', '') || 0) * (1 - BLIND_BOX_DISCOUNT_PERCENT / 100)).toFixed(2)}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'text.disabled', textDecoration: 'line-through', fontSize: '1.6rem' }}>
                                                {product.price}
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '1.6rem' }}>
                                            {product.price}
                                        </Typography>
                                    )}
                                </Box>
                                
                                {/* Add Icon */}
                                <AddIcon sx={{ color: '#333', flexShrink: 0 }} />
                            </Box>
                        ))}
                        
                        {getAvailableBlindBoxes.length === 0 && (
                            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4, fontSize: '1.6rem' }}>
                                No other blind boxes available
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Modal>
        </>
    );
}
