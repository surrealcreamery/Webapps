import React, { useContext, useEffect, useRef, useLayoutEffect, useState, useMemo, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, Divider, Container, Grid, Card, CardMedia, CardContent, Modal, IconButton, Chip, ToggleButtonGroup, ToggleButton, useMediaQuery, useTheme, TextField, Stack } from '@mui/material';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { useShopify } from '@/contexts/commerce/ShopifyContext_GraphQL';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { motion, AnimatePresence } from 'framer-motion';

// Import components
import { Section } from '@/components/commerce/Section';
import { CartDrawer } from '@/components/commerce/CartDrawer';
import { useDiscounts } from '@/components/commerce/useDiscounts';
import { BlindBoxProgressIndicator } from '@/components/commerce/BlindBoxProgressIndicator';
import { DiscountZonePlaceholder } from '@/components/commerce/DiscountZonePlaceholder';
import { ModifierSelector } from '@/components/commerce/ModifierSelector';
import { sortProductsByOrder } from '@/services/catalogService';
import { getAccessibleTextColorForGradient, checkGradientContrast } from '@/utils/colorContrast';
import { getPageConfig } from '@/services/pageConfigService';
import { useCart } from '@/hooks/useCart';
import Footer from '@/components/footer/commerce/commerceFooter';
import { fetchInitialData as fetchEventsData } from '@/state/events/eventService';
import { useCatalog } from '@/contexts/commerce/CatalogContext';
import { getTextColorForBackground, getItemBackground, resolveDisplayModifiers } from '@/state/catalog/catalogUtils';
import { useLocationAvailability } from '@/hooks/useLocationAvailability';

// Placeholder image for variants without images
const PLACEHOLDER_IMAGE = 'https://placehold.co/400x400/e0e0e0/666666?text=No+Image';

const CATALOG_API_URL = 'https://ou6oqgnnqjo542342x64srup4q0ofoua.lambda-url.us-east-1.on.aws';

// Module-level variable to persist scroll position across navigations
let pendingScrollRestore = null;




// Mobile product card grid - category index view
const ProductCardGrid = ({ items = [], feedItems = [], onProductTap, onMYOOptionTap, collapsingFeedIndex }) => {

    const renderCard = (item, isFullWidth) => {
        const itemFeedIndex = feedItems.findIndex(f => f.id === item.id);
        const product = item.product || item;
        const variants = product.variants?.filter(v => v.price) || [];
        let price = '';
        if (variants.length > 1) {
            const prices = variants.map(v => parseFloat(v.price)).sort((a, b) => a - b);
            price = prices[0] === prices[prices.length - 1]
                ? `$${prices[0].toFixed(2)}`
                : `$${prices[0].toFixed(2)} - $${prices[prices.length - 1].toFixed(2)}`;
        } else if (variants.length === 1) {
            price = `$${parseFloat(variants[0].price).toFixed(2)}`;
        } else if (product.price) {
            price = `$${parseFloat(product.price).toFixed(2)}`;
        }
        const bgColor = item.backgroundColor || '#1a1a2e';
        const bgGradient = getItemBackground(item);
        const textColor = item.textColor || getTextColorForBackground(item.backgroundColor);

        return (
            <Box
                key={item.id}
                data-feed-index={itemFeedIndex}
                onClick={(e) => {
                    const cardEl = e.currentTarget.querySelector('[data-card]');
                    const rect = cardEl ? cardEl.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
                    const imgEl = e.currentTarget.querySelector('[data-product-img]');
                    const imgRect = imgEl ? imgEl.getBoundingClientRect() : null;
                    const imgAR = imgEl ? imgEl.naturalWidth / imgEl.naturalHeight : 1;
                    onProductTap?.(itemFeedIndex, { rect, bgColor, bgGradient, imgRect, imgSrc: item.image, imgAR });
                }}
                sx={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    '&:active': { transform: 'scale(0.96)' },
                }}
            >
                {/* Card: white top, solid background color behind image, text below image */}
                <Box
                    data-card
                    sx={{
                        position: 'relative',
                        borderRadius: 3,
                        overflow: 'hidden',
                        bgcolor: 'white',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Image area - aspect ratio placeholder */}
                    <Box sx={{ position: 'relative', paddingTop: isFullWidth ? '50%' : '100%' }}>
                        {/* Solid background color - behind lower portion of image */}
                        <Box
                            sx={{
                                position: 'absolute',
                                left: 0, right: 0, bottom: 0,
                                height: '50%',
                                bgcolor: item.backgroundColor || '#1a1a2e',
                                borderRadius: '16px 16px 0 0',
                            }}
                        />
                        {/* Product image - floating across the split */}
                        {item.image && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: '3%',
                                    left: '2%',
                                    right: '2%',
                                    bottom: '3%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: collapsingFeedIndex === itemFeedIndex ? 0 : 1,
                                }}
                            >
                                <img
                                    data-product-img
                                    src={item.image}
                                    srcSet={item.pwa ? `${item.pwa.sm} 480w, ${item.pwa.md} 960w, ${item.pwa.lg} 1440w` : undefined}
                                    sizes={item.pwa ? "50vw" : undefined}
                                    alt={item.title || ''}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                />
                            </Box>
                        )}
                    </Box>

                    {/* Product name + price - in flow below image, never overlaps */}
                    <Box
                        sx={{
                            bgcolor: item.backgroundColor || '#1a1a2e',
                            p: 1.5,
                            pt: 0.5,
                            flex: 1,
                        }}
                    >
                        <Typography
                            sx={{
                                fontWeight: 700,
                                fontSize: '1.6rem',
                                lineHeight: 1.2,
                                color: textColor,

                                mb: 0.5,
                            }}
                        >
                            {item.title}
                        </Typography>
                        {price && (
                            <Typography
                                sx={{
                                    fontSize: '1.6rem',
                                    fontWeight: 600,
                                    color: textColor,
                                    opacity: 0.8,
                                }}
                            >
                                {price}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
        );
    };

    const renderMYOCard = (item) => {
        const itemFeedIndex = feedItems.findIndex(f => f.id === item.id);
        const product = item.product || item;
        const myoVariants = product.variants?.filter(v => v.price) || [];
        let price = '';
        if (myoVariants.length > 1) {
            const prices = myoVariants.map(v => parseFloat(v.price)).sort((a, b) => a - b);
            price = prices[0] === prices[prices.length - 1]
                ? `$${prices[0].toFixed(2)}`
                : `$${prices[0].toFixed(2)} - $${prices[prices.length - 1].toFixed(2)}`;
        } else if (myoVariants.length === 1) {
            price = `$${parseFloat(myoVariants[0].price).toFixed(2)}`;
        } else if (product.price) {
            price = `$${parseFloat(product.price).toFixed(2)}`;
        }
        const bgColor = item.backgroundColor || '#1a1a2e';
        const bgGradient = getItemBackground(item);
        const txtColor = item.textColor || getTextColorForBackground(item.backgroundColor);
        return (
            <Box
                key={item.id}
                data-feed-index={itemFeedIndex}
                onClick={(e) => {
                    const cardEl = e.currentTarget.querySelector('[data-card]');
                    const rect = cardEl ? cardEl.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
                    const imgEl = e.currentTarget.querySelector('[data-product-img]');
                    const imgRect = imgEl ? imgEl.getBoundingClientRect() : null;
                    const imgAR = imgEl ? imgEl.naturalWidth / imgEl.naturalHeight : 1;
                    onProductTap?.(itemFeedIndex, { rect, bgColor, bgGradient, imgRect, imgSrc: item.image, imgAR });
                }}
                sx={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    '&:active': { transform: 'scale(0.96)' },
                }}
            >
                <Box
                    data-card
                    sx={{
                        position: 'relative',
                        borderRadius: 3,
                        overflow: 'hidden',
                        bgcolor: 'white',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <Box sx={{ position: 'relative', paddingTop: '100%' }}>
                        <Box
                            sx={{
                                position: 'absolute',
                                left: 0, right: 0, bottom: 0,
                                height: '50%',
                                bgcolor: bgColor,
                                borderRadius: '16px 16px 0 0',
                            }}
                        />
                        {(item.image || product.imageUrl) && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: '3%', left: '2%', right: '2%', bottom: '3%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: collapsingFeedIndex === itemFeedIndex ? 0 : 1,
                                }}
                            >
                                <img
                                    data-product-img
                                    src={item.image || product.imageUrl}
                                    srcSet={item.pwa ? `${item.pwa.sm} 480w, ${item.pwa.md} 960w, ${item.pwa.lg} 1440w` : undefined}
                                    sizes={item.pwa ? "50vw" : undefined}
                                    alt={item.title || product.name}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                />
                            </Box>
                        )}
                    </Box>
                    <Box
                        sx={{
                            bgcolor: bgColor,
                            p: 1.5,
                            pt: 0.5,
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Typography sx={{
                            color: txtColor,
                            fontWeight: 700,
                            fontSize: '1.6rem',
                            textAlign: 'center',
                            lineHeight: 1.2,
                            mb: 0.5,
                        }}>
                            {item.title || product.name}
                        </Typography>
                        {price && (
                            <Typography sx={{
                                color: txtColor,
                                opacity: 0.8,
                                fontSize: '1.6rem',
                                mb: 1,
                            }}>
                                Starting from {price}
                            </Typography>
                        )}
                        <Box sx={{
                            border: `2px solid ${txtColor}`,
                            color: txtColor,
                            fontWeight: 700,
                            fontSize: '1.3rem',
                            px: 2,
                            py: 0.5,
                            borderRadius: 2,
                        }}>
                            Make Your Own
                        </Box>
                    </Box>
                </Box>
            </Box>
        );
    };

    // Group items by sub-subcategory (Level 3) for sectioned display
    const hasSubSubcategories = items.some(item => item.subSubcategoryId);

    // Build ordered groups: preserve feed order, group by sub-subcategory
    const groups = useMemo(() => {
        if (!hasSubSubcategories) return null;
        const ordered = [];
        const seen = new Set();
        for (const item of items) {
            const key = item.subSubcategoryId || '_ungrouped';
            if (!seen.has(key)) {
                seen.add(key);
                ordered.push({
                    id: key,
                    name: item.subSubcategoryName || null,
                    items: [],
                });
            }
            ordered.find(g => g.id === key).items.push(item);
        }
        return ordered;
    }, [items, hasSubSubcategories]);

    return (
        <Box sx={{ px: 2, pb: 6 }}>
            {groups ? (
                // Render products grouped by sub-subcategory with text headers
                groups.map((group, groupIdx) => {
                    const myoItems = group.items.filter(item => item.isMYO);
                    const regularItems = group.items.filter(item => !item.isMYO);
                    return (
                        <Box key={group.id} sx={{ mb: 3 }}>
                            {group.name && (
                                <Typography
                                    sx={{
                                        fontSize: '1.8rem',
                                        fontWeight: 700,
                                        color: 'text.primary',
                                        mb: 1.5,
                                        mt: groupIdx > 0 ? 2 : 0,
                                    }}
                                >
                                    {group.name}
                                </Typography>
                            )}
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2 }}>
                                {myoItems.map(item => renderMYOCard(item))}
                                {regularItems.map(item => renderCard(item, false))}
                            </Box>
                        </Box>
                    );
                })
            ) : (
                // No sub-subcategories - flat grid
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2 }}>
                    {items.filter(item => item.isMYO).map(item => renderMYOCard(item))}
                    {items.filter(item => !item.isMYO).map(item => renderCard(item, false))}
                </Box>
            )}
        </Box>
    );
};


