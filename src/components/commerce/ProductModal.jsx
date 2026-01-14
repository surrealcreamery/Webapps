import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogActions,
    Button,
    Box,
    Typography,
    useMediaQuery,
    useTheme,
    CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { ProductImageCarousel } from './ProductImageCarousel';
import { useShopify } from '@/contexts/commerce/ShopifyContext_GraphQL';
import { DiscountZonePlaceholder } from './DiscountZonePlaceholder';
import { getBestDeliveryEstimate, getShippingEstimate, getEstimatedDeliveryDates } from '@/components/commerce/geolocation';
import { ModifierSelector } from './ModifierSelector';
import { selectionsToCustomAttributes } from '@/services/squareModifiers';

// Placeholder image
const PLACEHOLDER_IMAGE = 'https://placehold.co/400x400/e0e0e0/666666?text=Product';

export const ProductModal = ({
    open,
    onClose,
    onAddToCart,
    product,
    children,
    discount = null
}) => {
    const theme = useTheme();
    const { addToCart, products: shopifyProducts } = useShopify();
    
    // Full screen on mobile (xs, sm), modal with overlay on md and up
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    const closeButtonRef = useRef(null);
    
    // Add to cart state
    const [addingToCart, setAddingToCart] = useState(false);
    
    // Selected variant state (for products with multiple variants)
    const [selectedVariantId, setSelectedVariantId] = useState(null);
    
    // Quantity state
    const [quantity, setQuantity] = useState(1);
    
    // Delivery estimate state
    const [deliveryEstimate, setDeliveryEstimate] = useState(null);
    const [loadingDelivery, setLoadingDelivery] = useState(false);
    
    // Shipping estimate state
    const [shippingEstimate, setShippingEstimate] = useState(null);
    const [loadingShipping, setLoadingShipping] = useState(false);
    
    // Nearest store for pickup
    const [nearestStore, setNearestStore] = useState(null);

    // Modifier selections state
    const [modifierSelections, setModifierSelections] = useState({});
    const [modifierCategories, setModifierCategories] = useState([]);
    const [modifierData, setModifierData] = useState(null); // Full API response with Square IDs
    const [modifierPrice, setModifierPrice] = useState(0);
    const [modifierValidation, setModifierValidation] = useState({ valid: true, errors: [] });
    const [hasModifiers, setHasModifiers] = useState(false);
    const [allModifierStepsComplete, setAllModifierStepsComplete] = useState(false);
    const [canContinueModifiers, setCanContinueModifiers] = useState(false);
    const [isLastModifierStep, setIsLastModifierStep] = useState(false);

    // Ref for ModifierSelector to call continueToNextStep
    const modifierSelectorRef = useRef(null);
    
    // Store locations for delivery estimate (you can pass these as props or get from context)
    const STORE_LOCATIONS = [
        { id: 'kips-bay', name: 'Kips Bay', latitude: 40.7450, longitude: -73.9781 },
        { id: 'new-brunswick', name: 'New Brunswick', latitude: 40.4862, longitude: -74.4518 },
        // Add your other locations here
    ];
    
    // Initialize selected variant when product changes
    useEffect(() => {
        if (!product) {
            setSelectedVariantId(null);
            setQuantity(1);
            setDeliveryEstimate(null);
            setShippingEstimate(null);
            setNearestStore(null);
            setModifierSelections({});
            setModifierCategories([]);
            setModifierData(null);
            setModifierPrice(0);
            setModifierValidation({ valid: true, errors: [] });
            setHasModifiers(false);
            setAllModifierStepsComplete(false);
            setCanContinueModifiers(false);
            setIsLastModifierStep(false);
            return;
        }
        
        if (product.availableVariants?.length > 0) {
            setSelectedVariantId(product.availableVariants[0].id);
        } else if (product.variants?.length > 0) {
            setSelectedVariantId(product.variants[0].id);
        } else if (product.variantId) {
            setSelectedVariantId(product.variantId);
        } else {
            setSelectedVariantId(null);
        }
        setQuantity(1);
    }, [product]);

    // Focus the close button when modal opens (ADA requirement)
    useEffect(() => {
        if (open && closeButtonRef.current) {
            // Small delay to ensure dialog is rendered
            setTimeout(() => {
                closeButtonRef.current?.focus();
            }, 100);
        }
    }, [open]);

    // Determine allowed fulfillment methods from product metafield
    // Metafield should be a list: ['pickup', 'delivery', 'shipping']
    // In Shopify: namespace "custom", key "fulfillment_methods", type "list.single_line_text_field"
    const getFulfillmentMethods = () => {
        // Check for metafield (array of strings)
        if (product.fulfillmentMethods && Array.isArray(product.fulfillmentMethods)) {
            return product.fulfillmentMethods;
        }
        
        // Check for metafield as comma-separated string (fallback)
        if (typeof product.fulfillmentMethods === 'string') {
            return product.fulfillmentMethods.split(',').map(m => m.trim().toLowerCase());
        }
        
        // Check tags for fulfillment restrictions (legacy support)
        const tags = product.tags || [];
        const methods = [];
        if (tags.includes('pickup')) methods.push('pickup');
        if (tags.includes('delivery') || tags.includes('local-delivery')) methods.push('delivery');
        if (tags.includes('shipping')) methods.push('shipping');
        if (methods.length > 0) return methods;
        
        // Default: all methods available
        return ['pickup', 'delivery', 'shipping'];
    };
    
    const fulfillmentMethods = getFulfillmentMethods();
    const allowsPickup = fulfillmentMethods.includes('pickup');
    const allowsDelivery = fulfillmentMethods.includes('delivery');
    const allowsShipping = fulfillmentMethods.includes('shipping');

    // Fetch nearest store for pickup when modal opens
    useEffect(() => {
        if (open && allowsPickup && !nearestStore) {
            // Use the delivery estimate to get nearest store info
            getBestDeliveryEstimate(STORE_LOCATIONS)
                .then(estimate => {
                    if (estimate.storeName) {
                        setNearestStore({
                            name: estimate.storeName,
                            distance: estimate.distance,
                            distanceText: estimate.distanceText,
                            userCity: estimate.userCity
                        });
                    } else if (estimate.nearestStore) {
                        setNearestStore({
                            name: estimate.nearestStore,
                            distance: estimate.distance,
                            distanceText: estimate.distanceText,
                            userCity: estimate.userCity
                        });
                    }
                })
                .catch(err => {
                    console.error('Error fetching nearest store:', err);
                });
        }
    }, [open, allowsPickup]);

    // Fetch delivery estimate when modal opens (only if delivery allowed)
    useEffect(() => {
        if (open && allowsDelivery && !deliveryEstimate && !loadingDelivery) {
            setLoadingDelivery(true);
            getBestDeliveryEstimate(STORE_LOCATIONS)
                .then(estimate => {
                    console.log('🚚 Delivery estimate:', estimate);
                    setDeliveryEstimate(estimate);
                })
                .catch(err => {
                    console.error('Error fetching delivery estimate:', err);
                })
                .finally(() => {
                    setLoadingDelivery(false);
                });
        }
    }, [open, allowsDelivery]);

    // Fetch shipping estimate when modal opens (only if shipping allowed)
    useEffect(() => {
        if (open && allowsShipping && !shippingEstimate && !loadingShipping) {
            setLoadingShipping(true);
            getShippingEstimate(STORE_LOCATIONS)
                .then(estimate => {
                    console.log('📦 Shipping estimate:', estimate);
                    // Add delivery dates
                    if (estimate.minDays && estimate.maxDays) {
                        const dates = getEstimatedDeliveryDates(estimate.minDays, estimate.maxDays);
                        setShippingEstimate({ ...estimate, ...dates });
                    } else {
                        setShippingEstimate(estimate);
                    }
                })
                .catch(err => {
                    console.error('Error fetching shipping estimate:', err);
                })
                .finally(() => {
                    setLoadingShipping(false);
                });
        }
    }, [open, allowsShipping]);

    const handleAddToCart = async () => {
        // Use selected variant or fall back to product's variant
        const variantIdToAdd = selectedVariantId || product?.variantId;

        console.log('🎯 ProductModal: Add to Cart clicked');
        console.log('🎯 Product:', product);
        console.log('🎯 Selected Variant ID:', variantIdToAdd);

        if (!variantIdToAdd) {
            console.error('❌ No variant ID available for product:', product);
            alert('Please select a size option.');
            return;
        }

        // Check modifier validation
        if (!modifierValidation.valid) {
            alert(modifierValidation.errors.join('\n'));
            return;
        }

        try {
            setAddingToCart(true);

            // Build product info for logging (not added to cart)
            const productInfo = {
                sku: productSku || null,
                shopifyProductId: product.id,
                shopifyVariantId: variantIdToAdd,
                productName: product.name || product.title,
            };

            // Build Square catalog info for logging (not added to cart)
            let squareCatalogInfo = null;
            if (modifierData && modifierCategories.length > 0) {
                const modifiers = [];
                modifierCategories.forEach((category) => {
                    const selectedIds = modifierSelections[category.id] || [];
                    selectedIds.forEach(modId => {
                        const modifier = category.modifiers.find(m => m.id === modId);
                        if (modifier) {
                            modifiers.push({
                                categoryId: category.id,
                                categoryName: category.name,
                                modifierId: modifier.id,
                                modifierName: modifier.name,
                                price: modifier.price || 0,
                            });
                        }
                    });
                });

                squareCatalogInfo = {
                    productId: modifierData.productId || null,
                    variationId: modifierData.variationId || null,
                    sku: modifierData.sku || null,
                    modifiers: modifiers,
                };
            }

            // Console log all the data (for webhook development)
            console.log('🎯 Adding to cart:', {
                productId: product.id,
                variantId: variantIdToAdd,
                quantity: quantity,
            });
            console.log('📦 Product Info:', productInfo);
            if (squareCatalogInfo) {
                console.log('🔷 Square Catalog:', squareCatalogInfo);
            }
            console.log('🚨 CHECKPOINT A - right after Square Catalog');

            // Debug: Log modifier state before building customAttributes
            console.log('🔍 DEBUG modifierCategories:', modifierCategories);
            console.log('🔍 DEBUG modifierSelections:', modifierSelections);

            // Only pass human-readable modifier attributes to cart (no IDs)
            let customAttributes = [];
            try {
                customAttributes = modifierCategories.length > 0
                    ? modifierCategories
                        .filter(category => (modifierSelections[category.id] || []).length > 0)
                        .map(category => ({
                            key: category.name,
                            value: (modifierSelections[category.id] || [])
                                .map(id => category.modifiers.find(m => m.id === id)?.name)
                                .filter(Boolean)
                                .join(', ')
                        }))
                    : [];
            } catch (attrError) {
                console.error('❌ Error building customAttributes:', attrError);
            }

            console.log('📋 Cart Attributes:', customAttributes);

            // Call parent's onAddToCart handler - it will handle cart, banner, and modal closing
            await onAddToCart(product.id, variantIdToAdd, quantity, customAttributes);
            console.log('🎯 ✅ onAddToCart callback completed');

        } catch (error) {
            console.error('❌ Error adding to cart:', error);
            alert('Failed to add item to cart. Please try again.');
        } finally {
            setAddingToCart(false);
        }
    };

    if (!product) return null;

    // Get the currently selected variant (for image display)
    // Check availableVariants first (grouped products), then variants (all products)
    const selectedVariant = product.availableVariants?.find(v => v.id === selectedVariantId) 
        || product.variants?.find(v => v.id === selectedVariantId);
    
    // Debug
    console.log('🖼️ Modal debug:', {
        productName: product.name,
        productType: product.type,
        category: product.category,
        availableVariants: product.availableVariants?.length,
        variants: product.variants?.length,
        selectedVariantId,
        selectedVariant: selectedVariant?.title,
        hasVariantImage: selectedVariant?.hasVariantImage,
        variantImageUrl: selectedVariant?.image?.url,
        fulfillmentMethods,
        allowsPickup,
        allowsDelivery,
        allowsShipping
    });

    // Get images based on product type
    const getProductImages = () => {
        // For desserts: show variant image if hasVariantImage is true, otherwise show product image
        const isDessert = product.type === 'dessert' || product.category === 'desserts';
        
        if (isDessert) {
            // First priority: variant image if hasVariantImage metafield is true
            if (selectedVariant?.hasVariantImage === true && selectedVariant?.image?.url) {
                return [{ url: selectedVariant.image.url, alt: selectedVariant.image.alt || product.name }];
            }
            // Second priority: product's main image
            if (product.imageUrl) {
                return [{ url: product.imageUrl, alt: product.imageAlt || product.name }];
            }
            // Third priority: product images array
            if (product.images?.length > 0) {
                return [{ url: product.images[0].url, alt: product.images[0].alt || product.name }];
            }
            // Fallback: placeholder
            return [{ url: PLACEHOLDER_IMAGE, alt: product.name }];
        }
        
        // For non-desserts (merchandise): collect all images
        const images = [];
        
        if (selectedVariant?.image?.url) {
            images.push({ url: selectedVariant.image.url, alt: selectedVariant.image.alt || product.name });
        }
        
        if (product.images?.length > 0) {
            product.images.forEach(img => {
                if (!images.some(i => i.url === img.url)) {
                    images.push(img);
                }
            });
        }
        
        if (images.length === 0 && product.imageUrl) {
            images.push({ url: product.imageUrl, alt: product.imageAlt || product.name });
        }
        
        if (images.length === 0) {
            images.push({ url: PLACEHOLDER_IMAGE, alt: product.name });
        }
        
        return images;
    };

    // Get price to display - use selected variant's price if available
    const displayPrice = selectedVariant 
        ? `$${parseFloat(selectedVariant.price).toFixed(2)}`
        : product.price;

    const productName = product.name || product.title || 'Product';

    // Get SKU for modifier lookup (check variant first, then product)
    const productSku = selectedVariant?.sku || product.sku || product.variants?.[0]?.sku || null;

    // Handlers for modifier selections
    const handleModifierSelectionsChange = (selections, categories, fullData) => {
        setModifierSelections(selections);
        setModifierCategories(categories);
        setModifierData(fullData);
        setHasModifiers(categories && categories.length > 0);
    };

    // Calculate total price including modifiers
    const basePrice = parseFloat(displayPrice.replace('$', '')) || 0;
    const totalUnitPrice = basePrice + modifierPrice;
    const totalPrice = totalUnitPrice * quantity;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen={isSmallScreen}
            maxWidth="md"
            fullWidth
            aria-labelledby="product-modal-title"
            aria-describedby="product-modal-description"
            PaperProps={{
                sx: {
                    borderRadius: isSmallScreen ? 0 : 2,
                    maxHeight: isSmallScreen ? '100%' : '90vh',
                    height: isSmallScreen ? '100%' : 'auto',
                    margin: isSmallScreen ? 0 : 'auto',
                    maxWidth: isSmallScreen ? '100%' : '600px',
                    overflow: 'hidden',
                },
                role: 'dialog',
                'aria-modal': 'true'
            }}
            sx={{
                '& .MuiBackdrop-root': {
                    backgroundColor: isSmallScreen ? 'transparent' : 'rgba(0, 0, 0, 0.5)',
                }
            }}
        >
            {/* Visually hidden title for screen readers */}
            <DialogTitle 
                id="product-modal-title" 
                sx={{ 
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    padding: 0,
                    margin: '-1px',
                    overflow: 'hidden',
                    clip: 'rect(0, 0, 0, 0)',
                    whiteSpace: 'nowrap',
                    border: 0
                }}
            >
                {productName} - Product Details
            </DialogTitle>

            <DialogContent 
                sx={{ 
                    p: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    WebkitOverflowScrolling: 'touch',
                    // Use dvh for reliable mobile viewport height
                    maxHeight: isSmallScreen ? 'calc(100dvh - 80px)' : 'none',
                    // Fallback for browsers without dvh support
                    '@supports not (max-height: 100dvh)': {
                        maxHeight: isSmallScreen ? 'calc(100vh - 80px)' : 'none',
                    },
                }} 
                id="product-modal-description"
            >
                {/* Product Image Carousel */}
                <ProductImageCarousel 
                    key={selectedVariantId || 'default'}
                    images={getProductImages()}
                    fallbackImage={PLACEHOLDER_IMAGE}
                    productName={productName}
                    primaryAlt={selectedVariant?.image?.alt || product.imageAlt}
                />

                {/* Product Details */}
                <Box sx={{
                    p: 3,
                    // Add bottom padding on mobile to account for fixed footer
                    pb: isSmallScreen ? '120px' : 3,
                }}>
                    {/* Product Name + Quantity Selector Row */}
                    {/* Product Name */}
                    <Typography
                        variant="h4"
                        component="h2"
                        sx={{ fontWeight: 'bold', mb: 1 }}
                    >
                        {productName}
                    </Typography>

                    {/* Price - only show if single variant or no variants */}
                    {(!product.availableVariants || product.availableVariants.length <= 1) && (
                        <Typography
                            variant="h6"
                            color="text.secondary"
                            sx={{ mb: 0 }}
                            aria-label={`Price: ${displayPrice || 'Price not available'}`}
                        >
                            {displayPrice || 'Price not available'}
                        </Typography>
                    )}

                    {/* Zone 1: Collection/subcategory discount */}
                    <DiscountZonePlaceholder
                        zone={1}
                        discount={discount}
                        subcategoryName="Blind Boxes"
                        products={shopifyProducts}
                    />

                    {/* Quantity Selector */}
                    <Box
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            border: '1px solid',
                            borderColor: 'grey.300',
                            borderRadius: 1,
                            my: 2
                        }}
                    >
                        <Button
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            disabled={quantity <= 1}
                            sx={{ minWidth: '40px' }}
                            aria-label="Decrease quantity"
                        >
                            -
                        </Button>
                        <Typography
                            sx={{
                                px: 2,
                                fontWeight: 'bold',
                                minWidth: '20px',
                                textAlign: 'center'
                            }}
                        >
                            {quantity}
                        </Typography>
                        <Button
                            onClick={() => setQuantity(q => q + 1)}
                            sx={{ minWidth: '40px' }}
                            aria-label="Increase quantity"
                        >
                            +
                        </Button>
                    </Box>

                    {/* Variant Selector (for grouped products with multiple variants) */}
                    {product.availableVariants && product.availableVariants.length > 1 && (
                        <Box sx={{ mb: 3 }} role="group" aria-labelledby="size-selector-heading">
                            <Typography
                                variant="body1"
                                sx={{ mb: 1 }}
                                id="size-selector-heading"
                            >
                                Select an option
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                                {product.availableVariants.map((variant) => {
                                    const isSelected = selectedVariantId === variant.id;
                                    // Use size title from metaobject, or fall back to parsing from title
                                    let displayTitle = variant.sizeData?.title
                                        || variant.size
                                        || variant.title
                                            .replace(/Ice Cream Cake /i, '')
                                            .replace(/ Ice Cream/i, '');

                                    return (
                                        <Button
                                            key={variant.id}
                                            variant={isSelected ? "contained" : "outlined"}
                                            onClick={() => setSelectedVariantId(variant.id)}
                                            sx={{
                                                minWidth: '100px',
                                                px: 2.5,
                                                py: 1.5,
                                                borderColor: isSelected ? 'black' : 'grey.400',
                                                backgroundColor: isSelected ? 'black' : 'transparent',
                                                color: isSelected ? 'white' : 'text.primary',
                                                '&:hover': {
                                                    borderColor: 'black',
                                                    backgroundColor: isSelected ? 'grey.800' : 'grey.100'
                                                }
                                            }}
                                        >
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                    {displayTitle}
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                    ${parseFloat(variant.price).toFixed(2)}
                                                </Typography>
                                            </Box>
                                        </Button>
                                    );
                                })}
                            </Box>
                        </Box>
                    )}

                    {/* Modifier Selector (for products with Square modifiers) */}
                    {productSku && (
                        <ModifierSelector
                            ref={modifierSelectorRef}
                            sku={productSku}
                            onSelectionsChange={handleModifierSelectionsChange}
                            onPriceChange={setModifierPrice}
                            onValidationChange={setModifierValidation}
                            onAllStepsComplete={setAllModifierStepsComplete}
                            onCanContinueChange={setCanContinueModifiers}
                            onIsLastStepChange={setIsLastModifierStep}
                        />
                    )}

                    {/* Fulfillment Options - Apple style */}
                    <Box sx={{ mb: 3 }}>
                        {/* Check inventory for tracked products */}
                        {(() => {
                            const isInventoryTracked = product.inventoryTracked;
                            const isOutOfStock = isInventoryTracked && product.totalInventory === 0;
                            
                            if (isOutOfStock) {
                                return (
                                    <Typography variant="body2" color="text.secondary">
                                        Out of stock
                                    </Typography>
                                );
                            }
                            
                            return (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {/* Pickup Option */}
                                    {allowsPickup && (
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                            <StorefrontIcon sx={{ color: 'text.secondary', fontSize: 20, mt: 0.25 }} aria-hidden="true" />
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                Pickup available{nearestStore ? ` from ${nearestStore.name}` : ''}
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Delivery Options */}
                                    {(allowsDelivery || allowsShipping) && (
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                            <LocalShippingIcon sx={{ color: 'text.secondary', fontSize: 20, mt: 0.25 }} aria-hidden="true" />
                                            <Box>
                                                {/* Local Delivery */}
                                                {allowsDelivery && (
                                                    <Typography variant="body2" sx={{ fontWeight: 500, mb: allowsShipping ? 1 : 0 }}>
                                                        Local Delivery
                                                        {deliveryEstimate?.available && deliveryEstimate?.feeText && (
                                                            <Typography component="span" color="text.secondary"> — {deliveryEstimate.feeText}</Typography>
                                                        )}
                                                    </Typography>
                                                )}
                                                {/* Shipping */}
                                                {allowsShipping && (
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                            Shipping
                                                            <Typography component="span" color="text.secondary"> — Calculated at checkout</Typography>
                                                        </Typography>
                                                        {shippingEstimate?.available && shippingEstimate?.rangeText && (
                                                            <Typography variant="body2" color="text.secondary">
                                                                Est. arrival: {shippingEstimate.rangeText}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            );
                        })()}
                    </Box>

                    {/* Description */}
                    <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.7 }}>
                        {product.description || 'No description available.'}
                    </Typography>

                    {/* Sizes (for merchandise) */}
                    {product.sizes && (
                        <Box sx={{ mb: 2 }} role="group" aria-labelledby="sizes-heading">
                            <Typography 
                                variant="subtitle2" 
                                sx={{ fontWeight: 'bold', mb: 0.5 }}
                                id="sizes-heading"
                            >
                                Sizes
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {product.sizes}
                            </Typography>
                        </Box>
                    )}

                    {/* Ingredients (for desserts) */}
                    {product.ingredients && (
                        <Box sx={{ mb: 2 }} role="group" aria-labelledby="ingredients-heading">
                            <Typography 
                                variant="subtitle2" 
                                sx={{ fontWeight: 'bold', mb: 0.5 }}
                                id="ingredients-heading"
                            >
                                Ingredients
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {product.ingredients}
                            </Typography>
                        </Box>
                    )}

                    {/* Allergens */}
                    {product.allergens && (
                        <Box 
                            sx={{ mb: 2 }} 
                            role="alert"
                            aria-labelledby="allergens-heading"
                        >
                            <Typography 
                                variant="subtitle2" 
                                sx={{ fontWeight: 'bold', mb: 0.5 }}
                                id="allergens-heading"
                            >
                                Allergen Information
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {product.allergens}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </DialogContent>
                
            {/* Footer - position: fixed on mobile, normal on desktop */}
            <DialogActions
                sx={{
                    // FIXED POSITION ON MOBILE
                    position: isSmallScreen ? 'fixed' : 'relative',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    px: 2,
                    py: 2,
                    gap: 1,
                    backgroundColor: 'white',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    justifyContent: 'flex-start',
                    zIndex: 1300,
                    // Safe area for mobile devices with notch/home indicator
                    paddingBottom: isSmallScreen
                        ? 'calc(16px + env(safe-area-inset-bottom, 0px))'
                        : '16px',
                }}
            >
                {/* Close Button */}
                <Button
                    ref={closeButtonRef}
                    aria-label={`Close ${productName} details`}
                    onClick={onClose}
                    variant="outlined"
                    sx={{
                        minWidth: 'auto',
                        px: 2,
                        py: 1.5,
                        backgroundColor: 'white',
                        color: 'grey.700',
                        borderColor: 'grey.300',
                        '&:hover': {
                            backgroundColor: 'grey.100',
                            borderColor: 'grey.400',
                        },
                        '&:focus': {
                            outline: '2px solid',
                            outlineColor: 'primary.main',
                            outlineOffset: 2
                        }
                    }}
                >
                    <CloseIcon />
                </Button>

                {/* Action Button - Continue or Add to Cart */}
                {(() => {
                    // Determine button state
                    const isOutOfStock = product.inventoryTracked && product.totalInventory === 0;
                    const showContinue = hasModifiers && !isLastModifierStep && !allModifierStepsComplete;
                    const continueDisabled = showContinue && !canContinueModifiers;
                    const addToCartDisabled = !showContinue && (
                        addingToCart ||
                        (!selectedVariantId && !product.variantId) ||
                        isOutOfStock ||
                        (hasModifiers && !allModifierStepsComplete)
                    );

                    const handleButtonClick = () => {
                        if (showContinue) {
                            modifierSelectorRef.current?.continueToNextStep();
                        } else {
                            handleAddToCart();
                        }
                    };

                    return (
                        <Button
                            variant="contained"
                            fullWidth
                            startIcon={
                                addingToCart ? <CircularProgress size={28} color="inherit" /> :
                                showContinue ? null :
                                <ShoppingCartIcon sx={{ fontSize: '1.6rem' }} />
                            }
                            onClick={handleButtonClick}
                            disabled={showContinue ? continueDisabled : addToCartDisabled}
                            sx={{
                                backgroundColor: '#000000',
                                color: '#ffffff',
                                py: 1.5,
                                '& .MuiButton-startIcon': {
                                    marginRight: 1,
                                },
                                '&:hover': {
                                    backgroundColor: '#333333'
                                },
                                '&:disabled': {
                                    backgroundColor: 'grey.300',
                                    color: 'grey.500'
                                }
                            }}
                        >
                            {addingToCart ? (
                                <Typography sx={{ fontSize: '1.6rem', fontWeight: 600 }}>Adding...</Typography>
                            ) : isOutOfStock ? (
                                <Typography sx={{ fontSize: '1.6rem', fontWeight: 600 }}>Out of Stock</Typography>
                            ) : showContinue ? (
                                <Typography sx={{ fontSize: '1.6rem', fontWeight: 600 }}>Continue</Typography>
                            ) : (
                                <Typography component="span" sx={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '1.6rem', fontWeight: 600 }}>
                                    <span>Add{quantity > 1 ? ` (${quantity})` : ''} to Cart</span>
                                    <span>${totalPrice.toFixed(2)}</span>
                                </Typography>
                            )}
                        </Button>
                    );
                })()}
            </DialogActions>
        </Dialog>
    );
};