// Product detail page - image hero (top 1/3) + scrollable info card (bottom 2/3)
const ProductDetailPage = ({ item, onAddToCart, onClose, onOpenCart, closing, storeLocations = [] }) => {
    const product = item?.product || item;
    // Variants are already catalog-first (catalog order, names, prices, Shopify GIDs attached)
    const variants = product?.variants || [];
    const isMYOProduct = item?.isMYO || false;
    const hasMultipleVariants = variants.length > 1;
    const defaultVariantId = (isMYOProduct && hasMultipleVariants)
        ? null  // MYO with multiple variants: don't auto-select, user picks first
        : (variants.find(v => v.availableForSale !== false)?.id || variants[0]?.id || product?.variantId);
    const [selectedVariantId, setSelectedVariantId] = useState(defaultVariantId);
    // Reset selection when product changes
    useEffect(() => {
        setSelectedVariantId(defaultVariantId);
    }, [defaultVariantId]);
    const [quantity, setQuantity] = useState(1);
    const [addingToCart, setAddingToCart] = useState(false);
    const [contentVisible, setContentVisible] = useState(false);

    // Collectibles: thumbnail gallery state
    const isCollectible = item?.isCollectible || product?.category?.toLowerCase() === 'merchandise' || product?.productType?.toLowerCase() === 'merchandise';
    const allProductImages = product?.images?.length ? product.images : (item?.catalogImages || []);
    const catalogImageStyles = item?.catalogImageStyles || [];
    const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState(null);
    const [imageExpanded, setImageExpanded] = useState(false);

    // Collectibles: scroll-driven card expansion (card expands upward as user scrolls)
    const [cardExpansion, setCardExpansion] = useState(0);
    const cardExpansionRef = useRef(0);
    const contentScrollRef = useRef(null);
    const touchYRef = useRef(null);
    const rafRef = useRef(null);
    const normalHeroVh = isCollectible ? 30 : 38;
    const minHeroVh = 15;
    const maxCardExpansion = (isCollectible && !isMYOProduct) ? window.innerHeight * (normalHeroVh - minHeroVh) / 100 : 0;

    // Batched expansion update (1 setState per animation frame)
    const updateExpansion = useCallback((value) => {
        cardExpansionRef.current = value;
        if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                setCardExpansion(cardExpansionRef.current);
            });
        }
    }, []);

    // Touch/wheel listeners for scroll-driven card expansion
    useEffect(() => {
        if (!maxCardExpansion || imageExpanded) return;
        const el = contentScrollRef.current;
        if (!el) return;

        const onTouchStart = (e) => {
            touchYRef.current = e.touches[0].clientY;
        };

        const onTouchMove = (e) => {
            if (touchYRef.current == null) return;
            const touchY = e.touches[0].clientY;
            const deltaY = touchYRef.current - touchY; // positive = finger up = scroll down
            touchYRef.current = touchY;
            const scrollTop = el.scrollTop;
            const expansion = cardExpansionRef.current;

            if (deltaY > 0 && expansion < maxCardExpansion) {
                // Scrolling down, card not fully expanded: expand card instead
                e.preventDefault();
                updateExpansion(Math.min(expansion + deltaY, maxCardExpansion));
            } else if (deltaY < 0 && scrollTop <= 0 && expansion > 0) {
                // Scrolling up, at top, card expanded: collapse card
                e.preventDefault();
                updateExpansion(Math.max(expansion + deltaY, 0));
            }
        };

        const onTouchEnd = () => {
            touchYRef.current = null;
        };

        const onWheel = (e) => {
            const scrollTop = el.scrollTop;
            const expansion = cardExpansionRef.current;

            if (e.deltaY > 0 && expansion < maxCardExpansion) {
                e.preventDefault();
                updateExpansion(Math.min(expansion + e.deltaY, maxCardExpansion));
            } else if (e.deltaY < 0 && scrollTop <= 0 && expansion > 0) {
                e.preventDefault();
                updateExpansion(Math.max(expansion + e.deltaY, 0));
            }
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        el.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('wheel', onWheel);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [maxCardExpansion, imageExpanded, updateExpansion]);

    // Reset scroll expansion when image tap-expand toggles
    useEffect(() => {
        if (imageExpanded) {
            cardExpansionRef.current = 0;
            setCardExpansion(0);
        }
    }, [imageExpanded]);

    // Wide/landscape layout: side-by-side image + info card
    const theme = useTheme();
    const isWide = useMediaQuery('@media (min-aspect-ratio: 4/3) and (min-width: 768px)');

    // MYO: track selected modifier options for hero image
    const isMYO = item?.isMYO || false;
    const productSku = isMYO ? (product?.variants?.[0]?.sku || product?.sku || null) : null;
    const [myoSelectedImages, setMyoSelectedImages] = useState([]);
    const modifierSelectorRef = useRef(null);
    const [canContinueModifiers, setCanContinueModifiers] = useState(false);
    const [isLastModifierStep, setIsLastModifierStep] = useState(false);

    // MYO: auto-detect compact bottom bar when too narrow for price+qty+button
    const bottomBarRef = useRef(null);
    const [compactBar, setCompactBar] = useState(window.innerWidth < 440);
    useEffect(() => {
        const check = () => {
            const el = bottomBarRef.current;
            if (el) {
                setCompactBar(el.contentRect ? el.contentRect.width < 380 : el.offsetWidth < 380);
            }
        };
        // Re-check once content is visible (motion.div animation delay)
        const timer = setTimeout(check, 400);
        const observer = new ResizeObserver((entries) => {
            setCompactBar(entries[0].contentRect.width < 380);
        });
        const el = bottomBarRef.current;
        if (el) observer.observe(el);
        return () => { clearTimeout(timer); observer.disconnect(); };
    }, [contentVisible]);

    // Fulfillment state (used by MYO ad lib and collectibles fulfillment selector)
    const [bottomMode, setBottomMode] = useState('modifiers'); // 'modifiers' | 'fulfillment' | 'location'
    const productFulfillmentMethods = product?.fulfillmentMethods || [];
    const hasFulfillmentMethods = productFulfillmentMethods.length > 0;
    const selectedLocationId = localStorage.getItem('selectedLocation');
    const selectedLocationObj = storeLocations.find(loc => loc.id === selectedLocationId) || storeLocations[0];

    // Warehouse locations for inventory display
    const warehouseLocations = storeLocations.filter(l => l.type === 'Warehouse');

    // Default fulfillment method: pick first method that has inventory
    const defaultFulfillmentMethod = useMemo(() => {
        if (!hasFulfillmentMethods) return 'pickup';
        const inv = item?.inventory;
        const localQty = inv?.trackInventory
            ? (inv.byLocation || []).find(l => l.locationId === selectedLocationObj?.id)?.quantity || 0
            : null;
        const totalQty = inv?.trackInventory ? inv.totalQuantity || 0 : null;
        // Prefer pickup for desserts, shipping for collectibles
        if (productFulfillmentMethods.includes('pickup') && selectedLocationObj && (localQty === null || localQty > 0)) return 'pickup';
        if (productFulfillmentMethods.includes('shipping') && (totalQty === null || totalQty > 0)) return 'shipping';
        if (productFulfillmentMethods.includes('delivery') && selectedLocationObj && (localQty === null || localQty > 0)) return 'delivery';
        return productFulfillmentMethods[0] || 'pickup';
    }, [hasFulfillmentMethods, item?.inventory, productFulfillmentMethods, selectedLocationObj]);
    const [fulfillmentMethod, setFulfillmentMethod] = useState(defaultFulfillmentMethod);

    // Track selected modifier images for MYO hero
    const [myoModifierData, setMyoModifierData] = useState(null);
    const [myoAllValid, setMyoAllValid] = useState(false);
    const myoSelectionsRef = useRef({ selections: {}, categories: [] });
    const [myoNextStep, setMyoNextStep] = useState(null);
    const handleMyoSelectionsChange = useCallback((selections, categories, modifierData) => {
        if (!categories) return;
        if (modifierData) setMyoModifierData(modifierData);
        myoSelectionsRef.current = { selections, categories };
        const images = [];
        categories.forEach(cat => {
            const selectedIds = selections[cat.id] || [];
            selectedIds.forEach(modId => {
                const mod = cat.modifiers.find(m => m.id === modId);
                if (mod) {
                    images.push({ id: mod.id, categoryId: cat.id, name: mod.name, image: mod.image || mod.imageUrl });
                }
            });
        });
        setMyoSelectedImages(images);
        // Compute next step message
        const nextEmpty = categories.find(cat => (selections[cat.id] || []).length === 0);
        if (!nextEmpty) {
            setMyoNextStep(null);
        } else {
            const linkedIds = modifierData?.totalModifierCategoryIds || [];
            const totalLimit = modifierData?.totalModifierSelections;
            if (linkedIds.includes(nextEmpty.id) && totalLimit) {
                const linkedNames = categories
                    .filter(cat => linkedIds.includes(cat.id))
                    .map(cat => cat.name);
                const nameList = linkedNames.length > 1
                    ? `${linkedNames.slice(0, -1).join(', ')}, or ${linkedNames[linkedNames.length - 1]}`
                    : linkedNames[0];
                const linkedCount = linkedIds.reduce((sum, id) => sum + (selections[id] || []).length, 0);
                const remaining = totalLimit - linkedCount;
                if (remaining <= 0) {
                    setMyoNextStep(<>Add to Cart to Continue</>);
                } else if (linkedCount > 0) {
                    setMyoNextStep(<>Select up to <strong>{remaining}</strong> more from {nameList}</>);
                } else {
                    setMyoNextStep(<>Select up to <strong>{totalLimit}</strong> from {nameList}</>);
                }
            } else {
                setMyoNextStep(`Select ${nextEmpty.name}`);
            }
        }
    }, []);

    // Show "Select your size" when variant not yet picked (first step for multi-variant MYO)
    useEffect(() => {
        if (hasMultipleVariants && !selectedVariantId) {
            setMyoNextStep('Select your size');
        }
    }, [hasMultipleVariants, selectedVariantId]);

    // Fade in content after card has started sliding up
    useEffect(() => {
        const timer = setTimeout(() => setContentVisible(true), 250);
        return () => clearTimeout(timer);
    }, []);

    const selectedVariant = variants.find(v => v.id === selectedVariantId) || variants[0];
    const displayPrice = selectedVariant?.price
        ? `$${parseFloat(selectedVariant.price).toFixed(2)}`
        : product?.price
            ? `$${parseFloat(product.price).toFixed(2)}`
            : '';
    // Use master inventory if available, fall back to Shopify's availableForSale
    const { available: availableAtLocation, locationName } = useLocationAvailability(selectedVariant, product, storeLocations);
    // For products with shipping fulfillment: available if any location has stock (not just selected store)
    const isAvailable = hasFulfillmentMethods
        ? (fulfillmentMethod === 'shipping'
            ? (item?.inventory?.trackInventory ? item.inventory.totalQuantity > 0 : true)
            : availableAtLocation && (item?.inventory?.trackInventory ? item.inventory.inStock : selectedVariant?.availableForSale !== false))
        : (item?.inventory?.trackInventory
            ? item.inventory.inStock
            : selectedVariant?.availableForSale !== false) && availableAtLocation;

    const handleAddToCart = async () => {
        if (!selectedVariantId || addingToCart) return;

        // Check for unmet required modifier selections
        if (isMYO && !myoAllValid) {
            modifierSelectorRef.current?.highlightRequired();
            return;
        }

        setAddingToCart(true);
        try {
            // Build customAttributes from MYO modifier selections
            const customAttributes = [];
            if (isMYO) {
                const { selections, categories } = myoSelectionsRef.current;
                categories.forEach(cat => {
                    const selectedIds = selections[cat.id] || [];
                    const names = selectedIds.map(id => {
                        const mod = cat.modifiers.find(m => m.id === id);
                        return mod?.name || id;
                    });
                    if (names.length > 0) {
                        customAttributes.push({ key: cat.name, value: names.join(', ') });
                    }
                });
            }
            // Pass fulfillment method (used by checkout Lambda to configure draft order)
            if (hasFulfillmentMethods && fulfillmentMethod) {
                customAttributes.push({ key: '_fulfillment', value: fulfillmentMethod });
            }
            const result = await onAddToCart?.(product, selectedVariant, quantity, customAttributes);
            if (result?.skipCartOpen) return; // delivery flow handles its own UI
            onClose?.();
            setTimeout(() => onOpenCart?.(), 400);
        } catch (error) {
            console.error('Error adding to cart:', error);
        } finally {
            setAddingToCart(false);
        }
    };

    // Collectibles: resolve per-image styles from catalog when a thumbnail is selected
    // Each catalog image can have its own backgroundColor, textColor, gradient
    const selectedCatalogImage = selectedThumbnailIndex != null
        ? catalogImageStyles[selectedThumbnailIndex] || null
        : null;

    // Build effective item with per-image overrides
    // Collectibles default: white background, black text, no gradient
    // When a thumbnail is selected, use ONLY that image's values (don't inherit from first image)
    const activeImageStyles = selectedCatalogImage || (selectedThumbnailIndex == null ? item : null);
    const collectibleItem = isCollectible
        ? {
            ...item,
            backgroundColor: activeImageStyles?.backgroundColor || '#ffffff',
            textColor: activeImageStyles?.textColor || '#000000',
            gradientDirection: activeImageStyles?.gradientDirection || null,
            gradientStartColor: activeImageStyles?.gradientStartColor || null,
            gradientEndColor: activeImageStyles?.gradientEndColor || null,
        }
        : {
            ...item,
            backgroundColor: item?.backgroundColor || '#ffffff',
            textColor: item?.textColor || '#000000',
        };
    const backgroundStyle = getItemBackground(collectibleItem);

    // Match variant image: prefer catalog variant image, then hash-match from Shopify CDN
    const catalogImages = item?.catalogImages || [];
    let heroImage = item?.image;
    // Catalog-first: use variant's catalogImage directly
    if (selectedVariant?.catalogImage?.url) {
        heroImage = selectedVariant.catalogImage.url;
    } else {
        const variantImgUrl = selectedVariant?.image?.url;
        if (variantImgUrl && catalogImages.length > 1) {
            const shopifyFilename = variantImgUrl.split('/').pop()?.split('?')[0] || '';
            const hashMatch = shopifyFilename.match(/([a-f0-9]{8})/);
            if (hashMatch) {
                const hash = hashMatch[1];
                const matched = catalogImages.find(ci => ci.url?.includes(hash));
                if (matched) heroImage = matched.url;
            }
        }
    }
    // Collectibles: override hero with selected thumbnail image
    if (selectedThumbnailIndex != null && allProductImages[selectedThumbnailIndex]) {
        const img = allProductImages[selectedThumbnailIndex];
        heroImage = typeof img === 'string' ? img : img.url;
    }
    const showThumbnails = isCollectible && allProductImages.length > 1 && !isWide;
    const showWideThumbnails = isCollectible && allProductImages.length > 1 && isWide;
    const reserveThumbnailSpace = showThumbnails; // Only reserve space when thumbnails will actually show
    const heroHeightNormal = reserveThumbnailSpace ? '30dvh' : '38dvh';
    const heroHeightExpanded = reserveThumbnailSpace ? 'calc(100dvh - 200px - 8dvh)' : 'calc(100dvh - 200px)';
    const heroHeight = (imageExpanded && isCollectible && !isWide)
        ? heroHeightExpanded
        : cardExpansion > 0
            ? `calc(${heroHeightNormal} - ${cardExpansion}px)`
            : heroHeightNormal;
    const thumbnailStripHeight = '8dvh';

    const heroTextColor = collectibleItem?.textColor || getTextColorForBackground(collectibleItem?.backgroundColor);

    return (
        <>
            {/* Full-screen backdrop + gradient + image hidden when closing so only the
                collapse transition overlay is visible with the card grid behind it */}
            {!closing && (
                <>
                    {/* Full-screen backdrop - gradient on top, white on bottom */}
                    <Box
                        sx={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            zIndex: 101,
                            background: isWide
                                ? `linear-gradient(to right, transparent 50%, ${collectibleItem?.gradientEndColor || collectibleItem?.backgroundColor || '#1a1a2e'} 50%)`
                                : (collectibleItem?.gradientEndColor || collectibleItem?.backgroundColor || '#1a1a2e'),
                            overscrollBehavior: 'none',
                            touchAction: 'none',
                        }}
                    />
                    {/* Wide: gradient layer on left half only */}
                    {isWide && (
                        <Box
                            sx={{
                                position: 'fixed',
                                top: 0, left: 0, width: '50%', bottom: 0,
                                zIndex: 102,
                                background: backgroundStyle,
                                overscrollBehavior: 'none',
                                touchAction: 'none',
                            }}
                        />
                    )}

                    {/* MYO: Left panel with selections list (wide/desktop only) */}
                    {isWide && isMYO && (
                        <Box
                            sx={{
                                position: 'fixed',
                                top: 0, left: 0, width: '50%', bottom: 0,
                                zIndex: 104,
                                display: 'flex',
                                flexDirection: 'column',
                                px: 4,
                                pt: 10,
                                pb: 4,
                                overscrollBehavior: 'none',
                            }}
                        >
                            {/* Fulfillment ad lib */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                                <Typography
                                    onClick={() => setBottomMode(bottomMode === 'fulfillment' ? 'modifiers' : 'fulfillment')}
                                    sx={{
                                        fontSize: '1.6rem',
                                        fontWeight: 600,
                                        color: heroTextColor,
                                        textDecoration: 'underline',
                                        textDecorationStyle: 'dotted',
                                        textUnderlineOffset: '3px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {fulfillmentMethod === 'pickup' ? 'Pickup' : 'Delivery'}
                                </Typography>
                                <Typography sx={{ fontSize: '1.6rem', color: heroTextColor, opacity: 0.7 }}>
                                    from
                                </Typography>
                                <Typography
                                    onClick={() => setBottomMode(bottomMode === 'location' ? 'modifiers' : 'location')}
                                    sx={{
                                        fontSize: '1.6rem',
                                        fontWeight: 600,
                                        color: heroTextColor,
                                        textDecoration: 'underline',
                                        textDecorationStyle: 'dotted',
                                        textUnderlineOffset: '3px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {selectedLocationObj?.name || 'Select Location'}
                                </Typography>
                            </Box>

                            {/* Product title */}
                            <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: heroTextColor, mb: 0.5 }}>
                                {item?.title || product?.name}
                            </Typography>

                            {/* Selected variant label for MYO multi-variant */}
                            {isMYO && hasMultipleVariants && selectedVariantId && (
                                <Typography sx={{ fontSize: '1.4rem', color: heroTextColor, opacity: 0.7, mb: 0.5 }}>
                                    {variants.find(v => v.id === selectedVariantId)?.name || variants.find(v => v.id === selectedVariantId)?.catalogName || ''} · {displayPrice}
                                </Typography>
                            )}
                            {/* Variant toggle (hide for MYO multi-variant — shown in content area) */}
                            {variants.length > 1 && !(isMYO && hasMultipleVariants) && (
                                <Box sx={{ display: 'flex', mb: 1 }}>
                                    <ToggleButtonGroup
                                        value={selectedVariantId}
                                        exclusive
                                        onChange={(_, val) => { if (val) setSelectedVariantId(val); }}
                                        sx={{
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                            border: '1.5px solid',
                                            borderColor: `${heroTextColor}60`,
                                            '& .MuiToggleButtonGroup-grouped': {
                                                border: 'none',
                                                borderRight: '1px solid',
                                                borderColor: `${heroTextColor}30`,
                                                '&:last-of-type': { borderRight: 'none' },
                                            },
                                        }}
                                    >
                                        {variants.map((variant) => (
                                            <ToggleButton
                                                key={variant.id}
                                                value={variant.id}
                                                sx={{
                                                    textTransform: 'none',
                                                    minHeight: 0,
                                                    lineHeight: 1.2,
                                                    px: 1.5,
                                                    py: '4px',
                                                    fontSize: '1.4rem',
                                                    whiteSpace: 'nowrap',
                                                    color: heroTextColor,
                                                    '&.Mui-selected': {
                                                        bgcolor: heroTextColor,
                                                        color: getTextColorForBackground(heroTextColor),
                                                        '&:hover': { bgcolor: heroTextColor },
                                                    },
                                                    '&:hover': { bgcolor: `${heroTextColor}20` },
                                                }}
                                            >
                                                {variant.name || variant.catalogName || variant.title || `Option ${variants.indexOf(variant) + 1}`}
                                            </ToggleButton>
                                        ))}
                                    </ToggleButtonGroup>
                                </Box>
                            )}

                            {myoNextStep && (
                                <Typography sx={{ fontSize: '1.4rem', color: heroTextColor, opacity: 0.7, mb: 1 }}>
                                    {myoNextStep}
                                </Typography>
                            )}
                            <Divider sx={{ borderColor: `${heroTextColor}30`, mb: 2 }} />
                            <Box sx={{ flex: 1, overflowY: 'auto' }}>
                                {myoSelectedImages.length > 0 ? (
                                    myoSelectedImages.map((sel) => {
                                        const cat = myoSelectionsRef.current.categories?.find(c => c.id === sel.categoryId);
                                        return (
                                            <Box
                                                key={sel.id}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    py: 1,
                                                    borderBottom: '1px solid',
                                                    borderColor: `${heroTextColor}15`,
                                                }}
                                            >
                                                <Box sx={{
                                                    width: 40, height: 40,
                                                    borderRadius: '50%',
                                                    overflow: 'hidden',
                                                    flexShrink: 0,
                                                    bgcolor: `${heroTextColor}10`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '2px solid',
                                                    borderColor: `${heroTextColor}30`,
                                                    mr: 1.5,
                                                }}>
                                                    {sel.image ? (
                                                        <img src={sel.image} alt={sel.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <Typography sx={{ fontSize: '1.4rem', color: heroTextColor }}>{sel.name.charAt(0).toUpperCase()}</Typography>
                                                    )}
                                                </Box>
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography sx={{ fontSize: '1.6rem', fontWeight: 500, color: heroTextColor }}>
                                                        {sel.name}
                                                    </Typography>
                                                    {cat && (
                                                        <Typography sx={{ fontSize: '1.2rem', color: heroTextColor, opacity: 0.5 }}>
                                                            {cat.name}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <IconButton
                                                    onClick={() => modifierSelectorRef.current?.removeSelection(sel.categoryId, sel.id)}
                                                    sx={{
                                                        color: heroTextColor,
                                                        opacity: 0.5,
                                                        p: 0.5,
                                                        '&:hover': { opacity: 1, bgcolor: `${heroTextColor}15` },
                                                    }}
                                                >
                                                    <CloseIcon sx={{ fontSize: 18 }} />
                                                </IconButton>
                                            </Box>
                                        );
                                    })
                                ) : (
                                    <Typography sx={{ fontSize: '1.4rem', color: heroTextColor, opacity: 0.5, mt: 2 }}>
                                        Your selections will appear here
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    )}

                    {/* Top section - gradient background + product image (hidden for MYO — uses full card instead) */}
                    <Box
                        onClick={isCollectible && !isWide && !isMYO ? () => setImageExpanded(prev => !prev) : undefined}
                        sx={{
                            display: isMYO ? 'none' : 'flex',
                            position: 'fixed',
                            top: 0, left: 0,
                            right: isWide ? 'auto' : 0,
                            width: isWide ? '50%' : '100%',
                            height: isWide ? '100dvh' : heroHeight,
                            zIndex: 103,
                            background: isWide ? 'transparent' : backgroundStyle,
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            overscrollBehavior: 'none',
                            touchAction: 'none',
                            transition: cardExpansion > 0 ? 'none' : 'height 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                            cursor: isCollectible && !isWide ? 'pointer' : undefined,
                        }}
                    >
                        {isMYO ? (
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                width: '100%',
                                height: '100%',
                                pt: 2,
                                overflow: 'hidden',
                            }}>
                                {/* Fulfillment ad lib */}
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, px: 2, mb: 1 }}>
                                    <Typography
                                        onClick={() => setBottomMode(bottomMode === 'fulfillment' ? 'modifiers' : 'fulfillment')}
                                        sx={{
                                            fontSize: '1.6rem',
                                            fontWeight: 600,
                                            color: heroTextColor,
                                            textDecoration: 'underline',
                                            textDecorationStyle: 'dotted',
                                            textUnderlineOffset: '3px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {fulfillmentMethod === 'pickup' ? 'Pickup' : 'Delivery'}
                                    </Typography>
                                    <Typography sx={{ fontSize: '1.6rem', color: heroTextColor }}>
                                        from
                                    </Typography>
                                    <Typography
                                        onClick={() => setBottomMode(bottomMode === 'location' ? 'modifiers' : 'location')}
                                        sx={{
                                            fontSize: '1.6rem',
                                            fontWeight: 600,
                                            color: heroTextColor,
                                            textDecoration: 'underline',
                                            textDecorationStyle: 'dotted',
                                            textUnderlineOffset: '3px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {selectedLocationObj?.name || 'Select Location'}
                                    </Typography>
                                </Box>

                                {/* Variant toggle group */}
                                {variants.length > 1 && (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                                        <ToggleButtonGroup
                                            value={selectedVariantId}
                                            exclusive
                                            onChange={(_, val) => { if (val) setSelectedVariantId(val); }}
                                            sx={{
                                                borderRadius: 2,
                                                overflow: 'hidden',
                                                border: `1.5px solid ${heroTextColor}`,
                                                '& .MuiToggleButtonGroup-grouped': {
                                                    border: 'none',
                                                    borderRight: `1px solid ${heroTextColor}40`,
                                                    '&:last-of-type': { borderRight: 'none' },
                                                },
                                            }}
                                        >
                                            {variants.map((variant) => (
                                                <ToggleButton
                                                    key={variant.id}
                                                    value={variant.id}
                                                    sx={{
                                                        textTransform: 'none',
                                                        minHeight: 0,
                                                        lineHeight: 1.2,
                                                        px: 1.5,
                                                        py: '4px',
                                                        fontSize: '1.6rem',
                                                        whiteSpace: 'nowrap',
                                                        color: heroTextColor,
                                                        '&.Mui-selected': {
                                                            bgcolor: heroTextColor,
                                                            color: getTextColorForBackground(heroTextColor),
                                                            '&:hover': { bgcolor: heroTextColor },
                                                        },
                                                        '&:hover': { bgcolor: `${heroTextColor}20` },
                                                    }}
                                                >
                                                    {variant.name || variant.catalogName || variant.title || `Option ${variants.indexOf(variant) + 1}`}
                                                </ToggleButton>
                                            ))}
                                        </ToggleButtonGroup>
                                    </Box>
                                )}

                                {/* Product title */}
                                <Typography sx={{
                                    fontSize: '2rem',
                                    fontWeight: 700,
                                    textAlign: 'center',
                                    color: heroTextColor,
                                    mb: 0.5,
                                }}>
                                    {item?.title || product?.name}
                                </Typography>

                                {/* Next step indicator */}
                                {myoNextStep && (
                                    <Typography sx={{
                                        textAlign: 'center',
                                        fontSize: '1.4rem',
                                        color: heroTextColor,
                                        opacity: 0.8,
                                        mb: 1,
                                    }}>
                                        {myoNextStep}
                                    </Typography>
                                )}

                                {/* Scrollable selections list */}
                                <Box sx={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    px: 1,
                                    WebkitOverflowScrolling: 'touch',
                                }}>
                                    {myoSelectedImages.length > 0 ? (
                                        myoSelectedImages.map((sel) => (
                                            <Box
                                                key={sel.id}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    px: 2,
                                                    py: 0.75,
                                                }}
                                            >
                                                {/* Circular icon */}
                                                <Box sx={{
                                                    width: 40, height: 40,
                                                    borderRadius: '50%',
                                                    overflow: 'hidden',
                                                    flexShrink: 0,
                                                    bgcolor: '#f5f0e6',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '2px solid',
                                                    borderColor: `${heroTextColor}40`,
                                                }}>
                                                    {sel.image ? (
                                                        <img src={sel.image} alt={sel.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <Typography sx={{ fontSize: '1.4rem', color: heroTextColor }}>{sel.name.charAt(0).toUpperCase()}</Typography>
                                                    )}
                                                </Box>
                                                {/* Name */}
                                                <Typography sx={{
                                                    flex: 1,
                                                    ml: 1.5,
                                                    fontSize: '1.6rem',
                                                    fontWeight: 500,
                                                    color: heroTextColor,
                                                }}>
                                                    {sel.name}
                                                </Typography>
                                                {/* Remove button */}
                                                <IconButton
                                                    onClick={() => modifierSelectorRef.current?.removeSelection(sel.categoryId, sel.id)}
                                                    sx={{
                                                        color: heroTextColor,
                                                        opacity: 0.7,
                                                        p: 0.5,
                                                        '&:hover': { opacity: 1, bgcolor: `${heroTextColor}20` },
                                                    }}
                                                >
                                                    <CloseIcon sx={{ fontSize: 18 }} />
                                                </IconButton>
                                            </Box>
                                        ))
                                    ) : (
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '100%',
                                            opacity: 0.6,
                                        }}>
                                            <Typography sx={{ color: heroTextColor, fontSize: '1.4rem', textAlign: 'center' }}>
                                                Select options below to build your order
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        ) : (
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1,
                                width: '100%',
                                height: '100%',
                                pt: variants.length > 1 && !isWide ? '52px' : 0,
                            }}>
                                {/* Variant toggle group (mobile only — wide version rendered outside) */}
                                {!isWide && variants.length > 1 && (
                                    <ToggleButtonGroup
                                        value={selectedVariantId}
                                        exclusive
                                        onChange={(_, val) => { if (val) setSelectedVariantId(val); }}
                                        sx={{
                                            position: 'absolute',
                                            top: 16,
                                            left: '50%',
                                            zIndex: 2,
                                            opacity: contentVisible ? 1 : 0,
                                            transform: contentVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-15px)',
                                            transition: 'opacity 0.4s ease 0.15s, transform 0.4s ease 0.15s',
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                            border: `1.5px solid ${heroTextColor}`,
                                            '& .MuiToggleButtonGroup-grouped': {
                                                border: 'none',
                                                borderRight: `1px solid ${heroTextColor}40`,
                                                '&:last-of-type': { borderRight: 'none' },
                                            },
                                        }}
                                    >
                                        {variants.map((variant) => (
                                            <ToggleButton
                                                key={variant.id}
                                                value={variant.id}
                                                sx={{
                                                    textTransform: 'none',
                                                    minHeight: 0,
                                                    lineHeight: 1.2,
                                                    px: 1.5,
                                                    py: '4px',
                                                    fontSize: '1.6rem',
                                                    whiteSpace: 'nowrap',
                                                    color: heroTextColor,
                                                    '&.Mui-selected': {
                                                        bgcolor: heroTextColor,
                                                        color: getTextColorForBackground(heroTextColor),
                                                        '&:hover': {
                                                            bgcolor: heroTextColor,
                                                        },
                                                    },
                                                    '&:hover': {
                                                        bgcolor: `${heroTextColor}20`,
                                                    },
                                                }}
                                            >
                                                {variant.name || variant.catalogName || variant.title || `Option ${variants.indexOf(variant) + 1}`}
                                            </ToggleButton>
                                        ))}
                                    </ToggleButtonGroup>
                                )}
                                {/* Product image with crossfade on variant change */}
                                <AnimatePresence mode="wait">
                                    {heroImage && (
                                        <motion.img
                                            key={heroImage}
                                            src={heroImage}
                                            alt={item?.title || ''}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                                            style={{
                                                flex: 1,
                                                minHeight: 0,
                                                width: '100%',
                                                objectFit: 'contain',
                                            }}
                                        />
                                    )}
                                </AnimatePresence>
                                {/* Wide layout: thumbnail gallery overlaid at bottom of image pane.
                                    Fades in after content is visible, fades out when closing. */}
                                {showWideThumbnails && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            bottom: 12,
                                            left: 0,
                                            right: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 1,
                                            px: 2,
                                            zIndex: 2,
                                            opacity: (contentVisible && !closing) ? 1 : 0,
                                            transition: 'opacity 0.3s ease',
                                        }}
                                    >
                                        {allProductImages.map((img, idx) => {
                                            const imgUrl = typeof img === 'string' ? img : img.url;
                                            const isActive = selectedThumbnailIndex != null
                                                ? idx === selectedThumbnailIndex
                                                : idx === 0;
                                            return (
                                                <Box
                                                    key={idx}
                                                    onClick={() => setSelectedThumbnailIndex(idx)}
                                                    sx={{
                                                        flexShrink: 0,
                                                        width: 60,
                                                        height: 60,
                                                        borderRadius: 1,
                                                        overflow: 'hidden',
                                                        cursor: 'pointer',
                                                        border: isActive ? `2px solid ${heroTextColor}` : '2px solid transparent',
                                                        opacity: isActive ? 1 : 0.6,
                                                        transition: 'all 0.2s',
                                                        '&:hover': { opacity: 1 },
                                                    }}
                                                >
                                                    <img
                                                        src={imgUrl}
                                                        alt=""
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                )}
                            </Box>
                        )}
            </Box>

                    {/* Collectibles: horizontal thumbnail strip below hero image */}
                    {reserveThumbnailSpace && (
                        <Box
                            sx={{
                                position: 'fixed',
                                top: heroHeight,
                                left: 0,
                                right: 0,
                                height: thumbnailStripHeight,
                                zIndex: 104,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                px: 2,
                                overflowX: 'auto',
                                WebkitOverflowScrolling: 'touch',
                                '&::-webkit-scrollbar': { display: 'none' },
                                scrollbarWidth: 'none',
                                transition: cardExpansion > 0 ? 'none' : 'top 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                                bgcolor: collectibleItem?.backgroundColor || '#ffffff',
                            }}
                        >
                            {allProductImages.map((img, idx) => {
                                const imgUrl = typeof img === 'string' ? img : img.url;
                                const isActive = selectedThumbnailIndex != null
                                    ? idx === selectedThumbnailIndex
                                    : idx === 0;
                                return (
                                    <Box
                                        key={idx}
                                        onClick={() => setSelectedThumbnailIndex(idx)}
                                        sx={{
                                            flexShrink: 0,
                                            width: 52,
                                            height: 52,
                                            borderRadius: 1,
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            border: isActive ? `2px solid ${heroTextColor}` : '2px solid transparent',
                                            opacity: isActive ? 1 : 0.6,
                                            transition: 'all 0.2s',
                                            '&:hover': { opacity: 1 },
                                        }}
                                    >
                                        <img
                                            src={imgUrl}
                                            alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </Box>
                                );
                            })}
                        </Box>
                    )}

                    {/* Variant toggle group (wide only — fixed, centered on full page) */}
                    {isWide && variants.length > 1 && (
                        <ToggleButtonGroup
                            value={selectedVariantId}
                            exclusive
                            onChange={(_, val) => { if (val) setSelectedVariantId(val); }}
                            sx={{
                                position: 'fixed',
                                top: 16,
                                left: '50%',
                                zIndex: 115,
                                opacity: contentVisible ? 1 : 0,
                                transform: contentVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-15px)',
                                transition: 'opacity 0.4s ease 0.15s, transform 0.4s ease 0.15s',
                                borderRadius: 2,
                                overflow: 'hidden',
                                border: `1.5px solid ${heroTextColor}`,
                                '& .MuiToggleButtonGroup-grouped': {
                                    border: 'none',
                                    borderRight: `1px solid ${heroTextColor}40`,
                                    '&:last-of-type': { borderRight: 'none' },
                                },
                            }}
                        >
                            {variants.map((variant) => (
                                <ToggleButton
                                    key={variant.id}
                                    value={variant.id}
                                    sx={{
                                        textTransform: 'none',
                                        minHeight: 0,
                                        lineHeight: 1.2,
                                        px: 1.5,
                                        py: '4px',
                                        fontSize: '1.6rem',
                                        whiteSpace: 'nowrap',
                                        color: heroTextColor,
                                        '&.Mui-selected': {
                                            bgcolor: heroTextColor,
                                            color: getTextColorForBackground(heroTextColor),
                                            '&:hover': {
                                                bgcolor: heroTextColor,
                                            },
                                        },
                                        '&:hover': {
                                            bgcolor: `${heroTextColor}20`,
                                        },
                                    }}
                                >
                                    {variant.name || variant.catalogName || variant.title || `Option ${variants.indexOf(variant) + 1}`}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    )}
                </>
            )}

            {/* Bottom section - scrollable info card (zIndex 60, above overlay at 55) */}
            <motion.div
                initial={isWide ? { x: '100%' } : { y: '100%' }}
                animate={isWide
                    ? { x: closing ? '100%' : '0%' }
                    : { y: closing ? '100%' : '0%' }
                }
                transition={{ duration: closing ? 0.3 : 0.4, ease: [0.22, 1, 0.36, 1] }}
                style={{
                    position: 'fixed',
                    top: isWide ? 56 : (isMYO ? 0 : (reserveThumbnailSpace ? `calc(${heroHeight} + ${thumbnailStripHeight})` : heroHeight)),
                    left: isWide ? 'calc(50% + 24px)' : (isMYO ? 0 : 12),
                    right: isWide ? 24 : (isMYO ? 0 : 12),
                    bottom: isWide ? 24 : 0,
                    backgroundColor: 'white',
                    borderRadius: isWide ? 24 : (isMYO ? 0 : '24px 24px 0 0'),
                    boxShadow: isWide
                        ? '0 8px 32px rgba(0,0,0,0.12)'
                        : (isCollectible && (!collectibleItem?.backgroundColor || collectibleItem.backgroundColor === '#ffffff' || collectibleItem.backgroundColor === '#fff'))
                            ? '0 -4px 16px rgba(0,0,0,0.15)'
                            : 'none',
                    zIndex: 110,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    overscrollBehavior: 'none',
                    transition: (isCollectible && !isWide && cardExpansion === 0) ? 'top 0.35s cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
                }}
            >
                {/* Drag handle indicator (hidden for MYO and when image expanded) */}
                {!isMYO && !imageExpanded && (
                    <Box sx={{ display: isWide ? 'none' : 'flex', justifyContent: 'center', pt: 1.5, pb: 1 }}>
                        <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'grey.300' }} />
                    </Box>
                )}

                {/* MYO: Fixed header — ad lib + product name + variant toggle + counter (mobile only when wide) */}
                {isMYO && !isWide && (
                    <Box sx={{
                        flexShrink: 0,
                        px: 3,
                        pt: 2,
                        pb: 1.5,
                        borderBottom: '1px solid',
                        borderColor: 'grey.200',
                        opacity: (contentVisible && !closing) ? 1 : 0,
                        transition: 'opacity 0.35s ease',
                    }}>
                        {/* Fulfillment ad lib */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, mb: 1 }}>
                            <Typography
                                onClick={() => setBottomMode(bottomMode === 'fulfillment' ? 'modifiers' : 'fulfillment')}
                                sx={{
                                    fontSize: '1.6rem',
                                    fontWeight: 600,
                                    textDecoration: 'underline',
                                    textDecorationStyle: 'dotted',
                                    textUnderlineOffset: '3px',
                                    cursor: 'pointer',
                                }}
                            >
                                {fulfillmentMethod === 'pickup' ? 'Pickup' : 'Delivery'}
                            </Typography>
                            <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary' }}>
                                from
                            </Typography>
                            <Typography
                                onClick={() => setBottomMode(bottomMode === 'location' ? 'modifiers' : 'location')}
                                sx={{
                                    fontSize: '1.6rem',
                                    fontWeight: 600,
                                    textDecoration: 'underline',
                                    textDecorationStyle: 'dotted',
                                    textUnderlineOffset: '3px',
                                    cursor: 'pointer',
                                }}
                            >
                                {selectedLocationObj?.name || 'Select Location'}
                            </Typography>
                        </Box>
                        {/* Product title */}
                        <Typography sx={{ fontSize: '1.8rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
                            {item?.title || product?.name}
                        </Typography>
                        {/* Selected modifier icons */}
                        {myoSelectedImages.length > 0 && (
                            <>
                                <Divider sx={{ my: 1 }} />
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                    {myoSelectedImages.map((sel, idx) => (
                                        <React.Fragment key={sel.id}>
                                            {idx > 0 && (
                                                <Typography sx={{ fontSize: '1.2rem', color: 'text.disabled', fontWeight: 500, lineHeight: 1 }}>+</Typography>
                                            )}
                                            <Box sx={{
                                                width: 32, height: 32,
                                                borderRadius: '50%',
                                                overflow: 'hidden',
                                                flexShrink: 0,
                                                bgcolor: 'grey.100',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '1.5px solid',
                                                borderColor: 'grey.300',
                                            }}>
                                                {sel.image ? (
                                                    <img src={sel.image} alt={sel.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'text.secondary' }}>{sel.name.charAt(0)}</Typography>
                                                )}
                                            </Box>
                                        </React.Fragment>
                                    ))}
                                </Box>
                            </>
                        )}
                        {/* Variant toggle (only in header for non-MYO or single variant) */}
                        {variants.length > 1 && !(isMYO && hasMultipleVariants) && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                                <ToggleButtonGroup
                                    value={selectedVariantId}
                                    exclusive
                                    onChange={(_, val) => { if (val) setSelectedVariantId(val); }}
                                    sx={{
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        border: '1.5px solid',
                                        borderColor: 'grey.400',
                                        '& .MuiToggleButtonGroup-grouped': {
                                            border: 'none',
                                            borderRight: '1px solid',
                                            borderColor: 'grey.300',
                                            '&:last-of-type': { borderRight: 'none' },
                                        },
                                    }}
                                >
                                    {variants.map((variant) => (
                                        <ToggleButton
                                            key={variant.id}
                                            value={variant.id}
                                            sx={{
                                                textTransform: 'none',
                                                minHeight: 0,
                                                lineHeight: 1.2,
                                                px: 1.5,
                                                py: '4px',
                                                fontSize: '1.4rem',
                                                whiteSpace: 'nowrap',
                                                '&.Mui-selected': {
                                                    bgcolor: 'black',
                                                    color: 'white',
                                                    '&:hover': { bgcolor: 'black' },
                                                },
                                            }}
                                        >
                                            {variant.name || variant.catalogName || variant.title || `Option ${variants.indexOf(variant) + 1}`}
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                            </Box>
                        )}
                        {/* Next step indicator */}
                        {myoNextStep && (
                            <Typography sx={{ textAlign: 'center', fontSize: '1.4rem', color: 'text.secondary', mt: 0.5 }}>
                                {myoNextStep}
                            </Typography>
                        )}
                    </Box>
                )}

                {/* Scrollable content (hidden when image expanded on collectibles) */}
                <Box
                    ref={contentScrollRef}
                    sx={{
                        flex: imageExpanded ? 0 : 1,
                        overflowY: imageExpanded ? 'hidden' : 'auto',
                        px: 3,
                        pt: isWide ? 3 : (isMYO ? 0 : 0),
                        pb: isMYO ? 0 : 2,
                        opacity: (contentVisible && !closing && !imageExpanded) ? 1 : 0,
                        maxHeight: imageExpanded ? 0 : undefined,
                        transform: (contentVisible && !closing && !imageExpanded) ? 'translateY(0)' : 'translateY(20px)',
                        transition: 'opacity 0.3s ease, transform 0.3s ease',
                    }}
                >
                    {/* Product name + price */}
                    {!isMYO && (
                        <>
                            <Typography sx={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.2, mb: 0.5 }}>
                                {item?.title || product?.name}
                            </Typography>
                            <Typography sx={{ fontSize: '1.6rem', fontWeight: 500, color: 'grey.600', mb: 1.5 }}>
                                {displayPrice}
                            </Typography>

                            {/* Quantity selector */}
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', border: '1px solid', borderColor: 'grey.300', borderRadius: 2, mb: 2 }}>
                                <IconButton onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1} size="small">
                                    <RemoveIcon />
                                </IconButton>
                                <Typography sx={{ px: 1, fontWeight: 600, fontSize: '1.6rem', minWidth: 28, textAlign: 'center' }}>
                                    {quantity}
                                </Typography>
                                <IconButton onClick={() => setQuantity(q => q + 1)} size="small">
                                    <AddIcon />
                                </IconButton>
                            </Box>

                            {/* Fulfillment method selector (any product with fulfillment methods) */}
                            {hasFulfillmentMethods && item?.inventory && (() => {
                                const inv = item.inventory;

                                // Check inventory for each fulfillment method
                                const localQty = inv.trackInventory
                                    ? (inv.byLocation || []).find(l => l.locationId === selectedLocationObj?.id)?.quantity || 0
                                    : null; // null = not tracked = available
                                // Shipping: available if ANY location has inventory (not just warehouse)
                                const totalQty = inv.trackInventory ? inv.totalQuantity || 0 : null;

                                const pickupAvailable = productFulfillmentMethods.includes('pickup') && selectedLocationObj && (localQty === null || localQty > 0);
                                const deliveryAvailable = productFulfillmentMethods.includes('delivery') && selectedLocationObj && (localQty === null || localQty > 0);
                                const shippingAvailable = productFulfillmentMethods.includes('shipping') && (totalQty === null || totalQty > 0);
                                const availableMethods = [
                                    ...(pickupAvailable ? ['pickup'] : []),
                                    ...(deliveryAvailable ? ['delivery'] : []),
                                    ...(shippingAvailable ? ['shipping'] : []),
                                ];

                                const allMethods = [
                                    productFulfillmentMethods.includes('pickup') && { key: 'pickup', available: pickupAvailable, icon: '🏪', label: 'Pickup', sub: selectedLocationObj?.name || 'Select store' },
                                    productFulfillmentMethods.includes('delivery') && { key: 'delivery', available: deliveryAvailable, icon: '🛵', label: 'Delivery', sub: 'Local area' },
                                    productFulfillmentMethods.includes('shipping') && { key: 'shipping', available: shippingAvailable, icon: '📦', label: 'Ship', sub: 'To your door' },
                                ].filter(Boolean);

                                if (availableMethods.length === 0) {
                                    return (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography sx={{ fontSize: '1.4rem', fontWeight: 600, color: 'error.main' }}>
                                                Sold Out
                                            </Typography>
                                        </Box>
                                    );
                                }

                                return (
                                    <Box sx={{ mb: 2 }}>
                                        <Typography sx={{ fontSize: '1.2rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
                                            How would you like it?
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                            {allMethods.map(({ key, available, icon, label, sub }) => {
                                                const selected = fulfillmentMethod === key;
                                                return (
                                                    <Box
                                                        key={key}
                                                        onClick={() => available && setFulfillmentMethod(key)}
                                                        sx={{
                                                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                            py: 1.5, px: 1, borderRadius: 2, border: '2px solid',
                                                            borderColor: !available ? 'grey.200' : selected ? 'black' : 'grey.300',
                                                            bgcolor: !available ? 'grey.50' : selected ? 'grey.50' : 'white',
                                                            opacity: available ? 1 : 0.45,
                                                            cursor: available ? 'pointer' : 'default',
                                                            transition: 'all 0.2s',
                                                        }}
                                                    >
                                                        <Typography sx={{ fontSize: '1.8rem', mb: 0.25 }}>{icon}</Typography>
                                                        <Typography sx={{ fontSize: '1.3rem', fontWeight: 600, lineHeight: 1.2, textAlign: 'center' }}>{label}</Typography>
                                                        <Typography sx={{ fontSize: '1.1rem', color: 'text.secondary', lineHeight: 1.2, textAlign: 'center' }}>
                                                            {available ? sub : 'Unavailable'}
                                                        </Typography>
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    </Box>
                                );
                            })()}
                        </>
                    )}
                    {/* MYO: Variant selection (shown first for multi-variant, before modifiers) */}
                    {isMYO && hasMultipleVariants && !selectedVariantId && bottomMode === 'modifiers' && (
                        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, textAlign: 'center', mb: 1 }}>
                                Select Your Size
                            </Typography>
                            {variants.map((variant) => {
                                const _locSlug = localStorage.getItem('selectedLocation');
                                const _locP = _locSlug && variant.locationPrices?.[_locSlug];
                                const variantPrice = parseFloat(_locP != null ? _locP : (variant.price?.amount || variant.price || 0));
                                const isUnavailable = variant.availableForSale === false;
                                return (
                                    <Box
                                        key={variant.id}
                                        onClick={() => !isUnavailable && setSelectedVariantId(variant.id)}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            p: 2,
                                            borderRadius: 3,
                                            border: '2px solid',
                                            borderColor: 'grey.300',
                                            bgcolor: 'white',
                                            cursor: isUnavailable ? 'default' : 'pointer',
                                            opacity: isUnavailable ? 0.5 : 1,
                                            transition: 'all 0.15s',
                                            '&:hover': !isUnavailable ? { borderColor: 'black', bgcolor: 'grey.50' } : {},
                                        }}
                                    >
                                        <Typography sx={{ fontSize: '1.6rem', fontWeight: 600 }}>
                                            {variant.name || variant.catalogName || variant.title}
                                        </Typography>
                                        <Typography sx={{ fontSize: '1.6rem', fontWeight: 500, color: isUnavailable ? 'text.disabled' : 'text.primary' }}>
                                            {isUnavailable ? 'Sold Out' : `$${variantPrice.toFixed(2)}`}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}
                    {/* MYO: Modifier selection (shown after variant is picked for multi-variant) */}
                    {isMYO && productSku && bottomMode === 'modifiers' && (!hasMultipleVariants || selectedVariantId) && (
                        <ModifierSelector
                            ref={modifierSelectorRef}
                            sku={productSku}
                            layout="grid"
                            onSelectionsChange={handleMyoSelectionsChange}
                            onPriceChange={() => {}}
                            onValidationChange={() => {}}
                            onAllStepsComplete={setMyoAllValid}
                            onCanContinueChange={setCanContinueModifiers}
                            onIsLastStepChange={setIsLastModifierStep}
                        />
                    )}
                    {isMYO && bottomMode === 'fulfillment' && (
                        <Box sx={{ py: 2 }}>
                            <Typography sx={{ fontSize: '1.4rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, mb: 2 }}>
                                Pickup or Delivery
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                {['pickup', 'delivery'].map((method) => (
                                    <Box
                                        key={method}
                                        onClick={() => {
                                            setFulfillmentMethod(method);
                                            setBottomMode('modifiers');
                                        }}
                                        sx={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: 3,
                                            border: '2px solid',
                                            borderColor: fulfillmentMethod === method ? 'black' : 'grey.300',
                                            bgcolor: fulfillmentMethod === method ? 'grey.50' : 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            py: 4,
                                        }}
                                    >
                                        <Typography sx={{ fontSize: '2rem', fontWeight: 700 }}>
                                            {method === 'pickup' ? 'Pickup' : 'Delivery'}
                                        </Typography>
                                        <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary', mt: 1, textAlign: 'center', px: 2 }}>
                                            {method === 'pickup'
                                                ? `Ready at ${selectedLocationObj?.name || 'store'}`
                                                : 'Delivered to your door'}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    )}
                    {isMYO && bottomMode === 'location' && (
                        <Box sx={{ py: 2 }}>
                            <Typography sx={{ fontSize: '1.4rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, mb: 2 }}>
                                Select Location
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {storeLocations.map((location) => (
                                    <Box
                                        key={location.id}
                                        onClick={() => {
                                            localStorage.setItem('selectedLocation', location.id);
                                            window.dispatchEvent(new CustomEvent('locationChanged'));
                                            setBottomMode('modifiers');
                                        }}
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            borderRadius: 3,
                                            border: '2px solid',
                                            borderColor: location.id === selectedLocationId ? 'black' : 'grey.300',
                                            bgcolor: location.id === selectedLocationId ? 'grey.50' : 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            py: 3,
                                            px: 3,
                                        }}
                                    >
                                        <Typography sx={{ fontSize: '1.8rem', fontWeight: 700 }}>
                                            {location.name}
                                        </Typography>
                                        <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary', mt: 0.5, textAlign: 'center' }}>
                                            {location.address}
                                        </Typography>
                                        {location.phone && (
                                            <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary', mt: 0.5 }}>
                                                {location.phone}
                                            </Typography>
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    )}

                    {/* Display Modifiers - flat 3-column grid (non-MYO products only) */}
                    {!isMYO && item?.displayModifiers?.length > 0 && (
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                            gap: 1.5,
                            mb: 3,
                        }}>
                            {item.displayModifiers.flatMap((dm) =>
                                dm.options.map((opt) => (
                                    <Box
                                        key={opt.optionId}
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {opt.image && (
                                            <Box
                                                component="img"
                                                src={opt.image}
                                                alt={opt.name}
                                                sx={{
                                                    width: '100%',
                                                    aspectRatio: '1',
                                                    borderRadius: 2,
                                                    objectFit: 'cover',
                                                    mb: 0.5,
                                                }}
                                            />
                                        )}
                                        <Typography sx={{
                                            fontSize: '1.6rem',
                                            textAlign: 'center',
                                            color: 'grey.700',
                                            lineHeight: 1.2,
                                            width: '100%',
                                            wordBreak: 'break-word',
                                            hyphens: 'auto',
                                        }}>
                                            {opt.name}
                                        </Typography>
                                    </Box>
                                ))
                            )}
                        </Box>
                    )}

                    {/* Description (hidden during MYO modifier flow — shown on intro screen instead) */}
                    {product?.description && !isMYO && (
                        <Typography sx={{ fontSize: '1.6rem', color: 'grey.600', lineHeight: 1.6, mb: 3 }}>
                            {product.description}
                        </Typography>
                    )}


                </Box>

                {/* Collapsed card summary (visible when image expanded) */}
                {imageExpanded && !isMYO && (
                    <Box sx={{ px: 3, pt: 2, pb: 1 }}>
                        <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.2 }}>
                            {item?.title || product?.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                            <Typography sx={{ fontSize: '1.4rem', fontWeight: 500, color: 'grey.600' }}>
                                {displayPrice}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid', borderColor: 'grey.300', borderRadius: 2 }}>
                                <IconButton onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1} size="small" sx={{ p: 0.5 }}>
                                    <RemoveIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                                <Typography sx={{ px: 0.5, fontWeight: 600, fontSize: '1.4rem', minWidth: 20, textAlign: 'center' }}>
                                    {quantity}
                                </Typography>
                                <IconButton onClick={() => setQuantity(q => q + 1)} size="small" sx={{ p: 0.5 }}>
                                    <AddIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Box>
                        </Box>
                        <Typography
                            onClick={() => setImageExpanded(false)}
                            sx={{
                                fontSize: '1.4rem',
                                fontWeight: 600,
                                color: 'black',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                textUnderlineOffset: '2px',
                                mt: 0.5,
                            }}
                        >
                            See more
                        </Typography>
                    </Box>
                )}

                {/* Sticky bottom bar - close + add to cart */}
                <Box ref={bottomBarRef} sx={{
                    mt: 'auto',
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: 1.5,
                    px: 3,
                    py: 2,
                    borderTop: '1px solid',
                    borderColor: 'grey.200',
                    bgcolor: 'white',
                }}>
                    {/* Close button */}
                    <IconButton
                        onClick={onClose}
                        sx={{
                            border: '1px solid',
                            borderColor: 'grey.300',
                            borderRadius: 2,
                            flexShrink: 0,
                            aspectRatio: '1',
                        }}
                    >
                        <CloseIcon />
                    </IconButton>

                    {/* MYO: Add to Cart · $price */}
                    {isMYO && productSku ? (
                        <Button
                            variant="contained"
                            fullWidth
                            onClick={handleAddToCart}
                            disabled={addingToCart || !isAvailable || !selectedVariantId || !myoAllValid}
                            sx={{
                                py: 1.5,
                                fontSize: '1.6rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                borderRadius: 3,
                                whiteSpace: 'nowrap',
                                bgcolor: isAvailable ? 'black' : 'grey.400',
                                '&:hover': { bgcolor: isAvailable ? 'grey.800' : 'grey.400' },
                                '&.Mui-disabled': { bgcolor: 'grey.300', color: 'grey.500' },
                            }}
                        >
                            {addingToCart ? (
                                <CircularProgress size={24} color="inherit" />
                            ) : !isAvailable ? (
                                'Out of Stock'
                            ) : (!selectedVariantId || !myoAllValid) ? (
                                'Add to Cart'
                            ) : (
                                `Add to Cart \u00B7 ${displayPrice}`
                            )}
                        </Button>
                    ) : (
                        <Button
                            variant="contained"
                            fullWidth
                            onClick={handleAddToCart}
                            disabled={addingToCart || !selectedVariantId || !isAvailable}
                            sx={{
                                py: 1.5,
                                fontSize: '1.6rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                borderRadius: 3,
                                bgcolor: isAvailable ? 'black' : 'grey.400',
                                '&:hover': { bgcolor: isAvailable ? 'grey.800' : 'grey.400' },
                            }}
                        >
                            {addingToCart ? (
                                <CircularProgress size={24} color="inherit" />
                            ) : isAvailable ? (
                                'Add to Cart'
                            ) : !availableAtLocation ? (
                                `Not Available at ${locationName}`
                            ) : (
                                'Out of Stock'
                            )}
                        </Button>
                    )}
                </Box>
            </motion.div>

        </>
    );
};

// ===========================================
// DISCOUNT CONFIGURATION
// Values are now pulled dynamically from discounts.json
// ===========================================

// To re-enable the free shipping reward, see /docs/free-shipping-reward.md

// Error boundary to catch render errors and display them
class CommerceErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, info) { console.error('[Commerce] Render error:', error, info); }
    render() {
        if (this.state.hasError) {
            return React.createElement('div', { style: { padding: 40, fontFamily: 'monospace' } },
                React.createElement('h2', { style: { color: 'red' } }, 'Commerce page error'),
                React.createElement('pre', { style: { whiteSpace: 'pre-wrap', color: '#333', fontSize: 14 } },
                    String(this.state.error?.message) + '\n\n' + String(this.state.error?.stack)
                ),
                React.createElement('button', { onClick: () => { sessionStorage.removeItem('addedToCart'); this.setState({ hasError: false }); } }, 'Clear & Retry')
            );
        }
        return this.props.children;
    }
}

/**
 * Commerce Homepage
 * Focuses on hero content, featured products, and new releases
 * Full product catalog moved to /directory
 */
function CommerceInner() {
    const { commerceState, sendToCommerce, setActiveTextColor, setIsProductDetail, setOnCloseProductDetail, setCartCount, setEffectivePath } = useContext(LayoutContext);
    const { products: shopifyProducts, loading: shopifyLoading, error: shopifyError, categories, dessertSubcategories, merchandiseSubcategories, getProductHierarchy, getCategoryChildren, getSubcategories, getContainerCategories } = useShopify();
    const localCart = useCart();
    
    // State for reward selection (for quantity-based discounts with multiple options)
    const [selectedRewards, setSelectedRewards] = useState({});

    // State for mobile swiper (default mode)
    const [currentSlide, setCurrentSlide] = useState(0);
    const [selectedProducts, setSelectedProducts] = useState({});
    const [selectedContainerSize, setSelectedContainerSize] = useState({});

    // Refs for close callback (feedItems/feedIndex defined later in component)
    const feedItemsRef = useRef([]);
    const feedIndexRef = useRef(0);

    // State for card grid + vertical feed
    // On fresh page load at /product/*, don't restore feed state (URL was set via pushState for SEO)
    const isProductUrl = window.location.pathname.startsWith('/product/');
    const [feedIndex, setFeedIndex] = useState(() => isProductUrl ? 0 : (commerceState?.context?.feedIndex ?? 0));
    feedIndexRef.current = feedIndex;
    const isHomepageLoad = window.location.pathname === '/';
    const [feedActive, setFeedActive] = useState(() => {
        // Never restore feedActive on product URLs or homepage — it's only for category pages
        if (isProductUrl || isHomepageLoad) return false;
        return commerceState?.context?.feedActive ?? false;
    });
    const [expandTransition, setExpandTransition] = useState(null); // { rect, bgStyle, imgRect, imgSrc }
    const [collapseTransition, setCollapseTransition] = useState(null); // reverse animation
    const [closingDetail, setClosingDetail] = useState(false); // triggers card slide-down before collapse
    const [closingProduct, setClosingProduct] = useState(false); // triggers close animation for URL-based product view
    const closeTimeoutRef = useRef(null); // track close timeout for cancellation
    const lastCardTransitionRef = useRef(null); // remember card position for reverse
    const [activeMerchSection, setActiveMerchSection] = useState(0); // scroll-based active section for merchandise
    const feedScrollPositionRef = useRef(0); // remember scroll position when entering product detail
    const originPathRef = useRef(
        // If direct-loading a product URL, don't store it as origin — will be resolved from product category
        window.location.pathname.startsWith('/product/') ? null : (window.location.pathname || '/desserts')
    ); // remember category path to restore on close

    // Sync feedIndex and feedActive to xState for persistence
    useEffect(() => {
        sendToCommerce?.({ type: 'SET_FEED_INDEX', index: feedIndex });
    }, [feedIndex, sendToCommerce]);

    useEffect(() => {
        sendToCommerce?.({ type: 'SET_FEED_ACTIVE', active: feedActive });
    }, [feedActive, sendToCommerce]);

    // Close product detail - animate card down first, then collapse transition
    const closeProductDetail = useCallback(() => {
        const current = feedItemsRef.current?.[feedIndexRef.current];
        const cardData = lastCardTransitionRef.current;

        // Restore URL back to originating category (replaceState to avoid React Router re-render)
        window.history.replaceState(null, '', originPathRef.current);

        // Restore full header immediately so the grid renders with correct layout
        // (prevents layout shift at end of animation)
        setActiveTextColor('black');
        setIsProductDetail(false);
        setOnCloseProductDetail(null);

        // Card slide-down + grid becomes visible simultaneously
        setClosingDetail(true);

        if (cardData) {
            const bgColor = current?.backgroundColor || '#1a1a2e';
            const imgSrc = current?.image || cardData.imgSrc;
            const product = current?.product || current;
            const price = product?.variants?.[0]?.price
                ? `$${parseFloat(product.variants[0].price).toFixed(2)}`
                : product?.price ? `$${parseFloat(product.price).toFixed(2)}` : '';
            const currentFeedIndex = feedIndexRef.current;

            // Wait for grid to render, then restore scroll + measure card position
            requestAnimationFrame(() => {
                // Restore scroll position now that grid is mounted and page is tall enough
                window.scrollTo({ top: feedScrollPositionRef.current, behavior: 'instant' });

                requestAnimationFrame(() => {
                    let targetRect = cardData.rect;
                    let targetImgRect = cardData.imgRect;

                    // Find the card element in the now-visible grid
                    const cardWrapper = document.querySelector(`[data-feed-index="${currentFeedIndex}"]`);
                    if (cardWrapper) {
                        const cardEl = cardWrapper.querySelector('[data-card]');
                        if (cardEl) {
                            targetRect = cardEl.getBoundingClientRect();
                        }
                        const imgEl = cardWrapper.querySelector('[data-product-img]');
                        if (imgEl) {
                            targetImgRect = imgEl.getBoundingClientRect();
                        }
                    }

                    const closingIsCollectible = current?.isCollectible || product?.category?.toLowerCase() === 'merchandise' || product?.productType?.toLowerCase() === 'merchandise';
                    const closingImageCount = current?.catalogImages?.length || product?.images?.length || 0;
                    setCollapseTransition({
                        targetRect,
                        targetImgRect,
                        bgStyle: bgColor,
                        imgSrc,
                        imgAR: cardData.imgAR,
                        title: current?.title || product?.name || '',
                        price,
                        textColor: current?.textColor || getTextColorForBackground(current?.backgroundColor),
                        isCollectible: closingIsCollectible,
                        hasThumbnails: closingIsCollectible && closingImageCount > 1,
                    });
                });
            });
        }

        // After animations complete, unmount ProductDetailPage
        closeTimeoutRef.current = setTimeout(() => {
            setClosingDetail(false);
            setFeedActive(false);
            setCollapseTransition(null);
            lastCardTransitionRef.current = null;
            closeTimeoutRef.current = null;
        }, 700);
    }, [setActiveTextColor, setIsProductDetail, setOnCloseProductDetail, setCollapseTransition, setFeedActive]);

    // Handle selecting a reward at a threshold
    const handleSelectReward = (threshold, discountId) => {
        setSelectedRewards(prev => ({
            ...prev,
            [threshold]: discountId
        }));
    };
    
    const { freeGiftDiscounts, orderDiscounts, getApplicableDiscounts, getQuantityDiscountsByThreshold, isDiscountActive, loading: discountsLoading } = useDiscounts(localCart, selectedRewards, shopifyProducts);
    
    // Get quantity-based discounts grouped by threshold
    const quantityDiscountGroups = getQuantityDiscountsByThreshold ? getQuantityDiscountsByThreshold() : [];
    
    // Sync local cart count to layout context (for header badge)
    useEffect(() => {
        setCartCount(localCart.getCartCount());
    }, [localCart.cart, setCartCount]);

    // Clear selected rewards when cart becomes empty
    useEffect(() => {
        if (localCart.cart.length === 0) {
            setSelectedRewards({});
            sessionStorage.removeItem('selectedRewards');
        }
    }, [localCart.cart.length]);

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

    // Track product page visits so browser back from product never lands on root
    useEffect(() => {
        if (productId) {
            sessionStorage.setItem('sc-from-product', 'true');
        }
    }, [productId]);

    // If we just arrived at homepage from a product page (browser back/close), redirect to /desserts
    useEffect(() => {
        if (isHomepageLoad && sessionStorage.getItem('sc-from-product')) {
            sessionStorage.removeItem('sc-from-product');
            navigate('/desserts', { replace: true });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Close dessert product detail if user presses browser back button
    useEffect(() => {
        const handlePopState = () => {
            if (feedActive && !window.location.pathname.startsWith('/product/')) {
                setActiveTextColor('black');
                setIsProductDetail(false);
                setOnCloseProductDetail(null);
                setClosingDetail(false);
                setFeedActive(false);
                setCollapseTransition(null);
                lastCardTransitionRef.current = null;
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [feedActive]);

    // Blind box selector modal state
    const [showBlindBoxSelector, setShowBlindBoxSelector] = useState(false);

    // Catalog engine (shared state machine)
    const {
        catalog,
        subcategories: CATALOG_DESSERT_SUBCATEGORIES,
        collectiblesSubcategories: CATALOG_COLLECTIBLES_SUBCATEGORIES,
        shopifyGidLookup,
        mergedProductOrder: getMergedProductOrder,
        locationFilteredProducts,
        storeLocations,
        selectedLocation: selectedLocationForFilter,
        isReady: catalogReady,
    } = useCatalog();

    // Page configuration from API
    const [pageConfig, setPageConfig] = useState(null);

    // Events data for event carousel
    const [events, setEvents] = useState([]);

    // Fetch events for event carousel
    useEffect(() => {
        fetchEventsData()
            .then(data => {
                console.log('[Commerce] Loaded events:', data.events?.length);
                setEvents(data.events || []);
            })
            .catch(err => console.error('[Commerce] Failed to load events:', err));
    }, []);

    // Fetch page configuration for homepage
    useEffect(() => {
        getPageConfig('/').then(config => {
            if (config) {
                console.log('[Commerce] Loaded page config:', config.sections?.length, 'sections');
                setPageConfig(config);
            }
        });
    }, []);


    // Get section config from page config by type
    const getSectionConfig = useCallback((sectionType) => {
        if (!pageConfig?.sections) return null;
        const section = pageConfig.sections.find(s => s.type === sectionType);
        return section?.config || null;
    }, [pageConfig]);

    // Build CSS gradient from structured direction value
    const buildHeroGradientCSS = useCallback((dir, startColor, endColor) => {
        if (!dir) return null;
        const parts = dir.split(':');
        const type = parts[0];
        if (type === 'radial') {
            const position = (parts[1] || 'center').replace('-', ' ');
            return `radial-gradient(circle at ${position}, ${startColor} 0%, ${endColor} 100%)`;
        }
        if (type === 'linear') {
            const posToCoord = {
                'top-left': { x: 0, y: 0 }, 'top': { x: 1, y: 0 }, 'top-right': { x: 2, y: 0 },
                'left': { x: 0, y: 1 }, 'center': { x: 1, y: 1 }, 'right': { x: 2, y: 1 },
                'bottom-left': { x: 0, y: 2 }, 'bottom': { x: 1, y: 2 }, 'bottom-right': { x: 2, y: 2 },
            };
            const start = posToCoord[parts[1]] || posToCoord['top'];
            const end = posToCoord[parts[2]] || posToCoord['bottom'];
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const angle = Math.round(Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;
            return `linear-gradient(${angle}deg, ${startColor} 0%, ${endColor} 100%)`;
        }
        return null;
    }, []);

    // Get homepage section configs
    const heroConfig = useMemo(() => getSectionConfig('hero') || {
        title: 'Coming Soon',
        subtitle: 'New desserts & merchandise',
        backgroundColor: 'linear-gradient(180deg, #1a1a1a 0%, #2d1f3d 50%, #1a1a1a 100%)',
        textColor: 'white',
    }, [getSectionConfig]);

    // Resolve hero background: prefer structured gradient fields, fall back to raw backgroundColor
    const heroBackground = useMemo(() => {
        if (heroConfig.gradientDirection && heroConfig.gradientStartColor && heroConfig.gradientEndColor) {
            const css = buildHeroGradientCSS(heroConfig.gradientDirection, heroConfig.gradientStartColor, heroConfig.gradientEndColor);
            if (css) return css;
        }
        return heroConfig.backgroundColor || 'linear-gradient(180deg, #1a1a1a 0%, #2d1f3d 50%, #1a1a1a 100%)';
    }, [heroConfig, buildHeroGradientCSS]);

    // Page transition animation variants
    const pageTransitionVariants = useMemo(() => ({
        initial: { opacity: 0, scale: 0.97, y: 20 },
        animate: {
            opacity: 1, scale: 1, y: 0,
            transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.08 }
        },
        exit: {
            opacity: 0, scale: 1.03, y: -15,
            transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
        }
    }), []);

    const childFadeUp = useMemo(() => ({
        initial: { opacity: 0, y: 15 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }
    }), []);

    const ctaConfig = useMemo(() => getSectionConfig('cta-buttons') || {
        buttons: [
            { label: 'Desserts', link: '/desserts', style: 'filled' },
            { label: 'Collectibles', link: '/collectibles', style: 'outlined' },
        ],
    }, [getSectionConfig]);

    const productCarouselConfig = useMemo(() => getSectionConfig('product-carousel') || {
        title: 'Latest Drops',
        subtitle: 'Fresh flavors just landed',
        productSource: 'latest',
        productIds: [],
        maxProducts: 8,
        backgroundColor: '#f5f5f5',
    }, [getSectionConfig]);

    const eventCarouselConfig = useMemo(() => getSectionConfig('event-carousel') || {
        title: 'Upcoming Events',
        subtitle: 'Join us for exclusive experiences',
        eventSource: 'upcoming',
        eventIds: [],
        maxEvents: 3,
        backgroundColor: 'white',
    }, [getSectionConfig]);

    // Filter events by selected location
    const filteredEvents = useMemo(() => {
        const selectedLocationId = localStorage.getItem('selectedLocation');
        if (!selectedLocationId || storeLocations.length === 0) return events;
        const selectedStore = storeLocations.find(loc => loc.id === selectedLocationId);
        if (!selectedStore) return events;
        const filtered = events.filter(event =>
            event.locationNames?.some(name =>
                name.toLowerCase() === selectedStore.name.toLowerCase()
            )
        );
        // If no events match, show all events rather than an empty carousel
        return filtered.length > 0 ? filtered : events;
    }, [events, storeLocations]);

    // Determine what to show based on route
    const currentPath = location.pathname;
    const isHomepage = currentPath === '/';

    // Dynamic category detection from API
    // Extract category handle from path (e.g., "/desserts" -> "desserts")
    const pathCategory = currentPath.startsWith('/') ? currentPath.slice(1).split('/')[0] : '';
    const PATH_ALIASES = { collectibles: 'merchandise' };
    const resolvedPath = PATH_ALIASES[pathCategory] || pathCategory;
    const currentCategory = categories?.find(c => c.handle === resolvedPath || c.id === resolvedPath);

    // When product is dismissed (closed without route change), override category detection
    const [dismissedCategory, setDismissedCategory] = useState(null);
    const isCategoryPage = !!dismissedCategory || !!currentCategory;

    // Legacy aliases for backward compatibility
    const isDesserts = dismissedCategory === 'desserts' || (!dismissedCategory && currentCategory?.handle === 'desserts');
    const isMerchandise = dismissedCategory === 'merchandise' || (!dismissedCategory && currentCategory?.handle === 'merchandise');
    
    // Flag to skip scroll-to-top when returning from product modal
    const skipScrollToTop = useRef(false);
    
    // Determine the current view key for page transitions
    const viewKey = isHomepage ? 'homepage' : isDesserts ? 'desserts' : isMerchandise ? 'merchandise' : 'other';

    // Track the last category path so close-product always returns to the right place
    useEffect(() => {
        if (isCategoryPage && currentPath !== '/') {
            originPathRef.current = currentPath;
        }
    }, [currentPath, isCategoryPage]);

    // Scroll to top when navigating to category pages (delayed to allow exit animation)
    useEffect(() => {
        if (skipScrollToTop.current) {
            skipScrollToTop.current = false;
            return;
        }
        if (isCategoryPage || isHomepage) {
            const timer = setTimeout(() => window.scrollTo(0, 0), 300);
            return () => clearTimeout(timer);
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
    const [addedModifiers, setAddedModifiers] = useState(() => {
        try {
            const saved = sessionStorage.getItem('addedToCart');
            return saved ? JSON.parse(saved).modifiers || [] : [];
        } catch (e) {
            return [];
        }
    });
    
    // (Delivery check moved to /delivery-check page)

    // Refs for tracking navigation intent
    const prevPathRef = useRef(currentPath);
    const intentionalCrossSell = useRef(false); // Track intentional cross-sell navigation
    const returningFromAddToCart = useRef(false); // Track if returning from add-to-cart (don't clear AddedToCart)
    
    // Clear added-to-cart view when navigating to main category pages
    // This ensures clicking category pages shows the normal page, not cross-sell
    // The cross-sell should only show when triggered by specific banners (handleReturnToCrossSell)
    const navEffectFirstRender = useRef(true);
    useEffect(() => {
        const prevPath = prevPathRef.current;
        prevPathRef.current = currentPath;

        // Skip first render — component may have just mounted with showAddedToCart from sessionStorage
        if (navEffectFirstRender.current) {
            navEffectFirstRender.current = false;
            return;
        }

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
            // Reset feed mode when leaving desserts (e.g., navigating to homepage)
            if (feedActive && !isDesserts) {
                setFeedActive(false);
                setIsProductDetail(false);
                setOnCloseProductDetail(null);
                setClosingDetail(false);
                setCollapseTransition(null);
                lastCardTransitionRef.current = null;
            }
            if (showAddedToCart) {
                console.log('🧭 Route changed to category page - clearing cross-sell view');
                setShowAddedToCart(false);
                setAddedProduct(null);
                setAddedVariant(null);
                setAddedQuantity(1);
            setAddedModifiers([]);
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
                        setAddedModifiers(parsed.modifiers || []);
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
            setAddedModifiers([]);
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
                quantity: addedQuantity,
                modifiers: addedModifiers
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
    
    const returnPath = useRef(null); // Track where to return when closing modal (null = direct visit)
    const savedScrollPosition = useRef(0); // Track scroll position to restore when closing modal
    const selectedVariantInfo = useRef(null); // Track selected variant info for modal
    const preSelectedModifierRef = useRef(null); // Track pre-selected modifier from MYO teaser grid
    const returningFromProductModal = useRef(false); // Track if returning from modal (don't clear AddedToCart)
    const isFirstRender = useRef(true); // Track first render (don't clear AddedToCart on page load/refresh)

    // When product is dismissed, hide product detail but keep same Commerce instance
    const showProduct = productId && !dismissedCategory;

    // Show homepage content behind modal when opened FROM homepage (not on direct product URL visits)
    const showHomepageBehindModal = showProduct && returnPath.current === '/';
    
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
    
    // Clear stale modal state when navigating to product URLs (all products use full pages now)
    useEffect(() => {
        if (productId && showProductModal) {
            sendToCommerce({ type: 'CLOSE_PRODUCT' });
        }
    }, [productId, showProductModal, sendToCommerce]);

    // Handle closing product page — dismiss product and show category grid
    const handleCloseProduct = () => {
        if (productId) {
            skipScrollToTop.current = true;

            if (showAddedToCart) {
                returningFromProductModal.current = true;
                returningFromAddToCart.current = true;
            }

            const product = activeProductItem?.product;
            // Use feed item's isCollectible flag (product.category can be a UUID)
            const isMerch = activeProductItem?.isCollectible || false;
            const categoryPath = isMerch ? '/collectibles' : '/desserts';
            const dismissCategory = isMerch ? 'merchandise' : 'desserts';
            const isValidReturn = (path) => path && path !== '/' && !path.startsWith('/product/');
            const targetPath = (returnPath.current && isValidReturn(returnPath.current))
                ? returnPath.current
                : isValidReturn(originPathRef.current)
                    ? originPathRef.current
                    : categoryPath;

            // Build the expected post-dismiss feedItems to find the product's card index
            // (Current feedItems may be empty on /product/:id since no category is active yet)
            const expectedSubcats = isMerch ? merchandiseWithDefaults : DESSERT_SUBCATEGORIES;
            const expectedFeedItems = buildFeedItems(expectedSubcats);
            const productFeedIdx = expectedFeedItems.findIndex(f =>
                f.type === 'product' && (f.product?.id === productId || f.id === productId ||
                f.id?.startsWith(productId + '-'))
            );
            if (productFeedIdx >= 0) {
                setFeedIndex(productFeedIdx);
            }

            // Start close animation: keep ProductDetailPage visible (closing=true) while grid appears behind
            setClosingProduct(true);
            setDismissedCategory(dismissCategory);
            window.history.replaceState(window.history.state, '', targetPath);

            // Restore header immediately (like closeProductDetail does)
            setActiveTextColor('black');
            setIsProductDetail(false);
            setOnCloseProductDetail(null);
            // Tell header the effective category path (React Router still thinks we're on /product/:id)
            setEffectivePath(categoryPath);

            // After grid renders, measure card position and start collapse image animation
            if (activeProductItem && productFeedIdx >= 0) {
                const imgSrc = activeProductItem.image;
                const isCollectible = isMerch;
                const imageCount = activeProductItem.catalogImages?.length || product?.images?.length || 0;

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const cardWrapper = document.querySelector(`[data-feed-index="${productFeedIdx}"]`);
                        if (cardWrapper) {
                            const cardEl = cardWrapper.querySelector('[data-card]');
                            const imgEl = cardWrapper.querySelector('[data-product-img]');
                            const targetRect = cardEl ? cardEl.getBoundingClientRect() : cardWrapper.getBoundingClientRect();
                            const targetImgRect = imgEl ? imgEl.getBoundingClientRect() : targetRect;
                            const imgAR = (imgEl?.naturalWidth && imgEl?.naturalHeight)
                                ? imgEl.naturalWidth / imgEl.naturalHeight
                                : 1;

                            setCollapseTransition({
                                targetRect,
                                targetImgRect,
                                bgStyle: activeProductItem.backgroundColor || '#1a1a2e',
                                imgSrc,
                                imgAR,
                                title: activeProductItem.title || product?.name || '',
                                price: '',
                                textColor: activeProductItem.textColor || getTextColorForBackground(activeProductItem.backgroundColor),
                                isCollectible,
                                hasThumbnails: isCollectible && imageCount > 1,
                            });
                        }
                    });
                });
            }

            // After animations complete (700ms matches closeProductDetail), clean up
            setTimeout(() => {
                setClosingProduct(false);
                setCollapseTransition(null);
                returnPath.current = null;
                savedScrollPosition.current = 0;
                selectedVariantInfo.current = null;
                preSelectedModifierRef.current = null;
            }, 700);
        }
    };

    // Handle product selection
    const handleChooseProduct = (productId, preSelectedModifier = null) => {
        preSelectedModifierRef.current = preSelectedModifier;
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
        
        navigate(`/product/${lookupId}`, { replace: false });
    };
    
    // Handle add to cart
    const handleAddToCart = async (productOrId, variantOrId, quantity = 1, customAttributes = []) => {
        console.log('🛒 handleAddToCart called:', { productOrId, variantOrId, quantity, customAttributes });
        try {
            // Support both calling conventions:
            // 1) Catalog-first: (productObj, variantObj, quantity)
            // 2) Legacy: (productId, variantId, quantity, customAttributes)
            let product, variant;
            if (typeof productOrId === 'object' && productOrId !== null) {
                product = productOrId;
                variant = variantOrId;
            } else {
                product = shopifyProducts.find(p => p.id === productOrId);
                variant = product?.variants?.find(v => v.id === variantOrId) || product?.variants?.[0];
            }

            // Extract fulfillment method before filtering internal attributes
            const fulfillmentAttr = (customAttributes || []).find(a => a.key === '_fulfillment');
            const fulfillmentMethod = fulfillmentAttr?.value || null;

            // Add to local cart
            const modifiers = (customAttributes || [])
                .filter(a => !a.key?.startsWith('_'))
                .map(a => ({ key: a.key, value: a.value, price: 0 }));

            // If delivery: navigate to delivery check page
            if (fulfillmentMethod === 'delivery') {
                const selectedLocationSlug = localStorage.getItem('selectedLocation') || '';
                navigate('/delivery-check', {
                    state: { product, variant, quantity, modifiers, pickupLocation: selectedLocationSlug },
                });
                return { skipCartOpen: true };
            }

            localCart.addToCart(product, variant, quantity, modifiers, { fulfillmentMethod });
            console.log('✅ Added to local cart');

            // Close the modal via state machine and reset product detail mode
            sendToCommerce({ type: 'CLOSE_PRODUCT' });
            sendToCommerce({ type: 'SET_FEED_ACTIVE', active: false });
            setIsProductDetail(false);
            setOnCloseProductDetail(null);
            setFeedActive(false);

            // Set added to cart view state
            setAddedProduct(product);
            setAddedVariant(variant);
            setAddedQuantity(quantity);
            setAddedModifiers(modifiers);
            setShowAddedToCart(true);
            
            // Save to sessionStorage BEFORE navigate (useEffect won't run if component unmounts)
            sessionStorage.setItem('addedToCart', JSON.stringify({
                show: true,
                product,
                variant,
                quantity,
                modifiers
            }));

            // Mark that we're navigating programmatically (don't clear AddedToCart state)
            returningFromProductModal.current = true;
            returningFromAddToCart.current = true;

            // Navigate away from /product/xyz URL so browser back works correctly
            // Use returnPath, originPath, or product's category to determine where to go
            const origin = returnPath.current || originPathRef.current;
            if (origin && origin !== '/' && !origin.startsWith('/product/')) {
                navigate(origin, { replace: true });
            } else {
                const HANDLE_TO_PATH = { merchandise: 'collectibles' };
                const categoryPath = HANDLE_TO_PATH[product?.category] || product?.category;
                navigate(`/${categoryPath || 'desserts'}`, { replace: true });
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
        if (!localCart.cart.length) return 0;

        return localCart.cart.reduce((count, item) => {
            const matchedProduct = shopifyProducts.find(p =>
                p.id === item.productId ||
                p.shopifyId === item.productId ||
                p.variantId === item.variantId ||
                p.variants?.some(v => v.id === item.variantId)
            );

            if (matchedProduct?.merchandiseType === 'blind_box_collectible') {
                return count + item.quantity;
            }
            return count;
        }, 0);
    }, [localCart.cart, shopifyProducts]);

    // Calculate how many more blind boxes needed for discount (dynamic, no hardcoding)
    const blindBoxesNeededForDiscount = hasBlindBoxDiscount ? Math.max(0, BLIND_BOX_QUANTITY_THRESHOLD - blindBoxesInCart) : 0;

    // Get blind box items from cart with product details and discount info
    const blindBoxCartItems = useMemo(() => {
        if (!localCart.cart.length) return [];

        const items = [];
        localCart.cart.forEach(item => {
            const matchedProduct = shopifyProducts.find(p =>
                p.id === item.productId ||
                p.shopifyId === item.productId ||
                p.variantId === item.variantId ||
                p.variants?.some(v => v.id === item.variantId)
            );

            if (matchedProduct?.merchandiseType === 'blind_box_collectible') {
                const originalPrice = item.unitPrice;
                // Local cart doesn't have server-side discounts yet — shown at checkout
                for (let i = 0; i < item.quantity; i++) {
                    items.push({
                        id: `${item.id}-${i}`,
                        product: matchedProduct,
                        variant: matchedProduct?.variants?.find(v => v.id === item.variantId) || null,
                        title: item.name,
                        imageUrl: item.image || matchedProduct?.imageUrl || matchedProduct?.images?.[0]?.url,
                        originalPrice,
                        discountedPrice: originalPrice,
                        hasDiscount: false,
                        discountPercent: 0
                    });
                }
            }
        });

        return items;
    }, [localCart.cart, shopifyProducts]);
    
    // Check if the added product is a blind box
    const isBlindBoxAdded = addedProduct?.merchandiseType === 'blind_box_collectible';
    
    // Check if discount is unlocked (dynamic threshold from discounts file)
    const isDiscountUnlocked = hasBlindBoxDiscount && blindBoxesInCart >= BLIND_BOX_QUANTITY_THRESHOLD;
    
    // Calculate progress toward rewards
    const cartTotal = localCart.getSubtotal();
    
    // Get dynamic free gift discounts
    const applicableDiscounts = getApplicableDiscounts();
    const activeFreeGift = applicableDiscounts.find(d => d.trigger?.type === 'minCartTotal');
    
    // Find active order discount (e.g., "10% off orders over $20")
    const activeOrderDiscount = orderDiscounts?.find(d => d.isActive && d.threshold <= (activeFreeGift?.trigger?.amount || 20));

    const giftProgress = useMemo(() => {
        const threshold = activeFreeGift?.trigger?.amount || activeOrderDiscount?.threshold || 50;
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
            setAddedModifiers([]);
            sessionStorage.removeItem('addedToCart');
        }
    }, [showAddedToCart, isBlindBoxAdded, blindBoxesInCart]);

    // Clear AddedToCart view when cart becomes empty
    useEffect(() => {
        if (showAddedToCart && localCart.cart.length === 0) {
            setShowAddedToCart(false);
            setAddedProduct(null);
            setAddedVariant(null);
            setAddedQuantity(1);
            setAddedModifiers([]);
            sessionStorage.removeItem('addedToCart');
        }
    }, [showAddedToCart, localCart.cart.length]);

    // Handle adding a blind box from the selector modal
    const handleAddBlindBoxFromSelector = async (product) => {
        try {
            const variant = product.variants?.[0] || { id: product.variantId, price: product.price };
            if (!variant?.id && !product.variantId) {
                console.error('No variant ID found for blind box');
                return;
            }

            localCart.addToCart(product, variant || { id: product.variantId }, 1, []);
            setShowBlindBoxSelector(false);
            
            // Update the added product to show the new one
            setAddedProduct(product);
            setAddedVariant(product.variants?.[0] || null);
            setAddedQuantity(1);
            setAddedModifiers([]);
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
            setAddedModifiers([]);
            
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
            navigate('/desserts');
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

        // Fallback: Other products from the same root category (desserts or collectibles)
        const addedCategory = addedProduct.category;
        const isCollectible = addedCategory === 'merchandise' || addedCategory === 'collectibles';
        const rootCategories = isCollectible ? ['merchandise', 'collectibles'] : ['desserts'];
        const fallback = shopifyProducts.filter(p =>
            rootCategories.includes(p.category) &&
            p.id !== addedProduct.id
        );
        console.log('📦 Using root category products:', fallback.length);
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
                // Build catalog-first variants
                const productName = (product.name || product.title || '').toLowerCase();
                const catalogProduct = catalog?.products?.find(cp => cp.name?.toLowerCase() === productName);

                const _locSlug = localStorage.getItem('selectedLocation');
                const catalogFirstVariants = (catalogProduct?.variants || []).map(cv => {
                    const skuUpper = cv.sku?.toUpperCase();
                    const gidFallback = skuUpper ? shopifyGidLookup[skuUpper] : null;
                    const _locPrice = _locSlug && cv.locationPrices?.[_locSlug];
                    return {
                        sku: cv.sku,
                        name: cv.name,
                        price: cv.price,
                        compareAtPrice: cv.compareAtPrice,
                        locationPrices: cv.locationPrices || null,
                        shopifyVariantGid: cv.platformIds?.shopify || gidFallback?.variantGid || null,
                        id: cv.platformIds?.shopify || gidFallback?.variantGid || cv.sku,
                        availableForSale: cv.inventory?.inStock !== false,
                        inventory: cv.inventory || {},
                        // Keep Shopify variant metafields for grouping
                        ...(product.variants.find(sv => sv.sku?.toUpperCase() === cv.sku?.toUpperCase()) || {}),
                        // Override price/name with catalog values; use location price if available
                        catalogName: cv.name,
                        ...(_locPrice != null ? { price: _locPrice } : { price: cv.price }),
                    };
                });

                // Fall back to original Shopify variants if no catalog match
                const enrichedVars = catalogFirstVariants.length > 0 ? catalogFirstVariants : product.variants;

                // Group variants by subcategory first, then by container
                const variantsBySubcatContainer = {};

                enrichedVars.forEach(variant => {
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

                    const { variants: _allVariants, ...productWithoutVariants } = product;
                    const catalogImageUrl = catalogProduct?.masterImage?.url || null;

                    if (variants.length === 1) {
                        const variant = variants[0];
                        const sizeTitle = variant.name || variant.sizeData?.title || variant.size || '';
                        const containerTitle = containerData?.title || container;

                        const variantImage = variant.catalogImage?.url
                            || (variant.hasVariantImage === true && variant.image?.url ? variant.image.url : null)
                            || catalogImageUrl || PLACEHOLDER_IMAGE;

                        exploded.push({
                            ...productWithoutVariants,
                            id: `${product.id}-${subcategory}-${container}`,
                            variantId: variant.id,
                            name: catalogProduct?.name || product.name,
                            price: (() => { const _s = localStorage.getItem('selectedLocation'); const _lp = _s && variant.locationPrices?.[_s]; return `$${parseFloat(_lp != null ? _lp : variant.price).toFixed(2)}`; })(),
                            originalProductId: product.id,
                            variantTitle: variant.name || variant.title,
                            subcategory: subcategory,
                            subcategoryData: subcategoryData,
                            container: container,
                            containerData: containerData,
                            imageUrl: variantImage,
                            imageAlt: product.name,
                            variantOptions: containerTitle,
                            sizeOptions: sizeTitle ? [sizeTitle] : null,
                            variants: null,
                            availableVariants: [variant]
                        });
                    } else {
                        const prices = variants.map(v => parseFloat(v.price)).sort((a, b) => a - b);
                        const minPrice = prices[0];
                        const maxPrice = prices[prices.length - 1];
                        const priceDisplay = minPrice === maxPrice
                            ? `$${minPrice.toFixed(2)}`
                            : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;

                        const sizeNames = variants.map(v => v.name || v.catalogName || v.sizeData?.title || v.size || v.title);
                        const sizeDescription = sizeNames.join(' | ');
                        const containerTitle = containerData?.title || container;

                        let imageUrl = catalogImageUrl || PLACEHOLDER_IMAGE;

                        exploded.push({
                            ...productWithoutVariants,
                            id: `${product.id}-${subcategory}-${container}`,
                            variantId: variants[0].id,
                            variants: variants,
                            name: catalogProduct?.name || product.name,
                            price: priceDisplay,
                            originalProductId: product.id,
                            variantTitle: null,
                            subcategory: subcategory,
                            subcategoryData: subcategoryData,
                            container: container,
                            containerData: containerData,
                            imageUrl: imageUrl,
                            imageAlt: product.name,
                            variantOptions: containerTitle,
                            sizeOptions: sizeDescription,
                            availableVariants: variants
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

    // ═══════════════════════════════════════════════════════════════════════════
    // NEW: Hierarchy-based product grouping (replaces variant metafield approach)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Explode products into cards using CATEGORY HIERARCHY instead of variant metafields
     * - Product's category (at leaf level) determines subcategory/container
     * - Size remains as variant options within each product
     */
    const explodeProductVariantsByHierarchy = (products) => {
        const exploded = [];
        console.log('🌳 explodeProductVariantsByHierarchy called with', products.length, 'products');

        products.forEach(product => {
            // Get hierarchy info from product's assigned category
            const hierarchy = getProductHierarchy(product);

            // Extract subcategory (Level 2) and container (Level 3) from hierarchy
            const subcategoryData = hierarchy?.subcategory || null;
            const containerData = hierarchy?.container || null;
            const subcategory = subcategoryData?.handle || 'other';
            const container = containerData?.handle || 'default';

            // Debug: Log hierarchy mapping for first few products
            if (exploded.length < 3) {
                console.log(`🌳 Product "${product.name}" → category: ${product.category}, subcategory: ${subcategory}, container: ${container}`);
            }

            // Look up catalog product + PWA variants for responsive images
            const productName = (product.name || product.title || '').toLowerCase();
            const catalogProduct = catalog?.products?.find(cp => cp.name?.toLowerCase() === productName);
            const catalogPwa = catalogProduct?.masterImage?.pwa || null;
            const catalogImageUrl = catalogProduct?.masterImage?.url || null;

            // Build catalog-first variants with Shopify GIDs attached
            const catalogFirstVariants = (catalogProduct?.variants || []).map(cv => {
                const skuUpper = cv.sku?.toUpperCase();
                const gidFallback = skuUpper ? shopifyGidLookup[skuUpper] : null;
                return {
                    sku: cv.sku,
                    name: cv.name,
                    price: cv.price,
                    compareAtPrice: cv.compareAtPrice,
                    optionValues: cv.optionValues,
                    isDefault: cv.isDefault,
                    catalogImage: cv.catalogImage,
                    shopifyVariantGid: cv.platformIds?.shopify || gidFallback?.variantGid || null,
                    id: cv.platformIds?.shopify || gidFallback?.variantGid || cv.sku,
                    availableForSale: cv.inventory?.inStock !== false,
                    inventory: cv.inventory || {},
                };
            });

            // Fall back to Shopify-enriched variants if no catalog product found
            const productVariants = catalogFirstVariants.length > 0
                ? catalogFirstVariants
                : (product.variants || []);

            const hasMultipleSizes = productVariants.length > 1;

            if (hasMultipleSizes) {
                // Multiple size variants - show as one card with size selector
                const prices = productVariants.map(v => parseFloat(v.price)).sort((a, b) => a - b);
                const minPrice = prices[0];
                const maxPrice = prices[prices.length - 1];
                const priceDisplay = minPrice === maxPrice
                    ? `$${minPrice.toFixed(2)}`
                    : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;

                const sizeNames = productVariants.map(v => v.name || v.catalogName || v.sizeData?.title || v.size || v.title);
                const sizeDescription = sizeNames.join(' | ');

                let imageUrl = catalogImageUrl || product.imageUrl || PLACEHOLDER_IMAGE;
                let imageAlt = product.name;

                exploded.push({
                    ...product,
                    id: `${product.id}-${subcategory}-${container}`,
                    variantId: productVariants[0].id,
                    variants: productVariants,
                    name: catalogProduct?.name || product.name,
                    price: priceDisplay,
                    originalProductId: product.id,
                    shopifyId: catalogProduct?.platformIds?.shopify || shopifyGidLookup[productVariants[0]?.sku?.toUpperCase()]?.productGid || null,
                    subcategory: subcategory,
                    subcategoryData: subcategoryData,
                    container: container,
                    containerData: containerData,
                    imageUrl: imageUrl,
                    imageAlt: imageAlt,
                    pwa: catalogPwa,
                    variantOptions: containerData?.title || null,
                    sizeOptions: sizeDescription,
                    availableVariants: productVariants
                });
            } else {
                // Single variant or no size variants - show as single card
                const variant = productVariants[0] || {};
                const sizeTitle = variant.name || variant.sizeData?.title || variant.size || '';

                const variantImage = variant.catalogImage?.url || catalogImageUrl || product.imageUrl || PLACEHOLDER_IMAGE;

                exploded.push({
                    ...product,
                    id: `${product.id}-${subcategory}-${container}`,
                    variantId: variant.id || product.id,
                    name: catalogProduct?.name || product.name,
                    price: (() => { const _s = localStorage.getItem('selectedLocation'); const _lp = _s && variant.locationPrices?.[_s]; const _p = _lp != null ? _lp : variant.price; return _p ? `$${parseFloat(_p).toFixed(2)}` : product.price; })(),
                    originalProductId: product.id,
                    shopifyId: catalogProduct?.platformIds?.shopify || shopifyGidLookup[variant.sku?.toUpperCase()]?.productGid || null,
                    subcategory: subcategory,
                    subcategoryData: subcategoryData,
                    container: container,
                    containerData: containerData,
                    imageUrl: variantImage,
                    imageAlt: product.name,
                    pwa: variant.catalogImage?.url ? null : catalogPwa,
                    variantOptions: containerData?.title || null,
                    sizeOptions: sizeTitle ? [sizeTitle] : null,
                    variants: null,
                    availableVariants: productVariants.length ? [variant] : null
                });
            }
        });

        // Debug: Show exploded products with hierarchy info
        console.log(`🌳 EXPLODED ${exploded.length} products`);
        if (exploded.length > 0) {
            const first = exploded[0];
            console.log('🌳 First product:', first?.name);
            console.log('🌳 First product ASSIGNED category:', first?.category, first?.categoryData);
            console.log('🌳 First product hierarchy result - subcategory:', first?.subcategory, '| container:', first?.container);
        }

        return exploded;
    };

    /**
     * Build Shopify product GID → catalog category mappings.
     * Catalog is the source of truth for product-to-category assignments.
     * Works entirely from catalog data (no Shopify category mapping needed).
     */
    const { catalogProductLookup, catalogCategoryById, catalogProductOrder } = useMemo(() => {
        const productLookup = new Map();  // Shopify GID → catalog product
        const categoryById = new Map();   // catalog category ID → catalog category
        const orderMap = new Map();       // Shopify GID → order index

        if (!catalog?.categories?.length || !catalog?.products?.length) {
            return { catalogProductLookup: productLookup, catalogCategoryById: categoryById, catalogProductOrder: orderMap };
        }

        // Index catalog categories by ID
        catalog.categories.forEach(cat => categoryById.set(cat.id, cat));

        // Index catalog products by Shopify GID
        catalog.products.forEach(prod => {
            const shopifyGid = prod.platformIds?.shopify;
            if (shopifyGid) productLookup.set(shopifyGid, prod);
        });

        // Build productOrder index: catalog SKU → order index per category
        const skuOrderIndex = new Map();
        catalog.categories.forEach(cat => {
            if (cat.productOrder?.length) {
                cat.productOrder.forEach((sku, idx) => {
                    skuOrderIndex.set(sku.toUpperCase(), idx);
                });
            }
        });

        // Map Shopify GID → order index using catalog product SKU
        catalog.products.forEach(prod => {
            const shopifyGid = prod.platformIds?.shopify;
            if (!shopifyGid) return;
            const orderIdx = skuOrderIndex.get((prod.sku || '').toUpperCase());
            if (orderIdx != null) orderMap.set(shopifyGid, orderIdx);
        });

        console.log('📦 Built catalog lookups:', productLookup.size, 'products,', categoryById.size, 'categories');
        return { catalogProductLookup: productLookup, catalogCategoryById: categoryById, catalogProductOrder: orderMap };
    }, [catalog]);

    /**
     * Get catalog root category ID for a Shopify product.
     * Traces the product's catalog categoryIds up to the root via parentId.
     */
    const getCatalogRootId = useCallback((shopifyProduct) => {
        const catalogProd = catalogProductLookup.get(shopifyProduct.shopifyId);
        if (!catalogProd?.categoryIds?.length) return null;

        // Trace first categoryId up to root
        let current = catalogCategoryById.get(catalogProd.categoryIds[0]);
        while (current?.parentId) {
            const parent = catalogCategoryById.get(current.parentId);
            if (parent) current = parent;
            else break;
        }
        return current?.id || null;
    }, [catalogProductLookup, catalogCategoryById]);

    /**
     * Check if a Shopify product belongs to a catalog category (or any descendant of it).
     */
    const productBelongsToCatalogCategory = useCallback((shopifyProduct, catalogCategoryId) => {
        const catalogProd = catalogProductLookup.get(shopifyProduct.shopifyId);
        if (!catalogProd?.categoryIds?.length) return false;

        // Check if any of the product's categoryIds is the target or a descendant of it
        return catalogProd.categoryIds.some(catId => {
            let current = catalogCategoryById.get(catId);
            while (current) {
                if (current.id === catalogCategoryId) return true;
                current = current.parentId ? catalogCategoryById.get(current.parentId) : null;
            }
            return false;
        });
    }, [catalogProductLookup, catalogCategoryById]);

    /**
     * Map Shopify root category handle → catalog root category ID.
     * Matches by name (case-insensitive) with known aliases.
     */
    const shopifyHandleToCatalogRootId = useMemo(() => {
        const map = new Map();
        if (!catalog?.categories?.length) return map;

        // Name aliases: Shopify handle → catalog name
        const HANDLE_TO_NAME = {
            merchandise: 'collectibles',
            desserts: 'desserts',
            beverages: 'beverages',
        };

        const rootCats = catalog.categories.filter(c => !c.parentId);
        for (const [handle, targetName] of Object.entries(HANDLE_TO_NAME)) {
            const root = rootCats.find(c => c.name.toLowerCase() === targetName);
            if (root) map.set(handle, root.id);
        }

        console.log('📦 Shopify handle → catalog root:', Object.fromEntries(map));
        return map;
    }, [catalog]);

    /**
     * Build subcategory definitions from CATEGORY HIERARCHY
     * Uses Level 2 categories under a root category
     * Extracts unique container sizes from product variants
     */
    const buildSubcategoriesFromHierarchy = (rootCategoryHandle) => {
        const subcats = getSubcategories(rootCategoryHandle);
        const catalogRootId = shopifyHandleToCatalogRootId.get(rootCategoryHandle);
        console.log('🔍 Subcategories for', rootCategoryHandle, ':', subcats.map(s => s.handle), '| catalogRootId:', catalogRootId);

        return subcats.map(subcat => {
            // Find catalog category matching this Shopify subcategory (by name + correct root)
            // Must match by both name AND root to disambiguate (e.g., two "tokidoki" categories)
            const catalogSubcat = catalogRootId && catalog?.categories?.find(c =>
                c.name?.toLowerCase() === subcat.title?.toLowerCase() &&
                c.parentId === catalogRootId
            );
            const catalogSubcatId = catalogSubcat?.id;

            // Filter products for this subcategory using catalog categoryIds (source of truth)
            const subcatProducts = shopifyProducts.filter(p => {
                // Primary: check if product belongs to this catalog subcategory
                if (catalogSubcatId && p.shopifyId && catalogProductLookup.size > 0) {
                    return productBelongsToCatalogCategory(p, catalogSubcatId);
                }
                // Fallback for products not in catalog
                const hierarchy = getProductHierarchy(p);
                return hierarchy?.subcategory?.handle === subcat.handle;
            });

            // Build list of individual products with their catalog images
            const productItems = subcatProducts.map(product => {
                const productName = product.name?.toLowerCase();
                // Get first variant SKU for catalog lookup
                const firstVariant = product.variants?.[0];
                const variantSku = firstVariant?.sku?.toUpperCase();

                // Look up product image from catalog
                let catalogProduct = catalog?.products?.find(p => {
                    if (variantSku && p.sku?.toUpperCase() === variantSku) return true;
                    if (variantSku && p.variants?.some(v => v.sku?.toUpperCase() === variantSku)) return true;
                    return false;
                });
                // Fallback: match by product name if SKU lookup failed
                if (!catalogProduct && productName) {
                    catalogProduct = catalog?.products?.find(p =>
                        p.name?.toLowerCase() === productName
                    );
                }
                // Get the master image from catalog (includes backgroundColor and textColor)
                const catalogMasterImage = catalogProduct?.masterImage;
                const masterImage = catalogProduct?.images?.find(img => img.url?.includes('/master/'));
                const firstImage = catalogProduct?.images?.[0];
                const s3Image = catalogMasterImage?.url || masterImage?.url || firstImage?.url || null;
                // Get colors and gradient direction from masterImage (set in admin)
                const backgroundColor = catalogMasterImage?.backgroundColor || masterImage?.backgroundColor || firstImage?.backgroundColor || null;
                const textColor = catalogMasterImage?.textColor || masterImage?.textColor || firstImage?.textColor || null;
                const gradientDirection = catalogMasterImage?.gradientDirection || masterImage?.gradientDirection || firstImage?.gradientDirection || null;
                const gradientStartColor = catalogMasterImage?.gradientStartColor || masterImage?.gradientStartColor || firstImage?.gradientStartColor || null;
                const gradientEndColor = catalogMasterImage?.gradientEndColor || masterImage?.gradientEndColor || firstImage?.gradientEndColor || null;
                console.log('🖼️ Product lookup:', product.name, '| sku:', variantSku, '-> catalog:', catalogProduct?.name, '-> image:', s3Image?.slice(-50), '-> bgColor:', backgroundColor, '-> gradient:', gradientDirection);

                return {
                    id: product.id,
                    title: product.name,
                    product: product,
                    image: s3Image,
                    pwa: catalogMasterImage?.pwa || null,
                    backgroundColor,
                    textColor,
                    gradientDirection,
                    gradientStartColor,
                    gradientEndColor,
                    catalogImageStyles: catalogProduct?.images || [],
                    isMYO: (product.name || '').toLowerCase().includes('make your own'),
                };
            });
            console.log('🔍 Products for', subcat.handle, ':', productItems.map(p => p.title));

            return {
                id: subcat.handle,
                title: subcat.title,
                description: subcat.description || '',
                image: subcat.image?.url || `https://placehold.co/300x300/e0e0e0/666666?text=${encodeURIComponent(subcat.title)}`,
                imageAspectRatio: subcat.imageAspectRatio || '1:1',
                containers: productItems, // Individual products with catalog images
                products: subcatProducts, // Products in this subcategory
                productOrder: subcat.productOrder || [], // Per-subcategory ordering from catalog
                catalogCategoryId: catalogSubcatId, // Catalog category ID for this subcategory
                // Filter products using catalog as source of truth
                filter: (p) => {
                    if (catalogSubcatId && p.shopifyId && catalogProductLookup.size > 0) {
                        return productBelongsToCatalogCategory(p, catalogSubcatId);
                    }
                    const hierarchy = getProductHierarchy(p);
                    return hierarchy?.subcategory?.handle === subcat.handle;
                }
            };
        });
    };

    // Helper to convert aspect ratio string to paddingTop percentage
    const getAspectRatioPadding = (aspectRatio) => {
        switch (aspectRatio) {
            case '16:9': return '56.25%';
            case '4:3': return '75%';
            case '1:1':
            default: return '100%';
        }
    };

    // Use hierarchy-based subcategories for Desserts (Level 2 under 'desserts')
    // Must recalculate when catalog loads to get S3 master images
    const HIERARCHY_DESSERT_SUBCATEGORIES = useMemo(() => {
        return buildSubcategoriesFromHierarchy('desserts');
    }, [catalog, shopifyProducts, categories, catalogProductLookup, shopifyHandleToCatalogRootId]);

    // Use hierarchy-based subcategories for Merchandise (Level 2 under 'merchandise')
    const HIERARCHY_MERCHANDISE_SUBCATEGORIES = useMemo(() => {
        return buildSubcategoriesFromHierarchy('merchandise');
    }, [catalog, shopifyProducts, categories, catalogProductLookup, shopifyHandleToCatalogRootId]);

    // Toggle to use hierarchy-based grouping
    // Set to FALSE to use variant metafield-based grouping (dessert.subcategory on each variant)
    // This allows a single product (e.g., "Amour S'more") to appear in multiple categories
    // NOTE: Variant-based requires dessert_subcategory metaobjects in Shopify
    const USE_HIERARCHY_GROUPING = categories.some(c => c.level > 1);

    // Debug: Log grouping mode
    if (USE_HIERARCHY_GROUPING) {
        console.log('🌳 Using HIERARCHY-based grouping');
    } else {
        console.log('📦 Using VARIANT METAFIELD-based grouping');
        console.log('📦 dessertSubcategories from Shopify:', dessertSubcategories?.map(s => s.id) || 'empty');
        console.log('📦 shopifyProducts count:', shopifyProducts?.length || 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // END: Hierarchy-based grouping
    // ═══════════════════════════════════════════════════════════════════════════


    /**
     * Build subcategories from VARIANT METAFIELDS
     * Groups products by their variant's dessert.subcategory metafield
     */
    const buildSubcategoriesFromVariants = () => {
        if (!dessertSubcategories?.length) return [];

        return dessertSubcategories.map(subcat => {
            // Find all products that have variants with this subcategory
            const matchingProducts = [];

            shopifyProducts.forEach(product => {
                // Check if any variant has this subcategory
                const matchingVariants = product.variants?.filter(v =>
                    v.subcategory?.toLowerCase() === subcat.id?.toLowerCase()
                ) || [];

                if (matchingVariants.length > 0) {
                    // Look up product image from catalog
                    const productName = product.name?.toLowerCase();
                    const firstVariant = matchingVariants[0];
                    const variantSku = firstVariant?.sku?.toUpperCase();

                    let catalogProduct = catalog?.products?.find(p => {
                        if (variantSku && p.sku?.toUpperCase() === variantSku) return true;
                        if (variantSku && p.variants?.some(v => v.sku?.toUpperCase() === variantSku)) return true;
                        return false;
                    });
                    if (!catalogProduct && productName) {
                        catalogProduct = catalog?.products?.find(p =>
                            p.name?.toLowerCase() === productName
                        );
                    }

                    const catalogMasterImage = catalogProduct?.masterImage;
                    const masterImage = catalogProduct?.images?.find(img => img.url?.includes('/master/'));
                    const firstImage = catalogProduct?.images?.[0];
                    const s3Image = catalogMasterImage?.url || masterImage?.url || firstImage?.url || null;
                    const backgroundColor = catalogMasterImage?.backgroundColor || masterImage?.backgroundColor || firstImage?.backgroundColor || null;
                    const textColor = catalogMasterImage?.textColor || masterImage?.textColor || firstImage?.textColor || null;
                    const gradientDirection = catalogMasterImage?.gradientDirection || masterImage?.gradientDirection || firstImage?.gradientDirection || null;
                    const gradientStartColor = catalogMasterImage?.gradientStartColor || masterImage?.gradientStartColor || firstImage?.gradientStartColor || null;
                    const gradientEndColor = catalogMasterImage?.gradientEndColor || masterImage?.gradientEndColor || firstImage?.gradientEndColor || null;

                    matchingProducts.push({
                        id: `${product.id}-${subcat.id}`,
                        title: product.name,
                        product: product,
                        image: s3Image,
                        pwa: catalogMasterImage?.pwa || null,
                        backgroundColor,
                        textColor,
                        gradientDirection,
                        gradientStartColor,
                        gradientEndColor,
                        variantId: firstVariant?.id,
                        variants: matchingVariants,
                        isMYO: (product.name || '').toLowerCase().includes('make your own'),
                    });
                }
            });

            console.log('🔍 Variant-based products for', subcat.id, ':', matchingProducts.map(p => p.title));

            return {
                id: subcat.id,
                title: subcat.title,
                description: subcat.description || '',
                image: subcat.image?.url || `https://placehold.co/300x300/e0e0e0/666666?text=${encodeURIComponent(subcat.title)}`,
                containers: matchingProducts,
                products: matchingProducts.map(p => p.product),
                filter: (p) => p.subcategory?.toLowerCase() === subcat.id?.toLowerCase()
            };
        }).filter(subcat => subcat.containers.length > 0); // Only include subcategories with products
    };

    // Build variant-based subcategories (memoized)
    const VARIANT_DESSERT_SUBCATEGORIES = useMemo(() => {
        return buildSubcategoriesFromVariants();
    }, [dessertSubcategories, shopifyProducts, catalog]);

    // Subcategory definitions for Desserts
    // Priority: 1) Catalog categories (admin), 2) Hierarchy, 3) Variant metafields
    const DESSERT_SUBCATEGORIES = CATALOG_DESSERT_SUBCATEGORIES.length > 0
        ? CATALOG_DESSERT_SUBCATEGORIES
        : USE_HIERARCHY_GROUPING
            ? HIERARCHY_DESSERT_SUBCATEGORIES
            : VARIANT_DESSERT_SUBCATEGORIES;

    console.log('📦 Using subcategories source:',
        CATALOG_DESSERT_SUBCATEGORIES.length > 0 ? 'CATALOG' :
        USE_HIERARCHY_GROUPING ? 'HIERARCHY' : 'VARIANT_METAFIELDS',
        '| Categories:', DESSERT_SUBCATEGORIES.map(s => s.title)
    );

    // Subcategory definitions for Merchandise/Collectibles
    // Priority: 1) Catalog categories (same approach as desserts), 2) Hierarchy fallback, 3) Shopify metaobjects
    const MERCHANDISE_SUBCATEGORIES = (CATALOG_COLLECTIBLES_SUBCATEGORIES || []).length > 0
        ? CATALOG_COLLECTIBLES_SUBCATEGORIES
        : HIERARCHY_MERCHANDISE_SUBCATEGORIES.length > 0
            ? HIERARCHY_MERCHANDISE_SUBCATEGORIES
            : merchandiseSubcategories?.length > 0
                ? merchandiseSubcategories.map(subcat => ({
                    id: subcat.id,
                    title: subcat.title,
                    description: subcat.description || '',
                    image: subcat.image?.url || `https://placehold.co/300x300/e0e0e0/666666?text=${encodeURIComponent(subcat.title)}`,
                    filter: (p) => p.merchandiseSubcategory === subcat.id
                }))
                : [];

    console.log('📦 Using collectibles source:',
        (CATALOG_COLLECTIBLES_SUBCATEGORIES || []).length > 0 ? 'CATALOG' :
        HIERARCHY_MERCHANDISE_SUBCATEGORIES.length > 0 ? 'HIERARCHY' : 'METAOBJECTS',
        '| Categories:', MERCHANDISE_SUBCATEGORIES.map(s => s.title)
    );

    // Helper: build flat feed from subcategories
    const buildFeedItems = (subcategories) => {
        const items = [];
        subcategories.forEach((subcat, subcatIndex) => {
            items.push({
                type: 'divider',
                id: `divider-${subcat.id}`,
                categoryId: subcat.id,
                categoryIndex: subcatIndex,
                title: subcat.title,
                image: subcat.image,
            });
            (subcat.containers || []).forEach(container => {
                items.push({
                    type: 'product',
                    id: container.id,
                    categoryId: subcat.id,
                    categoryIndex: subcatIndex,
                    ...container,
                });
            });
        });
        return items;
    };

    // Active subcategories for card grid (desserts or merchandise)
    // MERCHANDISE_SUBCATEGORIES from hierarchy already includes containers
    // Merchandise defaults: white background, black text (instead of dark blue)
    const merchandiseWithDefaults = MERCHANDISE_SUBCATEGORIES.map(subcat => ({
        ...subcat,
        containers: (subcat.containers || []).map(c => ({
            ...c,
            isCollectible: true,
            backgroundColor: c.backgroundColor || '#ffffff',
            textColor: c.textColor || '#000000',
        })),
    }));
    const baseFeedSubcategories = isDesserts ? DESSERT_SUBCATEGORIES
        : isMerchandise ? merchandiseWithDefaults
        : [];

    // Prepend "You Might Also Like" category when showing added-to-cart
    const activeFeedSubcategories = useMemo(() => {
        if (!showAddedToCart || !addedProduct) return baseFeedSubcategories;
        const recs = getAddedToCartRecommendations();
        if (recs.length === 0) return baseFeedSubcategories;
        const recsSubcat = {
            id: 'you-might-also-like',
            title: 'You Might Also Like',
            description: '',
            image: null,
            containers: recs.map(p => {
                const productName = p.name?.toLowerCase();
                const firstVariant = p.variants?.[0];
                const variantSku = firstVariant?.sku?.toUpperCase();
                let catalogProduct = catalog?.products?.find(cp => {
                    if (variantSku && cp.sku?.toUpperCase() === variantSku) return true;
                    if (variantSku && cp.variants?.some(v => v.sku?.toUpperCase() === variantSku)) return true;
                    return false;
                });
                if (!catalogProduct && productName) {
                    catalogProduct = catalog?.products?.find(cp => cp.name?.toLowerCase() === productName);
                }
                const masterImg = catalogProduct?.masterImage;
                const firstImg = catalogProduct?.images?.[0];
                const isCollectible = p.category === 'merchandise' || p.category === 'collectibles';
                return {
                    id: p.id,
                    title: p.name,
                    product: p,
                    image: masterImg?.url || firstImg?.url || null,
                    pwa: masterImg?.pwa || null,
                    backgroundColor: isCollectible ? (masterImg?.backgroundColor || '#ffffff') : (masterImg?.backgroundColor || null),
                    textColor: isCollectible ? (masterImg?.textColor || '#000000') : (masterImg?.textColor || null),
                    gradientDirection: masterImg?.gradientDirection || null,
                    gradientStartColor: masterImg?.gradientStartColor || null,
                    gradientEndColor: masterImg?.gradientEndColor || null,
                    catalogImageStyles: catalogProduct?.images || [],
                    isCollectible,
                    isMYO: (p.name || '').toLowerCase().includes('make your own'),
                };
            }),
        };
        return [recsSubcat, ...baseFeedSubcategories];
    }, [baseFeedSubcategories, showAddedToCart, addedProduct, catalog]);

    // Flatten subcategories into a single feed: divider slides + product slides
    const feedItems = buildFeedItems(activeFeedSubcategories);
    feedItemsRef.current = feedItems;

    // All products from all categories — used to find products by URL on /product/:id
    const allFeedItems = useMemo(() => {
        const allSubcats = [...DESSERT_SUBCATEGORIES, ...merchandiseWithDefaults];
        return buildFeedItems(allSubcats).filter(f => f.type === 'product');
    }, [DESSERT_SUBCATEGORIES, merchandiseWithDefaults]);

    // Build the product item for the full-page ProductDetailPage (any /product/:id URL)
    // Always wait for catalog — it's the source of truth for backgrounds, inventory, fulfillment methods
    const activeProductItem = useMemo(() => {
        if (!productId) return null;
        if (!catalogReady || !allFeedItems.length) return null;

        let match = allFeedItems.find(
            f => f.product?.id === productId || f.id === productId || f.id?.startsWith(productId + '-')
        );
        if (!match) {
            const shopifyMatch = shopifyProducts.find(p => p.id === productId);
            if (shopifyMatch) {
                match = allFeedItems.find(f => f.product?.name === shopifyMatch.name);
            }
        }
        if (!match) {
            const slugify = (s) => s?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            match = allFeedItems.find(
                f => slugify(f.product?.name) === productId || slugify(f.title) === productId
            );
        }
        return match || null;
    }, [productId, catalogReady, allFeedItems, shopifyProducts]);

    // Restore product detail mode on mount if feedActive was persisted
    const hasRestoredRef = useRef(false);
    useEffect(() => {
        if (hasRestoredRef.current || !feedActive || !feedItems.length) return;
        hasRestoredRef.current = true;
        const currentItem = feedItems[feedIndex];
        if (currentItem) {
            const textColor = currentItem.textColor || getTextColorForBackground(currentItem.backgroundColor);
            setActiveTextColor(textColor);
            setIsProductDetail(true);
            setOnCloseProductDetail(() => closeProductDetail);
        }
    }, [feedActive, feedItems, feedIndex, setActiveTextColor, setIsProductDetail, setOnCloseProductDetail, closeProductDetail]);

    // Products for the active category (card grid index view)
    const activeCategoryIndex = feedItems[feedIndex]?.categoryIndex ?? 0;
    const activeCategoryProducts = useMemo(() => {
        return feedItems.filter(
            item => item.type === 'product' && item.categoryIndex === activeCategoryIndex
        );
    }, [feedItems, activeCategoryIndex]);

    // Helper function to filter by variant subcategory metafield
    const filterBySubcategory = (products, subcategory) => {
        if (subcategory === 'all') return products;
        
        const subcategoryDef = DESSERT_SUBCATEGORIES.find(s => s.id === subcategory);
        if (!subcategoryDef) return products;
        
        return products.filter(subcategoryDef.filter);
    };
    
    // Scroll to section helper
    const scrollToSection = (sectionId) => {
        const element = document.getElementById(`section-${sectionId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // IntersectionObserver to track which merchandise section is in view
    useEffect(() => {
        if (!isMerchandise || feedActive) return;
        const sections = activeFeedSubcategories.map((sub, idx) => ({
            el: document.getElementById(`section-${sub.id}`),
            idx,
        })).filter(s => s.el);
        if (!sections.length) return;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const match = sections.find(s => s.el === entry.target);
                        if (match) setActiveMerchSection(match.idx);
                    }
                }
            },
            { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
        );
        sections.forEach(s => observer.observe(s.el));
        return () => observer.disconnect();
    }, [isMerchandise, feedActive, activeFeedSubcategories]);

    // Products organized by subcategory (for section view)
    let productsBySubcategory = {};
    
    // Get subcategories for current category
    const currentSubcategories = isDesserts ? DESSERT_SUBCATEGORIES : 
                                  isMerchandise ? MERCHANDISE_SUBCATEGORIES : 
                                  [];
    
    if (isCategoryPage && currentCategory) {
        // Filter products by current category (dynamic)
        const categoryHandle = currentCategory.handle?.toLowerCase();
        let categoryProducts;

        if (USE_HIERARCHY_GROUPING) {
            // HIERARCHY MODE: Filter by root category using catalog as source of truth
            // Build set of all Shopify category handles under this root
            const handlesUnderRoot = new Set([categoryHandle]);
            categories.filter(c => c.rootCategory?.handle?.toLowerCase() === categoryHandle)
                .forEach(c => handlesUnderRoot.add(c.handle));

            // Get the catalog root category ID for this Shopify handle
            const catalogRootId = shopifyHandleToCatalogRootId.get(categoryHandle);

            categoryProducts = locationFilteredProducts.filter(p => {
                // Primary: catalog categoryIds (source of truth)
                if (catalogRootId && p.shopifyId && catalogProductLookup.size > 0) {
                    return productBelongsToCatalogCategory(p, catalogRootId);
                }
                // Fallback for products not in catalog
                const hierarchy = getProductHierarchy(p);
                if (hierarchy?.rootCategory) {
                    return hierarchy.rootCategory.handle?.toLowerCase() === categoryHandle;
                }
                return false;
            });
            console.log(`📦 [HIERARCHY] Filtering for root category "${categoryHandle}":`, categoryProducts.length, 'products');
        } else {
            // LEGACY MODE: Direct category match
            categoryProducts = locationFilteredProducts.filter(p => {
                const pCategory = p.category?.toLowerCase();
                const pType = p.productType?.toLowerCase();
                return pCategory === categoryHandle ||
                       pType === categoryHandle ||
                       pCategory === currentCategory.id?.toLowerCase();
            });
            console.log(`📦 [LEGACY] Filtering for category "${categoryHandle}":`, categoryProducts.length, 'products');
        }
        
        // Special handling for desserts - explode variants
        if (isDesserts) {
            categoryProducts = USE_HIERARCHY_GROUPING
                ? explodeProductVariantsByHierarchy(categoryProducts)
                : explodeProductVariants(categoryProducts);
        }

        // Enrich products with catalog CDN image + PWA responsive data
        if (catalog?.products) {
            categoryProducts = categoryProducts.map(p => {
                if (p.pwa) return p; // Already enriched (from explode)
                const name = (p.name || p.title || '').toLowerCase();
                const cp = catalog.products.find(cp => cp.name?.toLowerCase() === name);
                const catalogUrl = cp?.masterImage?.url;
                return {
                    ...p,
                    imageUrl: catalogUrl || p.imageUrl,
                    pwa: cp?.masterImage?.pwa || null,
                };
            });
        }

        // Group products by subcategory, sorted by catalog productOrder (via Shopify GID)
        currentSubcategories.forEach(subcat => {
            const filtered = categoryProducts.filter(subcat.filter);
            if (catalogProductOrder.size > 0) {
                productsBySubcategory[subcat.id] = [...filtered].sort((a, b) => {
                    const aidx = catalogProductOrder.get(a.shopifyId) ?? Infinity;
                    const bidx = catalogProductOrder.get(b.shopifyId) ?? Infinity;
                    if (aidx !== Infinity && bidx !== Infinity) return aidx - bidx;
                    if (aidx !== Infinity) return -1;
                    if (bidx !== Infinity) return 1;
                    return (a.name || '').localeCompare(b.name || '');
                });
            } else {
                productsBySubcategory[subcat.id] = filtered;
            }
        });

        // Collect products that don't match any subcategory (e.g., Level 1 products)
        const matchedProductIds = new Set();
        currentSubcategories.forEach(subcat => {
            (productsBySubcategory[subcat.id] || []).forEach(p => matchedProductIds.add(p.id));
        });
        const unmatchedProducts = categoryProducts.filter(p => !matchedProductIds.has(p.id));
        if (unmatchedProducts.length > 0) {
            productsBySubcategory['_other'] = unmatchedProducts;
            console.log(`📦 Products in "Other" section (no subcategory match):`, unmatchedProducts.length);
        }

        // Sort by catalog productOrder (via Shopify GID)
        if (catalogProductOrder.size > 0) {
            displayProducts = [...categoryProducts].sort((a, b) => {
                const aidx = catalogProductOrder.get(a.shopifyId) ?? Infinity;
                const bidx = catalogProductOrder.get(b.shopifyId) ?? Infinity;
                if (aidx !== Infinity && bidx !== Infinity) return aidx - bidx;
                if (aidx !== Infinity) return -1;
                if (bidx !== Infinity) return 1;
                return (a.name || '').localeCompare(b.name || '');
            });
        } else {
            displayProducts = categoryProducts;
        }

        // Use dynamic title/description from category
        pageTitle = currentCategory.title;
        pageDescription = currentCategory.description || `Shop ${currentCategory.title}`;
    } else {
        // Homepage - show first 6 products
        displayProducts = locationFilteredProducts.slice(0, 6);
        pageTitle = pageConfig?.title || null;
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
    

    // Update activeTextColor in context when current feed item changes (for header)
    useEffect(() => {
        if (!setActiveTextColor) return;
        if (!isDesserts) {
            setActiveTextColor('black');
            return;
        }
        // Derive from feed items (card grid / vertical feed)
        if (!feedItems.length || !feedActive) {
            setActiveTextColor('black');
            return;
        }
        const currentFeedItem = feedItems[feedIndex];
        const textColor = currentFeedItem?.textColor || getTextColorForBackground(currentFeedItem?.backgroundColor);
        setActiveTextColor(textColor);
    }, [isDesserts, feedItems, feedIndex, feedActive, setActiveTextColor]);

    if (shopifyLoading && !shopifyProducts?.length) {
        return (
            <Box
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                }}
            >
                <CircularProgress sx={{ color: 'black' }} />
                <Typography sx={{ mt: 2, color: 'black' }}>Loading...</Typography>
            </Box>
        );
    }
    
    if (shopifyError) {
        return (
            <Container maxWidth="md" sx={{ py: 8 }}>
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
            {/* Full-page product detail (ALL products — no modal) */}
            {(showProduct || closingProduct) && activeProductItem && (
                <ProductDetailPage
                    item={activeProductItem}
                    onAddToCart={async (product, variant, quantity, customAttributes) => {
                        return await handleAddToCart(product, variant, quantity, customAttributes);
                    }}
                    onClose={handleCloseProduct}
                    onOpenCart={() => sendToCommerce({ type: 'OPEN_CART' })}
                    closing={closingProduct}
                    storeLocations={storeLocations}
                />
            )}

            {/* Mobile: card grid/feed */}
            {(() => {
                const showGrid = (!showProduct || closingProduct) && (isDesserts || isMerchandise || feedActive);
                const gridContent = (
                    <>
                        {/* Added to Cart banner */}
                        {showAddedToCart && addedProduct && (
                            <Box sx={{ bgcolor: 'white', py: 1.5, px: 2, borderBottom: '1px solid', borderColor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                                    <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 1, overflow: 'hidden' }}>
                                        {(addedVariant?.image?.url || addedProduct.imageUrl || addedProduct.images?.[0]?.url) ? (
                                            <img src={addedVariant?.image?.url || addedProduct.imageUrl || addedProduct.images?.[0]?.url} alt={addedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <Box sx={{ width: '100%', height: '100%', bgcolor: 'grey.200' }} />
                                        )}
                                    </Box>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{addedProduct.name || addedProduct.title}</Typography>
                                        {addedVariant?.title && addedVariant.title !== 'Default Title' && (
                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{addedVariant.title} × {addedQuantity}</Typography>
                                        )}
                                    </Box>
                                </Box>
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<ShoppingBagOutlinedIcon sx={{ fontSize: '1.6rem' }} />}
                                    onClick={() => sendToCommerce({ type: 'OPEN_CART' })}
                                    sx={{ flexShrink: 0, bgcolor: '#333', fontSize: '1.4rem', '&:hover': { bgcolor: '#000' } }}
                                >
                                    Bag ({localCart.getCartCount()})
                                </Button>
                            </Box>
                        )}
                        {/* Category navigation - sticky above card grid */}
                        {activeFeedSubcategories.length > 0 && (!feedActive || closingDetail) && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    position: 'sticky',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    zIndex: 50,
                                    flexDirection: 'row',
                                    gap: 3,
                                    px: 2,
                                    py: 1,
                                    maxWidth: '100vw',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    '&::-webkit-scrollbar': { display: 'none' },
                                    scrollbarWidth: 'none',
                                    pointerEvents: 'auto',
                                    touchAction: 'pan-x',
                                    bgcolor: 'white',
                                }}
                            >
                                {activeFeedSubcategories.map((category, idx) => {
                                    const isActive = isMerchandise
                                        ? activeMerchSection === idx
                                        : feedItems[feedIndex]?.categoryIndex === idx;
                                    return (
                                        <Typography
                                            key={category.id}
                                            onClick={() => {
                                                if (isMerchandise) {
                                                    scrollToSection(category.id);
                                                    return;
                                                }
                                                const dividerIdx = feedItems.findIndex(f => f.type === 'divider' && f.categoryId === category.id);
                                                if (dividerIdx >= 0) setFeedIndex(dividerIdx);
                                                setFeedActive(false);
                                            }}
                                            sx={{
                                                flexShrink: 0,
                                                fontSize: '1.6rem',
                                                fontWeight: isActive ? 700 : 400,
                                                color: isActive ? 'black' : 'rgba(0,0,0,0.5)',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                transition: 'color 0.3s ease-out',
                                                '&:hover': { color: 'black' },
                                            }}
                                        >
                                            {category.title}
                                        </Typography>
                                    );
                                })}
                            </Box>
                        )}

                        {/* Card grid - visible when not in detail, or during close transition */}
                        {(!feedActive || closingDetail) && (
                            <AnimatePresence mode="wait">
                            <motion.div
                                key={isMerchandise ? 'merchandise-all' : activeCategoryIndex}
                                initial={(closingDetail || dismissedCategory) ? false : { opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            >
                            {isMerchandise ? (
                                // Merchandise: render all subcategories with section headers
                                activeFeedSubcategories.map((subcat, idx) => {
                                    const subcatProducts = feedItems.filter(f => f.type === 'product' && f.categoryIndex === idx);
                                    if (!subcatProducts.length) return null;
                                    return (
                                        <Box id={`section-${subcat.id}`} key={subcat.id}>
                                            <Typography sx={{ fontSize: '1.8rem', fontWeight: 700, mb: 1.5, mt: idx > 0 ? 3 : 0, px: 2 }}>
                                                {subcat.title}
                                            </Typography>
                                            <ProductCardGrid
                                                items={subcatProducts}
                                                feedItems={feedItems}
                                                collapsingFeedIndex={(collapseTransition || closingProduct) ? feedIndex : undefined}
                                                onProductTap={(itemFeedIndex, cardData) => {
                                                    feedScrollPositionRef.current = window.scrollY;
                                                    originPathRef.current = window.location.pathname;
                                                    if (closeTimeoutRef.current) {
                                                        clearTimeout(closeTimeoutRef.current);
                                                        closeTimeoutRef.current = null;
                                                        setClosingDetail(false);
                                                        setCollapseTransition(null);
                                                    }
                                                    setFeedIndex(itemFeedIndex);
                                                    const tappedItem = feedItems[itemFeedIndex];
                                                    const productHandle = tappedItem?.product?.id;
                                                    if (productHandle) {
                                                        window.history.pushState(null, '', `/product/${productHandle}`);
                                                    }
                                                    const itemTextColor = tappedItem?.textColor || getTextColorForBackground(tappedItem?.backgroundColor);
                                                    setActiveTextColor(itemTextColor);
                                                    setIsProductDetail(true);
                                                    setOnCloseProductDetail(() => closeProductDetail);
                                                    if (tappedItem?.isMYO) {
                                                        lastCardTransitionRef.current = null;
                                                        setFeedActive(true);
                                                    } else if (cardData?.rect) {
                                                        lastCardTransitionRef.current = {
                                                            rect: cardData.rect,
                                                            bgColor: cardData.bgColor,
                                                            bgGradient: cardData.bgGradient,
                                                            imgRect: cardData.imgRect,
                                                            imgSrc: cardData.imgSrc,
                                                            imgAR: cardData.imgAR,
                                                        };
                                                        const tappedIsCollectible = tappedItem?.isCollectible || tappedItem?.product?.category?.toLowerCase() === 'merchandise' || tappedItem?.product?.productType?.toLowerCase() === 'merchandise';
                                                        const tappedImageCount = tappedItem?.catalogImages?.length || tappedItem?.product?.images?.length || 0;
                                                        setExpandTransition({
                                                            rect: cardData.rect,
                                                            bgStyle: cardData.bgGradient,
                                                            imgRect: cardData.imgRect,
                                                            imgSrc: cardData.imgSrc,
                                                            imgAR: cardData.imgAR,
                                                            hasVariants: (tappedItem?.variants?.length || 0) > 1,
                                                            isCollectible: tappedIsCollectible,
                                                            hasThumbnails: tappedIsCollectible && tappedImageCount > 1,
                                                        });
                                                        setFeedActive(true);
                                                        setTimeout(() => { setExpandTransition(null); }, 500);
                                                    } else {
                                                        setFeedActive(true);
                                                    }
                                                }}
                                                onMYOOptionTap={(productId, preSelection) => {
                                                    handleChooseProduct(productId, preSelection);
                                                }}
                                            />
                                        </Box>
                                    );
                                })
                            ) : (
                            <ProductCardGrid
                                items={activeCategoryProducts}
                                feedItems={feedItems}
                                collapsingFeedIndex={(collapseTransition || closingProduct) ? feedIndex : undefined}
                                onProductTap={(itemFeedIndex, cardData) => {
                            // Save scroll position and origin path before entering product detail
                            feedScrollPositionRef.current = window.scrollY;
                            originPathRef.current = window.location.pathname;
                            // Cancel any in-progress close animation
                            if (closeTimeoutRef.current) {
                                clearTimeout(closeTimeoutRef.current);
                                closeTimeoutRef.current = null;
                                setClosingDetail(false);
                                setCollapseTransition(null);
                            }
                            setFeedIndex(itemFeedIndex);
                            // Update URL for SEO (pushState to avoid React Router re-render)
                            const tappedItem = feedItems[itemFeedIndex];
                            const productHandle = tappedItem?.product?.id;
                            if (productHandle) {
                                window.history.pushState(null, '', `/product/${productHandle}`);
                            }
                            // Set text color and product detail mode immediately
                            const itemTextColor = tappedItem?.textColor || getTextColorForBackground(tappedItem?.backgroundColor);
                            setActiveTextColor(itemTextColor);
                            setIsProductDetail(true);
                            setOnCloseProductDetail(() => closeProductDetail);

                            // Skip FLIP animation for MYO items (no image to animate)
                            if (tappedItem?.isMYO) {
                                lastCardTransitionRef.current = null;
                                setFeedActive(true);
                            } else if (cardData?.rect) {
                                // Remember card position for reverse animation
                                lastCardTransitionRef.current = {
                                    rect: cardData.rect,
                                    bgColor: cardData.bgColor,
                                    bgGradient: cardData.bgGradient,
                                    imgRect: cardData.imgRect,
                                    imgSrc: cardData.imgSrc,
                                    imgAR: cardData.imgAR,
                                };
                                // Start overlay - use gradient (matches product detail destination)
                                const tappedIsCollectible = tappedItem?.isCollectible || tappedItem?.product?.category?.toLowerCase() === 'merchandise' || tappedItem?.product?.productType?.toLowerCase() === 'merchandise';
                                const tappedImageCount = tappedItem?.catalogImages?.length || tappedItem?.product?.images?.length || 0;
                                setExpandTransition({
                                    rect: cardData.rect,
                                    bgStyle: cardData.bgGradient,
                                    imgRect: cardData.imgRect,
                                    imgSrc: cardData.imgSrc,
                                    imgAR: cardData.imgAR,
                                    hasVariants: (tappedItem?.variants?.length || 0) > 1,
                                    isCollectible: tappedIsCollectible,
                                    hasThumbnails: tappedIsCollectible && tappedImageCount > 1,
                                });
                                // Show ProductDetailPage immediately so card slides up in parallel
                                setFeedActive(true);
                                // Remove overlay after transition completes (50ms buffer for last frame)
                                setTimeout(() => {
                                    setExpandTransition(null);
                                }, 500);
                            } else {
                                setFeedActive(true);
                            }
                        }}
                                onMYOOptionTap={(productId, preSelection) => {
                                    handleChooseProduct(productId, preSelection);
                                }}
                    />
                            )}
                            </motion.div>
                            </AnimatePresence>
                        )}

                        {/* Product detail page - visible when feed is active */}
                        {feedActive && feedItems[feedIndex]?.type === 'product' && (
                            <ProductDetailPage
                                item={feedItems[feedIndex]}
                                onAddToCart={async (product, variant, quantity, customAttributes) => {
                                    return await handleAddToCart(product, variant, quantity, customAttributes);
                                }}
                                onClose={closeProductDetail}
                                onOpenCart={() => sendToCommerce({ type: 'OPEN_CART' })}
                                closing={closingDetail}
                                storeLocations={storeLocations}
                            />
                        )}

                        {/* Footer moved outside desserts section to stay at bottom of all content */}
                    </>
                );
                // When dismissing a product (post-refresh), render grid instantly without animation
                if (dismissedCategory && showGrid) {
                    return <div style={{ display: 'block', overscrollBehavior: 'none' }}>{gridContent}</div>;
                }
                // Normal flow: animated enter/exit via AnimatePresence
                return (
                    <AnimatePresence mode="wait">
                        {showGrid && (
                            <motion.div
                                key="card-grid-mode"
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
                                exit={{ opacity: 0, y: -15, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
                                style={{ display: 'block', overscrollBehavior: 'none' }}
                            >
                                {gridContent}
                            </motion.div>
                        )}
                    </AnimatePresence>
                );
            })()}

            {/* Expanding gradient transition overlay */}
            {expandTransition && (() => {
                const ir = expandTransition.imgRect;
                const wideLayout = window.matchMedia('(min-aspect-ratio: 4/3) and (min-width: 768px)').matches;
                // Compute target image size to match ProductDetailPage's objectFit:contain rendering
                const imgAR = expandTransition.imgAR || 1;
                const cardAR = ir ? ir.width / ir.height : 1;
                // On wide, toggle is outside the image section so container is full height
                const togglePx = wideLayout ? 0 : (expandTransition.hasVariants ? 52 : 0);
                // Only use shorter 30dvh hero when thumbnails will show (multiple images), otherwise 38dvh
                const heroFraction = (!wideLayout && expandTransition.hasThumbnails) ? 0.30 : 0.38;
                // Detail page container dimensions
                const detailW = wideLayout ? window.innerWidth * 0.5 : window.innerWidth;
                const detailH = wideLayout ? window.innerHeight : (window.innerHeight * heroFraction - togglePx);
                const detailAR = detailW / detailH;
                // contain-fit rendered size in the detail container
                const containW = imgAR > detailAR ? detailW : detailH * imgAR;
                const containH = imgAR > detailAR ? detailW / imgAR : detailH;
                // Pick the dimension that matches how imgScale is computed (height if imgAR > cardAR, else width)
                const imgSize = imgAR > cardAR ? containH : containW;
                const imgStartCenterX = ir ? ir.left + ir.width / 2 : 0;
                const imgStartCenterY = ir ? ir.top + ir.height / 2 : 0;
                const imgTargetCenterX = wideLayout ? window.innerWidth * 0.25 : window.innerWidth / 2;
                // On wide, toggle is outside image section so image is centered in full height
                const toggleOffset = wideLayout ? 0 : (expandTransition.hasVariants ? 26 : 0);
                const imgTargetCenterY = wideLayout
                    ? (window.innerHeight / 2)
                    : (window.innerHeight * heroFraction / 2) + toggleOffset;
                const dx = imgTargetCenterX - imgStartCenterX;
                const dy = imgTargetCenterY - imgStartCenterY;
                // For objectFit:cover, wide images (AR > containerAR) fill height, others fill width
                const containerAR = ir ? ir.width / ir.height : 1;
                const imgScale = ir ? imgSize / (imgAR > containerAR ? ir.height : ir.width) : 1;
                return (
                    <>
                        <motion.div
                            key="expand-transition"
                            initial={{
                                top: expandTransition.rect.top,
                                left: expandTransition.rect.left,
                                width: expandTransition.rect.width,
                                height: expandTransition.rect.height,
                                borderRadius: 24,
                                opacity: 1,
                            }}
                            animate={{
                                top: 0,
                                left: 0,
                                width: wideLayout ? window.innerWidth * 0.5 : window.innerWidth,
                                height: wideLayout ? window.innerHeight : window.innerHeight * heroFraction,
                                borderRadius: 0,
                                opacity: wideLayout ? 0 : 1,
                            }}
                            transition={{
                                duration: 0.4,
                                ease: [0.22, 1, 0.36, 1],
                                opacity: wideLayout ? { duration: 0.15, delay: 0.3 } : {},
                            }}
                            style={{
                                position: 'fixed',
                                zIndex: 105,
                                background: expandTransition.bgStyle,
                                overflow: 'hidden',
                                pointerEvents: 'none',
                            }}
                        />
                        {expandTransition.imgSrc && ir && (
                            wideLayout ? (
                                <motion.img
                                    key="expand-transition-img"
                                    src={expandTransition.imgSrc}
                                    initial={{
                                        top: ir.top,
                                        left: ir.left,
                                        width: ir.width,
                                        height: ir.height,
                                        borderRadius: 12,
                                    }}
                                    animate={{
                                        top: 0,
                                        left: 0,
                                        width: window.innerWidth * 0.5,
                                        height: window.innerHeight,
                                        borderRadius: 0,
                                    }}
                                    transition={{
                                        duration: 0.45,
                                        ease: [0.22, 1, 0.36, 1],
                                    }}
                                    style={{
                                        position: 'fixed',
                                        zIndex: 106,
                                        objectFit: 'contain',
                                        pointerEvents: 'none',
                                    }}
                                />
                            ) : (
                                <motion.img
                                    key="expand-transition-img"
                                    src={expandTransition.imgSrc}
                                    initial={{
                                        x: 0,
                                        y: 0,
                                        scale: 1,
                                    }}
                                    animate={{
                                        x: dx,
                                        y: dy,
                                        scale: imgScale,
                                    }}
                                    transition={{
                                        duration: 0.45,
                                        ease: [0.22, 1, 0.36, 1],
                                    }}
                                    style={{
                                        position: 'fixed',
                                        top: ir.top,
                                        left: ir.left,
                                        width: ir.width,
                                        height: ir.height,
                                        zIndex: 106,
                                        objectFit: 'cover',
                                        borderRadius: 12,
                                        pointerEvents: 'none',
                                        willChange: 'transform',
                                    }}
                                />
                            )
                        )}
                    </>
                );
            })()}

            {/* Collapsing image transition overlay (reverse) - image only, card grid visible behind */}
            {collapseTransition && (() => {
                const tr = collapseTransition.targetImgRect;
                if (!collapseTransition.imgSrc || !tr) return null;
                const wideLayout = window.matchMedia('(min-aspect-ratio: 4/3) and (min-width: 768px)').matches;
                const collapseImgAR = collapseTransition.imgAR || 1;
                const collapseContainerAR = tr.width / tr.height;
                // Only use shorter 30dvh hero when thumbnails will show (multiple images), otherwise 38dvh
                const cHeroFraction = (!wideLayout && collapseTransition.hasThumbnails) ? 0.30 : 0.38;
                // Compute contain-fit size matching the detail page container
                const cDetailW = wideLayout ? window.innerWidth * 0.5 : window.innerWidth;
                const cDetailH = wideLayout ? window.innerHeight : (window.innerHeight * cHeroFraction);
                const cDetailAR = cDetailW / cDetailH;
                const cContainW = collapseImgAR > cDetailAR ? cDetailW : cDetailH * collapseImgAR;
                const cContainH = collapseImgAR > cDetailAR ? cDetailW / collapseImgAR : cDetailH;
                const imgSize = collapseImgAR > collapseContainerAR ? cContainH : cContainW;
                const cardCenterX = tr.left + tr.width / 2;
                const cardCenterY = tr.top + tr.height / 2;
                const screenCenterX = window.innerWidth / 2;
                const screenCenterY = window.innerHeight * cHeroFraction / 2;
                const offsetX = screenCenterX - cardCenterX;
                const offsetY = screenCenterY - cardCenterY;
                const imgStartScale = imgSize / (collapseImgAR > collapseContainerAR ? tr.height : tr.width);
                return wideLayout ? (
                    <motion.img
                        key="collapse-transition-img"
                        src={collapseTransition.imgSrc}
                        initial={{
                            top: 0,
                            left: 0,
                            width: window.innerWidth * 0.5,
                            height: window.innerHeight,
                            borderRadius: 0,
                        }}
                        animate={{
                            top: tr.top,
                            left: tr.left,
                            width: tr.width,
                            height: tr.height,
                            borderRadius: 12,
                        }}
                        transition={{
                            duration: 0.4,
                            ease: [0.22, 1, 0.36, 1],
                        }}
                        style={{
                            position: 'fixed',
                            zIndex: 106,
                            objectFit: 'cover',
                            pointerEvents: 'none',
                        }}
                    />
                ) : (
                    <motion.img
                        key="collapse-transition-img"
                        src={collapseTransition.imgSrc}
                        initial={{
                            x: offsetX,
                            y: offsetY,
                            scale: imgStartScale,
                        }}
                        animate={{
                            x: 0,
                            y: 0,
                            scale: 1,
                        }}
                        transition={{
                            duration: 0.4,
                            ease: [0.22, 1, 0.36, 1],
                        }}
                        style={{
                            position: 'fixed',
                            top: tr.top,
                            left: tr.left,
                            width: tr.width,
                            height: tr.height,
                            zIndex: 106,
                            objectFit: 'cover',
                            borderRadius: 12,
                            pointerEvents: 'none',
                            willChange: 'transform',
                        }}
                    />
                );
            })()}



            {(() => {
                const activeProduct = productId && activeProductItem?.product
                    ? activeProductItem.product
                    : feedActive && feedItems[feedIndex]?.product
                        ? feedItems[feedIndex].product
                        : null;
                return (
                    <Helmet>
                        <title>{activeProduct ? `${activeProduct.name} | Surreal Creamery` : pageTitle || 'Surreal Creamery x tokidoki | Shop'}</title>
                        <meta name="description" content={activeProduct ? (activeProduct.description || `Shop ${activeProduct.name} at Surreal Creamery`) : pageDescription || "Shop exclusive tokidoki x Surreal Creamery collaboration. Limited edition desserts, blind box collectibles, and more!"} />
                        {activeProduct && (
                            <>
                                <meta property="og:title" content={`${activeProduct.name} | Surreal Creamery`} />
                                <meta property="og:description" content={activeProduct.description || `Shop ${activeProduct.name} at Surreal Creamery`} />
                                {activeProduct.imageUrl && <meta property="og:image" content={activeProduct.imageUrl} />}
                                <meta property="og:type" content="product" />
                            </>
                        )}
                    </Helmet>
                );
            })()}

            <Box sx={{
                minHeight: (isDesserts || isMerchandise || feedActive || ((showProduct || closingProduct) && !showAddedToCart)) ? 0 : '100vh',
                backgroundColor: 'white',
                overflowX: 'hidden',
                // Hide when desserts/merchandise/feed/product view is active
                display: (isDesserts || isMerchandise || feedActive || ((showProduct || closingProduct) && !showAddedToCart)) ? 'none' : 'block',
            }}>
                {/* ADDED TO CART VIEW */}
                {showAddedToCart && addedProduct ? (
                    <Box sx={{ pb: 6 }}>
                        {/* Combined Product Info + Rewards Progress */}
                        <Box sx={{ bgcolor: 'white', py: 2, px: 2, borderBottom: '1px solid', borderColor: 'grey.200' }}>
                            <Container maxWidth="md" disableGutters>
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
                                            {addedModifiers?.length > 0 && (
                                                <Typography sx={{ color: 'text.secondary', fontSize: '1.4rem', mt: 0.25 }}>
                                                    {addedModifiers.map(m => m.value).join(', ')}
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
                                        Bag ({localCart.getCartCount()})
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
                                        
                                        // 1. Order Discounts (percentage off or amount off)
                                        orderDiscounts?.forEach(discount => {
                                            const current = cartTotal;
                                            const threshold = discount.threshold;
                                            const progress = threshold > 0 ? Math.min((current / threshold) * 100, 100) : 100;
                                            const unlocked = threshold > 0 ? current >= threshold : true;
                                            const remaining = Math.max(0, threshold - current);
                                            const isPercentage = discount.valueType === 'PERCENTAGE';
                                            const displayValue = isPercentage ? `${discount.percentOff}%` : `$${discount.amountOff}`;
                                            const thresholdLabel = threshold > 0 ? ` for orders over $${threshold}` : '';

                                            allDiscounts.push({
                                                id: discount.id,
                                                type: 'order',
                                                title: `${displayValue} Off Your Order${thresholdLabel}`,
                                                shortTitle: `${displayValue} Off`,
                                                threshold,
                                                current,
                                                progress,
                                                unlocked,
                                                remaining,
                                                percentOff: discount.percentOff,
                                                amountOff: discount.amountOff,
                                                valueType: discount.valueType,
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
                                                        {discount.type === 'order' && (
                                                            <Box sx={{
                                                                fontSize: '1.6rem',
                                                                fontWeight: 700,
                                                                color: discount.unlocked ? 'success.main' : '#e65100',
                                                                minWidth: 36
                                                            }}>
                                                                {discount.valueType === 'PERCENTAGE' ? `${discount.percentOff}%` : `$${discount.amountOff}`}
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
                                                            {discount.type === 'order' && (
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
                                                                            bgcolor: '#ff9800',
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
                            <Container maxWidth="md" sx={{ mt: 4, px: 2 }}>
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
                            <Container maxWidth="md" sx={{ mt: 4, px: 2 }}>
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
                        
                    </Box>
                ) : (
                <AnimatePresence mode="wait">
                {/* ═══════════════════════════════════════════════════════════════════════════ */}
                {/* BEATS-STYLE HOMEPAGE */}
                {/* ═══════════════════════════════════════════════════════════════════════════ */}

                {(isHomepage || showHomepageBehindModal) && (
                <motion.div
                    key="homepage"
                    variants={pageTransitionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    style={{ width: '100%' }}
                >

                {/* Hero Section */}
                <motion.div variants={childFadeUp}>
                    <Box
                        sx={{
                            position: 'relative',
                            width: { xs: 'calc(100% - 32px)', sm: 'calc(100% - 48px)' },
                            maxWidth: 'lg',
                            mx: 'auto',
                            mt: 3,
                            aspectRatio: '16 / 9',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            borderRadius: 2,
                            mb: 0,
                        }}
                    >
                        {/* Gradient Layer (background) */}
                        <Box
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                background: heroBackground,
                            }}
                        />

                        {/* Image Layer (on top of gradient) */}
                        {heroConfig.imageUrl && (
                            <Box
                                role="img"
                                aria-label={heroConfig.title}
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundImage: `url(${heroConfig.imageUrl})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            />
                        )}

                        {/* Hero Title - candy text style */}
                        <Box
                            sx={{
                                position: 'relative',
                                zIndex: 1,
                                px: { xs: 3, md: 6 },
                                mb: 1,
                                filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.15))',
                            }}
                        >
                            {/* Shadow + outline layer */}
                            <Typography
                                variant="h1"
                                aria-hidden="true"
                                sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    px: { xs: 3, md: 6 },
                                    fontFamily: "'Fredoka', sans-serif",
                                    fontWeight: 700,
                                    fontSize: { xs: '3.6rem', sm: '5rem', md: '6.4rem' },
                                    lineHeight: 1.05,
                                    letterSpacing: '-0.02em',
                                    whiteSpace: 'pre-line',
                                    color: '#3BBCE0',
                                    WebkitTextStroke: { xs: '6px #3BBCE0', md: '8px #3BBCE0' },
                                    textShadow: '0px 6px 0 #0a2a5e, 0px 7px 0 #0a2a5e, 0px 8px 0 #0a2a5e, 0px 9px 0 #0a2a5e',
                                }}
                            >
                                {heroConfig.title}
                            </Typography>
                            {/* White glossy fill layer */}
                            <Typography
                                variant="h1"
                                sx={{
                                    position: 'relative',
                                    fontFamily: "'Fredoka', sans-serif",
                                    fontWeight: 700,
                                    fontSize: { xs: '3.6rem', sm: '5rem', md: '6.4rem' },
                                    lineHeight: 1.05,
                                    letterSpacing: '-0.02em',
                                    whiteSpace: 'pre-line',
                                    background: 'linear-gradient(to bottom, #ffffff 0%, #ffffff 40%, #d8e8f0 55%, #ffffff 70%, #ffffff 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                {heroConfig.title}
                            </Typography>
                        </Box>

                        {/* Hero Subtitle */}
                        <Typography
                            sx={{
                                position: 'relative',
                                zIndex: 1,
                                color: '#2d2d2d',
                                fontSize: { xs: '1.6rem', sm: '1.8rem', md: '2rem' },
                                fontWeight: 700,
                                textAlign: 'left',
                                px: { xs: 3, md: 6 },
                                mb: 3,
                                lineHeight: 1.4,
                                whiteSpace: 'pre-line',
                            }}
                        >
                            {heroConfig.subtitle}
                        </Typography>

                        {/* CTA Buttons */}
                        <Box
                            sx={{
                                position: 'relative',
                                zIndex: 1,
                                display: 'flex',
                                gap: 2,
                                flexDirection: 'row',
                                alignItems: 'center',
                                px: { xs: 3, md: 6 },
                            }}
                        >
                            {ctaConfig.buttons?.map((button, idx) => (
                                <Button
                                    key={idx}
                                    variant="contained"
                                    onClick={() => {
                                        if (button.link?.startsWith('http')) {
                                            window.open(button.link, '_blank');
                                        } else {
                                            navigate(button.link);
                                        }
                                    }}
                                    sx={button.style === 'filled' ? {
                                        backgroundColor: '#d81b60',
                                        color: 'white',
                                        border: '2px solid black',
                                        fontSize: { xs: '1.3rem', sm: '1.5rem' },
                                        fontWeight: 800,
                                        textTransform: 'none',
                                        px: { xs: 2.5, sm: 3.5 },
                                        py: { xs: 1, sm: 1.2 },
                                        borderRadius: '30px',
                                        boxShadow: 'none',
                                        '&:hover': {
                                            backgroundColor: '#c2185b',
                                            boxShadow: 'none',
                                        },
                                    } : {
                                        backgroundColor: '#3BBCE0',
                                        color: 'white',
                                        border: '2px solid black',
                                        fontSize: { xs: '1.3rem', sm: '1.5rem' },
                                        fontWeight: 800,
                                        textTransform: 'none',
                                        px: { xs: 2.5, sm: 3.5 },
                                        py: { xs: 1, sm: 1.2 },
                                        borderRadius: '30px',
                                        boxShadow: 'none',
                                        '&:hover': {
                                            backgroundColor: '#2ea8cc',
                                            boxShadow: 'none',
                                        },
                                    }}
                                >
                                    {button.label}
                                </Button>
                            ))}
                        </Box>
                    </Box>
                </motion.div>

                {/* Featured Products Carousel */}
                <motion.div variants={childFadeUp}>
                    <Box
                        sx={{
                            width: '100vw',
                            marginLeft: 'calc(-50vw + 50%)',
                            backgroundColor: productCarouselConfig.backgroundColor || '#f5f5f5',
                            py: 6,
                        }}
                    >
                        <Container maxWidth="lg">
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: 700,
                                    mb: 1,
                                    px: 2,
                                }}
                            >
                                {productCarouselConfig.title}
                            </Typography>
                            <Typography
                                sx={{
                                    color: 'text.secondary',
                                    mb: 3,
                                    px: 2,
                                    fontSize: '1.6rem',
                                }}
                            >
                                {productCarouselConfig.subtitle}
                            </Typography>

                            {/* Horizontal Scrollable Carousel */}
                            <Box
                                role="region"
                                aria-label="Featured products carousel"
                                tabIndex={0}
                                sx={{
                                    display: 'flex',
                                    gap: 2,
                                    overflowX: 'auto',
                                    pb: 2,
                                    px: 2,
                                    scrollSnapType: 'x mandatory',
                                    '&::-webkit-scrollbar': { display: 'none' },
                                    scrollbarWidth: 'none',
                                    '&:focus-visible': {
                                        outline: '2px solid #1976d2',
                                        outlineOffset: 2,
                                        borderRadius: 1,
                                    },
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowRight') { e.currentTarget.scrollBy({ left: 260, behavior: 'smooth' }); }
                                    if (e.key === 'ArrowLeft') { e.currentTarget.scrollBy({ left: -260, behavior: 'smooth' }); }
                                }}
                            >
                                {/* Filter products based on config: manual selection or latest */}
                                {(() => {
                                    if (productCarouselConfig.productSource === 'manual' && productCarouselConfig.productIds?.length > 0) {
                                        // For manual selection, map catalog SKUs to Shopify products via platformIds
                                        return productCarouselConfig.productIds.map(sku => {
                                            const skuUpper = sku?.toUpperCase();

                                            // First, find the catalog product to get Shopify ID
                                            const catalogProduct = catalog?.products?.find(p =>
                                                p.sku?.toUpperCase() === skuUpper
                                            );
                                            const shopifyGid = catalogProduct?.platformIds?.shopify;

                                            // Then find Shopify product by GID or by matching variant SKU
                                            return shopifyProducts.find(p => {
                                                if (shopifyGid && p.shopifyId === shopifyGid) return true;
                                                if (p.variants?.some(v => v.sku?.toUpperCase() === skuUpper)) return true;
                                                if (catalogProduct?.variants?.some(cv =>
                                                    p.variants?.some(v => v.sku?.toUpperCase() === cv.sku?.toUpperCase())
                                                )) return true;
                                                return false;
                                            });
                                        }).filter(Boolean);
                                    }
                                    return displayProducts.slice(0, productCarouselConfig.maxProducts || 8);
                                })().map((product) => (
                                    <Box
                                        key={product.id}
                                        role="link"
                                        tabIndex={0}
                                        aria-label={`View product: ${product.name}`}
                                        onClick={() => handleChooseProduct(product.id)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleChooseProduct(product.id); } }}
                                        sx={{
                                            flexShrink: 0,
                                            width: { xs: '200px', sm: '240px', md: '280px' },
                                            scrollSnapAlign: 'start',
                                            cursor: 'pointer',
                                            backgroundColor: 'white',
                                            borderRadius: 3,
                                            overflow: 'hidden',
                                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                            '&:hover, &:focus-visible': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                            },
                                            '&:focus-visible': {
                                                outline: '2px solid #1976d2',
                                                outlineOffset: 2,
                                            },
                                        }}
                                    >
                                        {/* Product Image */}
                                        <Box
                                            sx={{
                                                position: 'relative',
                                                paddingTop: '100%',
                                                backgroundColor: '#fafafa',
                                            }}
                                        >
                                            <img
                                                src={product.imageUrl || product.images?.[0]?.url || 'https://placehold.co/300x300/f0f0f0/999?text=Product'}
                                                alt={product.name}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                }}
                                            />
                                        </Box>

                                        {/* Product Info */}
                                        <Box sx={{ p: 2 }}>
                                            <Typography
                                                sx={{
                                                    fontWeight: 600,
                                                    fontSize: '1.4rem',
                                                    mb: 0.5,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {product.name}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    color: 'text.secondary',
                                                    fontSize: '1.4rem',
                                                }}
                                            >
                                                {product.price || `$${product.variants?.[0]?.price || '0.00'}`}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))}

                                {/* Placeholder cards if not enough products */}
                                {displayProducts.length < 4 && [...Array(4 - displayProducts.length)].map((_, i) => (
                                    <Box
                                        key={`placeholder-${i}`}
                                        sx={{
                                            flexShrink: 0,
                                            width: { xs: '200px', sm: '240px', md: '280px' },
                                            scrollSnapAlign: 'start',
                                            backgroundColor: 'white',
                                            borderRadius: 3,
                                            overflow: 'hidden',
                                            border: '2px dashed #e0e0e0',
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                paddingTop: '100%',
                                                backgroundColor: '#fafafa',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                position: 'relative',
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    color: '#ccc',
                                                    fontSize: '1.2rem',
                                                }}
                                            >
                                                Coming Soon
                                            </Typography>
                                        </Box>
                                        <Box sx={{ p: 2 }}>
                                            <Typography sx={{ color: '#ccc', fontSize: '1.4rem' }}>
                                                New Product
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Container>
                    </Box>
                </motion.div>

                {/* Upcoming Events Section */}
                <motion.div variants={childFadeUp}>
                    <Box
                        sx={{
                            width: '100vw',
                            marginLeft: 'calc(-50vw + 50%)',
                            backgroundColor: eventCarouselConfig.backgroundColor || 'white',
                            py: 6,
                        }}
                    >
                        <Container maxWidth="lg">
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: 700,
                                    mb: 1,
                                    px: 2,
                                }}
                            >
                                {eventCarouselConfig.title}
                            </Typography>
                            <Typography
                                sx={{
                                    color: 'text.secondary',
                                    mb: 3,
                                    px: 2,
                                    fontSize: '1.6rem',
                                }}
                            >
                                {eventCarouselConfig.subtitle}
                            </Typography>

                            {/* Events - layout adapts to count */}
                            {(() => {
                                const displayEvents = filteredEvents.length > 0 ? filteredEvents.slice(0, eventCarouselConfig.maxEvents || 3) : [];
                                const count = displayEvents.length;

                                if (count === 0) {
                                    return (
                                        <Typography sx={{ color: 'text.secondary', fontSize: '1.4rem', p: 2 }}>
                                            No upcoming events
                                        </Typography>
                                    );
                                }

                                // Single event — full-width hero-style card
                                if (count === 1) {
                                    const event = displayEvents[0];
                                    return (
                                        <Box
                                            role="link"
                                            tabIndex={0}
                                            aria-label={`View event: ${event.title}`}
                                            onClick={() => navigate('/events', { state: { selectedEventId: event.id } })}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/events', { state: { selectedEventId: event.id } }); } }}
                                            sx={{
                                                mx: 2,
                                                borderRadius: 3,
                                                overflow: 'hidden',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                cursor: 'pointer',
                                                transition: 'transform 0.2s, box-shadow 0.2s',
                                                '&:hover, &:focus-visible': {
                                                    transform: 'translateY(-4px)',
                                                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                                },
                                                '&:focus-visible': {
                                                    outline: '2px solid #1976d2',
                                                    outlineOffset: 2,
                                                },
                                                backgroundColor: 'white',
                                            }}
                                        >
                                            <Box
                                                role="img"
                                                aria-label={event.imageUrl ? (event.title || 'Event image') : ''}
                                                sx={{
                                                    paddingTop: '45%',
                                                    backgroundColor: '#f5f5f5',
                                                    position: 'relative',
                                                    backgroundImage: event.imageUrl ? `url(${event.imageUrl})` : 'none',
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center',
                                                }}
                                            >
                                                {!event.imageUrl && (
                                                    <Typography
                                                        sx={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: '50%',
                                                            transform: 'translate(-50%, -50%)',
                                                            color: '#999',
                                                            fontSize: '1.4rem',
                                                        }}
                                                    >
                                                        {event.title?.charAt(0) || 'E'}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Box sx={{ p: 3 }}>
                                                <Typography sx={{ fontWeight: 600, fontSize: '2rem', mb: 1 }}>
                                                    {event.title}
                                                </Typography>
                                                <Typography sx={{ color: 'text.secondary', fontSize: '1.6rem', mb: 2 }}>
                                                    {event.startDate ? new Date(event.startDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBD'}
                                                    {event.eventTimes?.[0] && ` • ${event.eventTimes[0]}`}
                                                </Typography>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    sx={{
                                                        textTransform: 'none',
                                                        borderColor: 'black',
                                                        color: 'black',
                                                        '&:hover': { borderColor: 'black', backgroundColor: 'rgba(0,0,0,0.05)' },
                                                    }}
                                                    aria-label={`Learn more about ${event.title}`}
                                                >
                                                    Learn More
                                                </Button>
                                            </Box>
                                        </Box>
                                    );
                                }

                                // Two events — side-by-side, equal width
                                if (count === 2) {
                                    return (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                gap: 2,
                                                px: 2,
                                                pb: 2,
                                            }}
                                        >
                                            {displayEvents.map((event) => (
                                                <Box
                                                    key={`event-${event.id}`}
                                                    role="link"
                                                    tabIndex={0}
                                                    aria-label={`View event: ${event.title}`}
                                                    onClick={() => navigate('/events', { state: { selectedEventId: event.id } })}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/events', { state: { selectedEventId: event.id } }); } }}
                                                    sx={{
                                                        flex: 1,
                                                        minWidth: 0,
                                                        backgroundColor: 'white',
                                                        borderRadius: 3,
                                                        overflow: 'hidden',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                        cursor: 'pointer',
                                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                                        '&:hover, &:focus-visible': {
                                                            transform: 'translateY(-4px)',
                                                            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                                        },
                                                        '&:focus-visible': {
                                                            outline: '2px solid #1976d2',
                                                            outlineOffset: 2,
                                                        },
                                                    }}
                                                >
                                                    <Box
                                                        role="img"
                                                        aria-label={event.imageUrl ? (event.title || 'Event image') : ''}
                                                        sx={{
                                                            paddingTop: '56.25%',
                                                            backgroundColor: '#f5f5f5',
                                                            position: 'relative',
                                                            backgroundImage: event.imageUrl ? `url(${event.imageUrl})` : 'none',
                                                            backgroundSize: 'cover',
                                                            backgroundPosition: 'center',
                                                        }}
                                                    >
                                                        {!event.imageUrl && (
                                                            <Typography
                                                                sx={{
                                                                    position: 'absolute',
                                                                    top: '50%',
                                                                    left: '50%',
                                                                    transform: 'translate(-50%, -50%)',
                                                                    color: '#999',
                                                                    fontSize: '1.4rem',
                                                                }}
                                                            >
                                                                {event.title?.charAt(0) || 'E'}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    <Box sx={{ p: 3 }}>
                                                        <Typography sx={{ fontWeight: 600, fontSize: '1.6rem', mb: 1 }} noWrap>
                                                            {event.title}
                                                        </Typography>
                                                        <Typography sx={{ color: 'text.secondary', fontSize: '1.4rem', mb: 2 }}>
                                                            {event.startDate ? new Date(event.startDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBD'}
                                                            {event.eventTimes?.[0] && ` • ${event.eventTimes[0]}`}
                                                        </Typography>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            aria-label={`Learn more about ${event.title}`}
                                                            sx={{
                                                                textTransform: 'none',
                                                                borderColor: 'black',
                                                                color: 'black',
                                                                '&:hover': { borderColor: 'black', backgroundColor: 'rgba(0,0,0,0.05)' },
                                                            }}
                                                        >
                                                            Learn More
                                                        </Button>
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    );
                                }

                                // Three+ events — horizontal scrollable cards
                                return (
                                    <Box
                                        role="region"
                                        aria-label="Upcoming events carousel"
                                        tabIndex={0}
                                        sx={{
                                            display: 'flex',
                                            gap: 2,
                                            overflowX: 'auto',
                                            pb: 2,
                                            px: 2,
                                            scrollSnapType: 'x mandatory',
                                            '&::-webkit-scrollbar': { display: 'none' },
                                            scrollbarWidth: 'none',
                                            '&:focus-visible': {
                                                outline: '2px solid #1976d2',
                                                outlineOffset: 2,
                                                borderRadius: 1,
                                            },
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowRight') { e.currentTarget.scrollBy({ left: 300, behavior: 'smooth' }); }
                                            if (e.key === 'ArrowLeft') { e.currentTarget.scrollBy({ left: -300, behavior: 'smooth' }); }
                                        }}
                                    >
                                        {displayEvents.map((event) => (
                                            <Box
                                                key={`event-${event.id}`}
                                                role="link"
                                                tabIndex={0}
                                                aria-label={`View event: ${event.title}`}
                                                onClick={() => navigate('/events', { state: { selectedEventId: event.id } })}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/events', { state: { selectedEventId: event.id } }); } }}
                                                sx={{
                                                    flexShrink: 0,
                                                    width: { xs: '280px', sm: '320px', md: '360px' },
                                                    scrollSnapAlign: 'start',
                                                    backgroundColor: 'white',
                                                    borderRadius: 3,
                                                    overflow: 'hidden',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                    cursor: 'pointer',
                                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                                    '&:hover, &:focus-visible': {
                                                        transform: 'translateY(-4px)',
                                                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                                    },
                                                    '&:focus-visible': {
                                                        outline: '2px solid #1976d2',
                                                        outlineOffset: 2,
                                                    },
                                                }}
                                            >
                                                <Box
                                                    role="img"
                                                    aria-label={event.imageUrl ? (event.title || 'Event image') : ''}
                                                    sx={{
                                                        paddingTop: '56.25%',
                                                        backgroundColor: '#f5f5f5',
                                                        position: 'relative',
                                                        backgroundImage: event.imageUrl ? `url(${event.imageUrl})` : 'none',
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center',
                                                    }}
                                                >
                                                    {!event.imageUrl && (
                                                        <Typography
                                                            sx={{
                                                                position: 'absolute',
                                                                top: '50%',
                                                                left: '50%',
                                                                transform: 'translate(-50%, -50%)',
                                                                color: '#999',
                                                                fontSize: '1.4rem',
                                                            }}
                                                        >
                                                            {event.title?.charAt(0) || 'E'}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <Box sx={{ p: 3 }}>
                                                    <Typography sx={{ fontWeight: 600, fontSize: '1.6rem', mb: 1 }}>
                                                        {event.title}
                                                    </Typography>
                                                    <Typography sx={{ color: 'text.secondary', fontSize: '1.4rem', mb: 2 }}>
                                                        {event.startDate ? new Date(event.startDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBD'}
                                                        {event.eventTimes?.[0] && ` • ${event.eventTimes[0]}`}
                                                    </Typography>
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        aria-label={`Learn more about ${event.title}`}
                                                        sx={{
                                                            textTransform: 'none',
                                                            borderColor: 'black',
                                                            color: 'black',
                                                            '&:hover': { borderColor: 'black', backgroundColor: 'rgba(0,0,0,0.05)' },
                                                        }}
                                                    >
                                                        Learn More
                                                    </Button>
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                );
                            })()}
                        </Container>
                    </Box>
                </motion.div>

                </motion.div>
                )}

                {isDesserts && (
                <motion.div
                    key="desserts"
                    variants={pageTransitionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    style={{ width: '100%' }}
                >
                </motion.div>
                )}

                </AnimatePresence>
                )}
            </Box>

            {/* Footer - after all content, hidden during product detail */}
            {(!feedActive || closingDetail || closingProduct) && !showProduct && <Footer />}

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
                localCart={localCart}
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

export default function Commerce() {
    return (
        <CommerceErrorBoundary>
            <CommerceInner />
        </CommerceErrorBoundary>
    );
}
