import React, { useContext, useEffect, useRef, useLayoutEffect, useState, useMemo, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, Container, Grid, Card, CardMedia, CardContent, Modal, IconButton, Chip, ToggleButtonGroup, ToggleButton, useMediaQuery, useTheme } from '@mui/material';
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
import RemoveIcon from '@mui/icons-material/Remove';
import { motion, AnimatePresence } from 'framer-motion';

// Import components
import { Section } from '@/components/commerce/Section';
import { ProductModal } from '@/components/commerce/ProductModal';
import { CartDrawer } from '@/components/commerce/CartDrawer';
import { useDiscounts } from '@/components/commerce/useDiscounts';
import { BlindBoxProgressIndicator } from '@/components/commerce/BlindBoxProgressIndicator';
import { DiscountZonePlaceholder } from '@/components/commerce/DiscountZonePlaceholder';
import { ModifierSelector } from '@/components/commerce/ModifierSelector';
import { fetchPublishedCatalog, sortProductsByOrder } from '@/services/catalogService';
import { getAccessibleTextColorForGradient, checkGradientContrast } from '@/utils/colorContrast';
import { getPageConfig } from '@/services/pageConfigService';
import { useCart } from '@/hooks/useCart';
import Footer from '@/components/footer/commerce/commerceFooter';
import { fetchInitialData as fetchEventsData } from '@/state/events/eventService';

// Placeholder image for variants without images
const PLACEHOLDER_IMAGE = 'https://placehold.co/400x400/e0e0e0/666666?text=No+Image';

const CATALOG_API_URL = 'https://ou6oqgnnqjo542342x64srup4q0ofoua.lambda-url.us-east-1.on.aws';

// Module-level variable to persist scroll position across navigations
let pendingScrollRestore = null;

// Derive readable text color from a hex background color
// Returns 'white' for dark backgrounds, '#1a1a2e' for light backgrounds
const getTextColorForBackground = (bgHex) => {
    if (!bgHex || !bgHex.startsWith('#')) return 'white';
    const hex = bgHex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Relative luminance (sRGB)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1a1a2e' : 'white';
};

// Compute CSS gradient/background from item's color data
const getItemBackground = (item) => {
    const bgColor = item?.backgroundColor || '#1a1a2e';
    const gradientDir = item?.gradientDirection;
    const startColor = item?.gradientStartColor || bgColor;
    const endColor = item?.gradientEndColor || bgColor;

    if (!gradientDir) return bgColor;

    if (gradientDir.startsWith('linear:') || gradientDir.startsWith('radial:')) {
        const parts = gradientDir.split(':');
        const type = parts[0];
        if (type === 'radial') {
            const position = parts[1]?.replace('-', ' ') || 'center';
            return `radial-gradient(circle at ${position}, ${startColor} 0%, ${endColor} 100%)`;
        }
        const startPos = parts[1] || 'top-left';
        const endPos = parts[2] || 'bottom-right';
        const posToCoord = {
            'top-left': { x: 0, y: 0 }, 'top': { x: 1, y: 0 }, 'top-right': { x: 2, y: 0 },
            'left': { x: 0, y: 1 }, 'center': { x: 1, y: 1 }, 'right': { x: 2, y: 1 },
            'bottom-left': { x: 0, y: 2 }, 'bottom': { x: 1, y: 2 }, 'bottom-right': { x: 2, y: 2 },
        };
        const start = posToCoord[startPos] || posToCoord['top-left'];
        const end = posToCoord[endPos] || posToCoord['bottom-right'];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.round(Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;
        return `linear-gradient(${angle}deg, ${startColor} 0%, ${endColor} 100%)`;
    }

    const legacyAngles = {
        'to-bottom-right': '135deg', 'to-bottom-left': '225deg', 'to-bottom': '180deg',
        'to-right': '90deg', 'to-top-right': '45deg', 'to-top-left': '315deg',
        'to-top': '0deg', 'to-left': '270deg',
    };
    const angle = legacyAngles[gradientDir];
    return angle ? `linear-gradient(${angle}, ${startColor} 0%, ${endColor} 100%)` : bgColor;
};

// Check if a variant is available at the user's selected pickup location.
// Returns { available, locationName } — available=true means either no location selected
// or the variant's storeAvailability includes that location.
const useLocationAvailability = (variant, product, storeLocations) => {
    return useMemo(() => {
        const selectedSlug = localStorage.getItem('selectedLocation');
        if (!selectedSlug || !storeLocations?.length) return { available: true, locationName: null };
        const store = storeLocations.find(loc => loc.id === selectedSlug);
        if (!store?.shopifyLocationId) return { available: true, locationName: null };
        const shopifyGid = `gid://shopify/Location/${store.shopifyLocationId}`;

        // Check variant-level storeAvailability first
        if (variant?.storeAvailability?.length) {
            const locEntry = variant.storeAvailability.find(sa => sa.locationId === shopifyGid);
            if (locEntry && !locEntry.available) return { available: false, locationName: store.name };
            if (!locEntry) return { available: false, locationName: store.name };
        }
        // Fallback: check product-level storeAvailableLocationIds
        if (product?.storeAvailableLocationIds?.length) {
            if (!product.storeAvailableLocationIds.includes(shopifyGid)) {
                return { available: false, locationName: store.name };
            }
        }
        return { available: true, locationName: store.name };
    }, [variant?.id, product?.id, storeLocations]);
};

// Mobile product card grid - category index view
const ProductCardGrid = ({ items = [], feedItems = [], onProductTap, onMYOOptionTap, collapsingFeedIndex }) => {
    const makeYourOwn = items.filter(item => item.isMYO);
    const regular = items.filter(item => !item.isMYO);

    const renderCard = (item, isFullWidth) => {
        const itemFeedIndex = feedItems.findIndex(f => f.id === item.id);
        const product = item.product || item;
        const price = product.variants?.[0]?.price
            ? `$${parseFloat(product.variants[0].price).toFixed(2)}`
            : product.price
                ? `$${parseFloat(product.price).toFixed(2)}`
                : '';
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
                                    fontSize: isFullWidth ? '1.4rem' : '1.2rem',
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

    return (
        <Box sx={{ px: 2, pb: 6 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2 }}>
                {/* Make Your Own - same card style, uses onProductTap like regular cards */}
                {makeYourOwn.map(item => {
                    const itemFeedIndex = feedItems.findIndex(f => f.id === item.id);
                    const product = item.product || item;
                    const price = product.variants?.[0]?.price
                        ? `$${parseFloat(product.variants[0].price).toFixed(2)}`
                        : product.price
                            ? `$${parseFloat(product.price).toFixed(2)}`
                            : '';
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
                                {/* Image area - square like other cards */}
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
                                {/* Text area */}
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
                                            fontSize: '1.2rem',
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
                })}
                {/* Product cards */}
                {regular.map(item => renderCard(item, false))}
            </Box>
        </Box>
    );
};

// Resolve display modifiers from catalog data (modifier/option IDs → full details)
const resolveDisplayModifiers = (displayModifiers = [], allModifiers = []) => {
    if (!displayModifiers.length || !allModifiers.length) return [];
    const modMap = new Map(allModifiers.map(m => [m.modifierId, m]));
    return displayModifiers.map(dm => {
        const mod = modMap.get(dm.modifierId);
        if (!mod) return null;
        const opts = (mod.options || [])
            .filter(o => dm.selectedOptionIds?.includes(o.optionId))
            .sort((a, b) => (a.position || 0) - (b.position || 0));
        return opts.length ? {
            modifierId: dm.modifierId,
            name: mod.name,
            options: opts.map(o => ({ optionId: o.optionId, name: o.name, price: o.price, image: o.image })),
        } : null;
    }).filter(Boolean);
};

// Product detail page - image hero (top 1/3) + scrollable info card (bottom 2/3)
const ProductDetailPage = ({ item, onAddToCart, onClose, onOpenCart, closing, storeLocations = [] }) => {
    const product = item?.product || item;
    const catalogVariants = item?.catalogVariants || [];
    // Sort Shopify variants to match catalog (Surreal Admin) order by SKU
    const variants = useMemo(() => {
        const shopifyVariants = product?.variants || [];
        if (!catalogVariants.length) return shopifyVariants;
        const skuOrder = catalogVariants.map(cv => cv.sku?.toUpperCase());
        return [...shopifyVariants].sort((a, b) => {
            const aIdx = skuOrder.indexOf(a.sku?.toUpperCase());
            const bIdx = skuOrder.indexOf(b.sku?.toUpperCase());
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        });
    }, [product?.variants, catalogVariants]);
    const defaultVariantId = variants.find(v => v.availableForSale !== false)?.id || variants[0]?.id || product?.variantId;
    const [selectedVariantId, setSelectedVariantId] = useState(defaultVariantId);
    // Reset selection when product changes
    useEffect(() => {
        setSelectedVariantId(defaultVariantId);
    }, [defaultVariantId]);
    const [quantity, setQuantity] = useState(1);
    const [addingToCart, setAddingToCart] = useState(false);
    const [contentVisible, setContentVisible] = useState(false);

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

    // Track selected modifier images for MYO hero
    const handleMyoSelectionsChange = useCallback((selections, categories) => {
        if (!categories) return;
        const images = [];
        categories.forEach(cat => {
            const selectedIds = selections[cat.id] || [];
            selectedIds.forEach(modId => {
                const mod = cat.modifiers.find(m => m.id === modId);
                if (mod) {
                    images.push({ id: mod.id, name: mod.name, image: mod.image || mod.imageUrl });
                }
            });
        });
        setMyoSelectedImages(images);
    }, []);

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
    const isAvailable = (item?.inventory?.trackInventory
        ? item.inventory.inStock
        : selectedVariant?.availableForSale !== false) && availableAtLocation;

    const handleAddToCart = async () => {
        if (!selectedVariantId || addingToCart) return;
        setAddingToCart(true);
        try {
            await onAddToCart?.(product.id, selectedVariantId, quantity);
            onClose?.();
            setTimeout(() => onOpenCart?.(), 400);
        } catch (error) {
            console.error('Error adding to cart:', error);
        } finally {
            setAddingToCart(false);
        }
    };

    const backgroundStyle = getItemBackground(item);

    // Match variant image to catalog image by shared filename hash
    const catalogImages = item?.catalogImages || [];
    let heroImage = item?.image;
    const variantImgUrl = selectedVariant?.image?.url;
    if (variantImgUrl && catalogImages.length > 1) {
        // Extract unique hash from Shopify CDN filename (e.g., "c764ec92" from "surreal-nom-nom-cookie-c764ec92-shopify.webp")
        const shopifyFilename = variantImgUrl.split('/').pop()?.split('?')[0] || '';
        const hashMatch = shopifyFilename.match(/([a-f0-9]{8})/);
        if (hashMatch) {
            const hash = hashMatch[1];
            const matched = catalogImages.find(ci => ci.url?.includes(hash));
            if (matched) heroImage = matched.url;
        }
    }
    const heroTextColor = item?.textColor || getTextColorForBackground(item?.backgroundColor);

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
                            zIndex: 4,
                            background: isWide
                                ? `linear-gradient(to right, transparent 50%, ${item?.gradientEndColor || item?.backgroundColor || '#1a1a2e'} 50%)`
                                : (item?.gradientEndColor || item?.backgroundColor || '#1a1a2e'),
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
                                zIndex: 3,
                                background: backgroundStyle,
                                overscrollBehavior: 'none',
                                touchAction: 'none',
                            }}
                        />
                    )}

                    {/* Top section - gradient background + product image */}
                    <Box
                        sx={{
                            display: 'flex',
                            position: 'fixed',
                            top: 0, left: 0,
                            right: isWide ? 'auto' : 0,
                            width: isWide ? '50%' : '100%',
                            height: isWide ? '100dvh' : '38dvh',
                            zIndex: 5,
                            background: isWide ? 'transparent' : backgroundStyle,
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            overscrollBehavior: 'none',
                            touchAction: 'none',
                        }}
                    >
                        {isMYO ? (
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1,
                                px: 2,
                                maxWidth: '90%',
                            }}>
                                {/* Title in gradient area */}
                                <Typography sx={{
                                    color: item?.textColor || getTextColorForBackground(item?.backgroundColor),
                                    fontSize: '2.2rem',
                                    fontWeight: 700,
                                    textAlign: 'center',
                                    textShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                    mb: myoSelectedImages.length > 0 ? 1 : 0,
                                }}>
                                    {item?.title || product?.name}
                                </Typography>

                                {/* Selected modifier images */}
                                {myoSelectedImages.length > 0 && (
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 1,
                                    }}>
                                        {myoSelectedImages.map((sel, idx) => (
                                            <React.Fragment key={sel.id}>
                                                {idx > 0 && (
                                                    <Typography sx={{
                                                        color: item?.textColor || getTextColorForBackground(item?.backgroundColor),
                                                        fontSize: '2rem',
                                                        fontWeight: 700,
                                                        opacity: 0.8,
                                                        flexShrink: 0,
                                                    }}>+</Typography>
                                                )}
                                                <Box sx={{
                                                    flexShrink: 1,
                                                    minWidth: 0,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                }}>
                                                    {sel.image && (
                                                        <img
                                                            src={sel.image}
                                                            alt={sel.name}
                                                            style={{
                                                                width: '100%',
                                                                maxWidth: myoSelectedImages.length === 1 ? '200px' : '120px',
                                                                aspectRatio: '1',
                                                                objectFit: 'cover',
                                                                borderRadius: 12,
                                                            }}
                                                        />
                                                    )}
                                                    <Typography sx={{
                                                        color: item?.textColor || getTextColorForBackground(item?.backgroundColor),
                                                        fontSize: '1.2rem',
                                                        fontWeight: 600,
                                                        textAlign: 'center',
                                                        mt: 0.5,
                                                        textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                                    }}>{sel.name}</Typography>
                                                </Box>
                                            </React.Fragment>
                                        ))}
                                    </Box>
                                )}
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
                                                {variant.title || variant.name || `Option ${variants.indexOf(variant) + 1}`}
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
                            </Box>
                        )}
            </Box>

                    {/* Variant toggle group (wide only — fixed, centered on full page) */}
                    {isWide && !isMYO && variants.length > 1 && (
                        <ToggleButtonGroup
                            value={selectedVariantId}
                            exclusive
                            onChange={(_, val) => { if (val) setSelectedVariantId(val); }}
                            sx={{
                                position: 'fixed',
                                top: 16,
                                left: '50%',
                                zIndex: 65,
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
                                    {variant.title || variant.name || `Option ${variants.indexOf(variant) + 1}`}
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
                    top: isWide ? 56 : '38dvh',
                    left: isWide ? 'calc(50% + 24px)' : 12,
                    right: isWide ? 24 : 12,
                    bottom: isWide ? 24 : 0,
                    backgroundColor: 'white',
                    borderRadius: isWide ? 24 : '24px 24px 0 0',
                    boxShadow: isWide ? '0 8px 32px rgba(0,0,0,0.12)' : 'none',
                    zIndex: 60,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    overscrollBehavior: 'none',
                }}
            >
                {/* Drag handle indicator */}
                <Box sx={{ display: isWide ? 'none' : 'flex', justifyContent: 'center', pt: 1.5, pb: 1 }}>
                    <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'grey.300' }} />
                </Box>

                {/* Scrollable content - fades in as card slides up */}
                <Box
                    sx={{
                        flex: 1,
                        overflowY: 'auto',
                        px: 3,
                        pt: isWide ? 3 : 0,
                        pb: 2,
                        opacity: (contentVisible && !closing) ? 1 : 0,
                        transform: (contentVisible && !closing) ? 'translateY(0)' : 'translateY(20px)',
                        transition: 'opacity 0.35s ease, transform 0.35s ease',
                    }}
                >
                    {/* Product name + price */}
                    {(!isMYO || isLastModifierStep) && (
                        <>
                            {!isMYO && (
                                <Typography sx={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.2, mb: 0.5 }}>
                                    {item?.title || product?.name}
                                </Typography>
                            )}
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
                        </>
                    )}

                    {/* MYO: Interactive modifier selector from Square API */}
                    {isMYO && productSku && (
                        <ModifierSelector
                            ref={modifierSelectorRef}
                            sku={productSku}
                            autoAdvance
                            onSelectionsChange={handleMyoSelectionsChange}
                            onPriceChange={() => {}}
                            onValidationChange={() => {}}
                            onAllStepsComplete={() => {}}
                            onCanContinueChange={setCanContinueModifiers}
                            onIsLastStepChange={setIsLastModifierStep}
                        />
                    )}

                    {/* Display Modifiers - flat 3-column grid (non-MYO products only) */}
                    {!isMYO && item?.displayModifiers?.length > 0 && (
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
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
                                        }}>
                                            {opt.name}
                                        </Typography>
                                    </Box>
                                ))
                            )}
                        </Box>
                    )}

                    {/* Description */}
                    {product?.description && (
                        <Typography sx={{ fontSize: '1.6rem', color: 'grey.600', lineHeight: 1.6, mb: 3 }}>
                            {product.description}
                        </Typography>
                    )}


                </Box>

                {/* Sticky bottom bar - close + add to cart */}
                <Box sx={{
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

                    {/* MYO: Add to Cart only when on review step */}
                    {isMYO && productSku ? (
                        isLastModifierStep && (
                            <Button
                                variant="contained"
                                fullWidth
                                onClick={handleAddToCart}
                                disabled={addingToCart || !isAvailable}
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
                                ) : (
                                    'Out of Stock'
                                )}
                            </Button>
                        )
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
    const { commerceState, sendToCommerce, setActiveTextColor, setIsProductDetail, setOnCloseProductDetail, setCartCount } = useContext(LayoutContext);
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
    const [feedIndex, setFeedIndex] = useState(() => commerceState?.context?.feedIndex ?? 0);
    feedIndexRef.current = feedIndex;
    const [feedActive, setFeedActive] = useState(() => commerceState?.context?.feedActive ?? false);
    const [expandTransition, setExpandTransition] = useState(null); // { rect, bgStyle, imgRect, imgSrc }
    const [collapseTransition, setCollapseTransition] = useState(null); // reverse animation
    const [closingDetail, setClosingDetail] = useState(false); // triggers card slide-down before collapse
    const closeTimeoutRef = useRef(null); // track close timeout for cancellation
    const lastCardTransitionRef = useRef(null); // remember card position for reverse
    const feedScrollPositionRef = useRef(0); // remember scroll position when entering product detail

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

                    setCollapseTransition({
                        targetRect,
                        targetImgRect,
                        bgStyle: bgColor,
                        imgSrc,
                        imgAR: cardData.imgAR,
                        title: current?.title || product?.name || '',
                        price,
                        textColor: current?.textColor || getTextColorForBackground(current?.backgroundColor),
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
    
    // Blind box selector modal state
    const [showBlindBoxSelector, setShowBlindBoxSelector] = useState(false);

    // Catalog for product ordering
    const [catalog, setCatalog] = useState(null);

    // Page configuration from API
    const [pageConfig, setPageConfig] = useState(null);

    // Events data for event carousel
    const [events, setEvents] = useState([]);

    // Locations data for filtering events by selected location
    const [storeLocations, setStoreLocations] = useState([]);

    // Fetch published catalog for product ordering
    useEffect(() => {
        fetchPublishedCatalog().then(setCatalog);
    }, []);

    // Fetch store locations
    useEffect(() => {
        fetch('https://data.surrealcreamery.com/locations.json')
            .then(res => res.json())
            .then(data => { if (Array.isArray(data)) setStoreLocations(data); })
            .catch(() => {});
    }, []);

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

    // Get merged productOrder from ALL categories in catalog
    const getMergedProductOrder = useMemo(() => {
        if (!catalog?.categories) return [];
        const allOrdered = [];
        for (const category of catalog.categories) {
            if (category.productOrder?.length) {
                for (const sku of category.productOrder) {
                    if (!allOrdered.includes(sku)) {
                        allOrdered.push(sku);
                    }
                }
            }
        }
        return allOrdered;
    }, [catalog]);

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
            { label: 'Merchandise', link: '/merchandise', style: 'outlined' },
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

    // Filter products by selected location's Shopify availability
    const [selectedLocationForFilter, setSelectedLocationForFilter] = useState(
        () => localStorage.getItem('selectedLocation')
    );

    useEffect(() => {
        const handler = (e) => setSelectedLocationForFilter(e.detail.locationId);
        window.addEventListener('locationChanged', handler);
        return () => window.removeEventListener('locationChanged', handler);
    }, []);

    const locationFilteredProducts = useMemo(() => {
        if (!selectedLocationForFilter || storeLocations.length === 0) return shopifyProducts;
        const store = storeLocations.find(loc => loc.id === selectedLocationForFilter);
        if (!store?.shopifyLocationId) return shopifyProducts;
        const shopifyGid = `gid://shopify/Location/${store.shopifyLocationId}`;
        const filtered = shopifyProducts.filter(product =>
            !product.storeAvailableLocationIds?.length ||
            product.storeAvailableLocationIds.includes(shopifyGid)
        );
        console.log(`📍 Location filter: selected=${selectedLocationForFilter} shopifyGid=${shopifyGid} ${filtered.length}/${shopifyProducts.length} products`, shopifyProducts[0]?.storeAvailableLocationIds);
        return filtered;
    }, [shopifyProducts, storeLocations, selectedLocationForFilter]);

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
    
    // Determine the current view key for page transitions
    const viewKey = isHomepage ? 'homepage' : isDesserts ? 'desserts' : isMerchandise ? 'merchandise' : 'other';

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
    const preSelectedModifierRef = useRef(null); // Track pre-selected modifier from MYO teaser grid
    const returningFromProductModal = useRef(false); // Track if returning from modal (don't clear AddedToCart)
    const isFirstRender = useRef(true); // Track first render (don't clear AddedToCart on page load/refresh)

    // Show homepage content behind modal when opened from homepage
    const showHomepageBehindModal = productId && (returnPath.current === '/' || returnPath.current === null);
    
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
            preSelectedModifierRef.current = null;
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
        
        isInternalNavigation.current = true;
        sendToCommerce({ type: 'VIEW_PRODUCT', productId: lookupId });
        navigate(`/product/${lookupId}`, { replace: false });
    };
    
    // Handle add to cart
    const handleAddToCart = async (productId, variantId, quantity = 1, customAttributes = []) => {
        console.log('🛒 handleAddToCart called:', { productId, variantId, quantity, customAttributes });
        try {
            // Find the product and variant info
            const product = shopifyProducts.find(p => p.id === productId);
            const variant = product?.variants?.find(v => v.id === variantId) || product?.variants?.[0];

            // Add to local cart
            const modifiers = (customAttributes || [])
                .filter(a => !a.key?.startsWith('_'))
                .map(a => ({ key: a.key, value: a.value, price: 0 }));
            localCart.addToCart(product, variant, quantity, modifiers);
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
            setShowAddedToCart(true);
            
            // Save to sessionStorage BEFORE navigate (useEffect won't run if component unmounts)
            sessionStorage.setItem('addedToCart', JSON.stringify({
                show: true,
                product,
                variant,
                quantity
            }));

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

            // Look up catalog image + PWA variants for responsive images
            const productName = (product.name || product.title || '').toLowerCase();
            const catalogProduct = catalog?.products?.find(cp => cp.name?.toLowerCase() === productName);
            const catalogPwa = catalogProduct?.masterImage?.pwa || null;
            const catalogImageUrl = catalogProduct?.masterImage?.url || null;

            // For products with size variants, group them together
            const sizeVariants = product.variants?.filter(v => v.sizeData || v.size) || [];
            const hasMultipleSizes = sizeVariants.length > 1;

            if (hasMultipleSizes) {
                // Multiple size variants - show as one card with size selector
                const prices = sizeVariants.map(v => parseFloat(v.price)).sort((a, b) => a - b);
                const minPrice = prices[0];
                const maxPrice = prices[prices.length - 1];
                const priceDisplay = minPrice === maxPrice
                    ? `$${minPrice.toFixed(2)}`
                    : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;

                const sizeNames = sizeVariants.map(v => v.sizeData?.title || v.size || v.title);
                const sizeDescription = sizeNames.join(' | ');

                // Find best image (prefer most expensive variant with image)
                const variantsWithImages = sizeVariants.filter(v =>
                    v.hasVariantImage === true && v.image?.url
                );
                let imageUrl = catalogImageUrl || product.imageUrl || PLACEHOLDER_IMAGE;
                let imageAlt = product.name;
                let useVariantImage = false;
                if (variantsWithImages.length > 0) {
                    const sortedByPrice = [...variantsWithImages].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
                    imageUrl = sortedByPrice[0].image.url;
                    imageAlt = sortedByPrice[0].image.alt || product.name;
                    useVariantImage = true;
                }

                exploded.push({
                    ...product,
                    id: `${product.id}-${subcategory}-${container}`,
                    variantId: sizeVariants[0].id,
                    variants: sizeVariants,
                    price: priceDisplay,
                    originalProductId: product.id,
                    subcategory: subcategory,
                    subcategoryData: subcategoryData,
                    container: container,
                    containerData: containerData,
                    imageUrl: imageUrl,
                    imageAlt: imageAlt,
                    pwa: useVariantImage ? null : catalogPwa,
                    variantOptions: containerData?.title || null,
                    sizeOptions: sizeDescription,
                    availableVariants: sizeVariants
                });
            } else {
                // Single variant or no size variants - show as single card
                const variant = product.variants?.[0] || {};
                const sizeTitle = variant.sizeData?.title || variant.size || '';

                const hasVariantSpecificImage = variant.hasVariantImage === true && variant.image?.url;
                const variantImage = hasVariantSpecificImage
                    ? variant.image.url
                    : (catalogImageUrl || product.imageUrl || PLACEHOLDER_IMAGE);

                exploded.push({
                    ...product,
                    id: `${product.id}-${subcategory}-${container}`,
                    variantId: variant.id || product.id,
                    price: variant.price ? `$${parseFloat(variant.price).toFixed(2)}` : product.price,
                    originalProductId: product.id,
                    subcategory: subcategory,
                    subcategoryData: subcategoryData,
                    container: container,
                    containerData: containerData,
                    imageUrl: variantImage,
                    imageAlt: variant.image?.alt || product.name,
                    pwa: hasVariantSpecificImage ? null : catalogPwa,
                    variantOptions: containerData?.title || null,
                    sizeOptions: sizeTitle ? [sizeTitle] : null,
                    variants: null,
                    availableVariants: product.variants?.length ? [variant] : null
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
     * Build subcategory definitions from CATEGORY HIERARCHY
     * Uses Level 2 categories under a root category
     * Extracts unique container sizes from product variants
     */
    const buildSubcategoriesFromHierarchy = (rootCategoryHandle) => {
        const subcats = getSubcategories(rootCategoryHandle);
        console.log('🔍 Subcategories for', rootCategoryHandle, ':', subcats.map(s => s.handle));

        return subcats.map(subcat => {
            // Filter products for this subcategory
            const subcatProducts = shopifyProducts.filter(p => {
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
                // Filter products by their category hierarchy
                filter: (p) => {
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
    }, [catalog, shopifyProducts, categories]);

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
     * Build subcategories from CATALOG CATEGORIES
     * Uses product categoryIds from the master catalog (admin)
     */
    const buildSubcategoriesFromCatalog = () => {
        if (!catalog?.categories?.length || !catalog?.products?.length) return [];

        // Find the "Desserts" root category
        const dessertsRoot = catalog.categories.find(c =>
            c.slug === 'desserts' || c.name?.toLowerCase() === 'desserts'
        );
        if (!dessertsRoot) {
            console.log('📦 [Catalog] No Desserts root category found');
            return [];
        }

        // Get all subcategories under Desserts (where parentId = dessertsRoot.id)
        const subcategories = catalog.categories
            .filter(c => c.parentId === dessertsRoot.id)
            .sort((a, b) => (a.position || 0) - (b.position || 0));

        console.log('📦 [Catalog] Found subcategories:', subcategories.map(s => s.name));

        // Build a set of all descendant category IDs for each subcategory
        const getDescendantIds = (parentId) => {
            const ids = new Set([parentId]);
            const findChildren = (pid) => {
                catalog.categories.filter(c => c.parentId === pid).forEach(child => {
                    ids.add(child.id);
                    findChildren(child.id);
                });
            };
            findChildren(parentId);
            return ids;
        };

        return subcategories.map(subcat => {
            // Find catalog products in this category OR any descendant category
            const subcatIds = getDescendantIds(subcat.id);
            const catalogProductsInCategory = catalog.products.filter(p =>
                p.categoryIds?.some(catId => subcatIds.has(catId))
            );

            // Sort by productOrder if available
            // If this category has no productOrder but has children, build a merged order
            // from children sorted by their position
            let productOrder = subcat.productOrder || [];
            if (productOrder.length === 0) {
                const childCategories = catalog.categories
                    .filter(c => c.parentId === subcat.id)
                    .sort((a, b) => (a.position || 0) - (b.position || 0));
                productOrder = childCategories.flatMap(child => child.productOrder || []);
            }
            const sortedCatalogProducts = productOrder.length > 0
                ? sortProductsByOrder(catalogProductsInCategory, productOrder, catalog.products)
                : catalogProductsInCategory;

            // Build containers by matching with Shopify products
            const containers = sortedCatalogProducts.map(catalogProduct => {
                // Find matching Shopify product by name or SKU
                const shopifyProduct = shopifyProducts.find(sp => {
                    // Match by name
                    if (sp.name?.toLowerCase() === catalogProduct.name?.toLowerCase()) return true;
                    // Match by SKU
                    const catalogSku = catalogProduct.sku?.toUpperCase();
                    if (catalogSku && sp.variants?.some(v => v.sku?.toUpperCase() === catalogSku)) return true;
                    return false;
                });

                if (!shopifyProduct) {
                    console.log('📦 [Catalog] No Shopify match for:', catalogProduct.name);
                    return null;
                }

                // Get image and colors from catalog masterImage
                const masterImage = catalogProduct.masterImage;
                const firstImage = catalogProduct.images?.[0];
                const s3Image = masterImage?.url || firstImage?.url || null;
                const backgroundColor = masterImage?.backgroundColor || firstImage?.backgroundColor || null;
                const textColor = masterImage?.textColor || firstImage?.textColor || null;
                const gradientDirection = masterImage?.gradientDirection || firstImage?.gradientDirection || null;
                const gradientStartColor = masterImage?.gradientStartColor || firstImage?.gradientStartColor || null;
                const gradientEndColor = masterImage?.gradientEndColor || firstImage?.gradientEndColor || null;

                return {
                    id: `${shopifyProduct.id}-${subcat.id}`,
                    title: shopifyProduct.name,
                    product: shopifyProduct,
                    image: s3Image,
                    catalogImages: (catalogProduct.images || []).sort((a, b) => (a.order || 0) - (b.order || 0)),
                    pwa: masterImage?.pwa || null,
                    backgroundColor,
                    textColor,
                    gradientDirection,
                    gradientStartColor,
                    gradientEndColor,
                    variantId: shopifyProduct.variants?.[0]?.id,
                    variants: shopifyProduct.variants,
                    catalogVariants: catalogProduct.variants || [],
                    displayModifiers: resolveDisplayModifiers(catalogProduct.displayModifiers, catalog.modifiers),
                    isMYO: (catalogProduct.name || '').toLowerCase().includes('make your own'),
                    // Master inventory: aggregate across all catalog variants
                    inventory: (() => {
                        const variants = catalogProduct.variants || [];
                        const anyTracked = variants.some(v => v.inventory?.trackInventory);
                        const totalQty = variants.reduce((sum, v) => sum + (v.inventory?.totalQuantity || 0), 0);
                        return {
                            trackInventory: anyTracked,
                            totalQuantity: totalQty,
                            inStock: !anyTracked || totalQty > 0,
                        };
                    })(),
                };
            }).filter(Boolean); // Remove nulls (no Shopify match)

            console.log('📦 [Catalog] Products for', subcat.name, ':', containers.map(c => c.title));

            return {
                id: subcat.id,
                title: subcat.name,
                description: subcat.description || '',
                image: subcat.image?.url || `https://placehold.co/300x300/e0e0e0/666666?text=${encodeURIComponent(subcat.name)}`,
                containers: containers,
                products: containers.map(c => c.product),
                filter: (p) => {
                    const catalogProd = catalog.products?.find(cp =>
                        cp.name?.toLowerCase() === p.name?.toLowerCase()
                    );
                    return catalogProd?.categoryIds?.some(catId => subcatIds.has(catId));
                }
            };
        }).filter(subcat => subcat.containers.length > 0);
    };

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

    // Build catalog-based subcategories (memoized) - uses product categoryIds from admin
    const CATALOG_DESSERT_SUBCATEGORIES = useMemo(() => {
        return buildSubcategoriesFromCatalog();
    }, [catalog, shopifyProducts]);

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


    // Flatten subcategories into a single feed: divider slides + product slides
    const feedItems = useMemo(() => {
        const items = [];
        DESSERT_SUBCATEGORIES.forEach((subcat, subcatIndex) => {
            // Category divider slide
            items.push({
                type: 'divider',
                id: `divider-${subcat.id}`,
                categoryId: subcat.id,
                categoryIndex: subcatIndex,
                title: subcat.title,
                image: subcat.image,
            });
            // Product slides
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
    }, [DESSERT_SUBCATEGORIES]);
    feedItemsRef.current = feedItems;

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
        const categoryHandle = currentCategory.handle?.toLowerCase();
        let categoryProducts;

        if (USE_HIERARCHY_GROUPING) {
            // HIERARCHY MODE: Filter by root category from hierarchy
            // Products are assigned to leaf categories, so we look UP the hierarchy to find the root
            categoryProducts = locationFilteredProducts.filter(p => {
                const hierarchy = getProductHierarchy(p);
                if (hierarchy?.rootCategory) {
                    // Check if product's root category matches current category
                    return hierarchy.rootCategory.handle?.toLowerCase() === categoryHandle;
                }
                // Fallback: direct category match or productType
                const pCategory = p.category?.toLowerCase();
                const pType = p.productType?.toLowerCase();
                return pCategory === categoryHandle || pType === categoryHandle;
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

        // Group products by subcategory for section display, sorted by productOrder
        currentSubcategories.forEach(subcat => {
            const filtered = categoryProducts.filter(subcat.filter);
            productsBySubcategory[subcat.id] = getMergedProductOrder.length > 0
                ? sortProductsByOrder(filtered, getMergedProductOrder, catalog?.products || [])
                : filtered;
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

        // Sort by productOrder from catalog, then assign to displayProducts
        if (getMergedProductOrder.length > 0) {
            displayProducts = sortProductsByOrder(categoryProducts, getMergedProductOrder, catalog?.products || []);
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

    if (shopifyLoading) {
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
            {/* Mobile: card grid/feed */}
            <AnimatePresence mode="wait">
            {(isDesserts || (showProductModal && feedItems.length > 0)) && (
                    <motion.div
                        key="card-grid-mode"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
                        exit={{ opacity: 0, y: -15, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
                        style={{ display: 'block', overscrollBehavior: 'none' }}
                    >
                        {/* Category navigation - sticky above card grid */}
                        {DESSERT_SUBCATEGORIES.length > 0 && (!feedActive || closingDetail) && (
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
                                {DESSERT_SUBCATEGORIES.map((category, idx) => {
                                    const isActive = feedItems[feedIndex]?.categoryIndex === idx;
                                    return (
                                        <Typography
                                            key={category.id}
                                            onClick={() => {
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
                                key={activeCategoryIndex}
                                initial={closingDetail ? false : { opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            >
                            <ProductCardGrid
                                items={activeCategoryProducts}
                                feedItems={feedItems}
                                collapsingFeedIndex={collapseTransition ? feedIndex : undefined}
                                onProductTap={(itemFeedIndex, cardData) => {
                            // Save scroll position before entering product detail
                            feedScrollPositionRef.current = window.scrollY;
                            // Cancel any in-progress close animation
                            if (closeTimeoutRef.current) {
                                clearTimeout(closeTimeoutRef.current);
                                closeTimeoutRef.current = null;
                                setClosingDetail(false);
                                setCollapseTransition(null);
                            }
                            setFeedIndex(itemFeedIndex);
                            // Set text color and product detail mode immediately
                            const tappedItem = feedItems[itemFeedIndex];
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
                                setExpandTransition({
                                    rect: cardData.rect,
                                    bgStyle: cardData.bgGradient,
                                    imgRect: cardData.imgRect,
                                    imgSrc: cardData.imgSrc,
                                    imgAR: cardData.imgAR,
                                    hasVariants: (tappedItem?.variants?.length || 0) > 1,
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
                            </motion.div>
                            </AnimatePresence>
                        )}

                        {/* Product detail page - visible when feed is active */}
                        {feedActive && feedItems[feedIndex]?.type === 'product' && (
                            <ProductDetailPage
                                item={feedItems[feedIndex]}
                                onAddToCart={async (productId, variantId, quantity) => {
                                    await handleAddToCart(productId, variantId, quantity);
                                }}
                                onClose={closeProductDetail}
                                onOpenCart={() => sendToCommerce({ type: 'OPEN_CART' })}
                                closing={closingDetail}
                                storeLocations={storeLocations}
                            />
                        )}

                        {/* Footer */}
                        {!feedActive && <Footer />}
                    </motion.div>
            )}
            </AnimatePresence>

            {/* Expanding gradient transition overlay */}
            {expandTransition && (() => {
                const ir = expandTransition.imgRect;
                const wideLayout = window.matchMedia('(min-aspect-ratio: 4/3) and (min-width: 768px)').matches;
                // Compute target image size to match ProductDetailPage's objectFit:contain rendering
                const imgAR = expandTransition.imgAR || 1;
                const cardAR = ir ? ir.width / ir.height : 1;
                // On wide, toggle is outside the image section so container is full height
                const togglePx = wideLayout ? 0 : (expandTransition.hasVariants ? 52 : 0);
                // Detail page container dimensions
                const detailW = wideLayout ? window.innerWidth * 0.5 : window.innerWidth;
                const detailH = wideLayout ? window.innerHeight : (window.innerHeight * 0.38 - togglePx);
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
                    : (window.innerHeight * 0.38 / 2) + toggleOffset;
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
                                height: wideLayout ? window.innerHeight : window.innerHeight * 0.38,
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
                                zIndex: 55,
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
                                        zIndex: 56,
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
                                        zIndex: 56,
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
                // Compute contain-fit size matching the detail page container
                const cDetailW = wideLayout ? window.innerWidth * 0.5 : window.innerWidth;
                const cDetailH = wideLayout ? window.innerHeight : (window.innerHeight * 0.38);
                const cDetailAR = cDetailW / cDetailH;
                const cContainW = collapseImgAR > cDetailAR ? cDetailW : cDetailH * collapseImgAR;
                const cContainH = collapseImgAR > cDetailAR ? cDetailW / collapseImgAR : cDetailH;
                const imgSize = collapseImgAR > collapseContainerAR ? cContainH : cContainW;
                const cardCenterX = tr.left + tr.width / 2;
                const cardCenterY = tr.top + tr.height / 2;
                const screenCenterX = window.innerWidth / 2;
                const screenCenterY = window.innerHeight * 0.38 / 2;
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
                            zIndex: 56,
                            objectFit: 'contain',
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
                            zIndex: 56,
                            objectFit: 'cover',
                            borderRadius: 12,
                            pointerEvents: 'none',
                            willChange: 'transform',
                        }}
                    />
                );
            })()}



            <Helmet>
                <title>{pageTitle || 'Surreal Creamery x tokidoki | Shop'}</title>
                <meta name="description" content={pageDescription || "Shop exclusive tokidoki x Surreal Creamery collaboration. Limited edition desserts, blind box collectibles, and more!"} />
            </Helmet>

            <Box sx={{
                minHeight: (isDesserts || showProductModal) ? 0 : '100vh',
                backgroundColor: 'white',
                overflowX: 'hidden',
                // Hide main content on mobile when swiper/kiosk is active
                display: isDesserts ? { xs: 'none', md: 'block' } : 'block',
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
                                        
                                        // 1. Free Shipping
                                        allDiscounts.push({
                                            id: 'free-shipping',
                                            type: 'shipping',
                                            title: `Free Shipping for orders over $${REWARDS_CONFIG.freeShipping.threshold}`,
                                            shortTitle: 'Free Shipping',
                                            threshold: REWARDS_CONFIG.freeShipping.threshold,
                                            current: cartTotal,
                                            progress: shippingProgress.progress,
                                            unlocked: shippingProgress.unlocked,
                                            remaining: shippingProgress.remaining,
                                            priority: 3
                                        });
                                        
                                        // 2. Order Discounts (percentage off)
                                        orderDiscounts?.forEach(discount => {
                                            const current = cartTotal;
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
                        
                        {/* Continue Exploring Section */}
                        <Container maxWidth="md" sx={{ mt: 4, px: 2 }}>
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

                {isMerchandise && (
                <motion.div
                    key="merchandise"
                    variants={pageTransitionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    style={{ width: '100%' }}
                >
                    {/* MERCHANDISE CATALOG VIEW - Sections by subcategory */}
                    <Box sx={{ mb: 6 }}>
                        {/* Breadcrumb Navigation */}
                        <Container maxWidth="md" sx={{ pt: 2, pb: 1 }}>
                            <Box component="nav" aria-label="Breadcrumb" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                <Typography
                                    component="a"
                                    role="link"
                                    tabIndex={0}
                                    onClick={() => navigate('/')}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/'); } }}
                                    sx={{
                                        color: 'text.secondary',
                                        cursor: 'pointer',
                                        textDecoration: 'none',
                                        '&:hover, &:focus-visible': { textDecoration: 'underline' },
                                        '&:focus-visible': { outline: '2px solid #1976d2', outlineOffset: 2, borderRadius: 0.5 },
                                    }}
                                >
                                    Shop
                                </Typography>
                                <Typography aria-hidden="true" sx={{ color: 'text.secondary' }}>/</Typography>
                                <Typography aria-current="page" sx={{ fontWeight: 600 }}>
                                    {pageTitle}
                                </Typography>
                            </Box>
                        </Container>

                        <Container maxWidth="md" sx={{ mb: 4 }}>

                            {/* Subcategory Navigation Tiles - Click to scroll to section */}
                            {/* Mobile: Full-width 16:9 stacked, Desktop: 2-column grid */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: { xs: 'column', md: 'row' },
                                    flexWrap: { xs: 'nowrap', md: 'wrap' },
                                    gap: { xs: 2, md: 2 },
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
                                                width: { xs: '100%', md: 'calc(50% - 8px)' }
                                            }}
                                        >
                                            <Box
                                                role="link"
                                                tabIndex={0}
                                                aria-label={`Jump to ${subcat.title} section`}
                                                onClick={() => scrollToSection(subcat.id)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollToSection(subcat.id); } }}
                                                sx={{
                                                    cursor: 'pointer',
                                                    '&:hover, &:focus-visible': { opacity: 0.8 },
                                                    '&:focus-visible': { outline: '2px solid #1976d2', outlineOffset: 2, borderRadius: 2 },
                                                }}
                                            >
                                                <Box sx={{
                                                    position: 'relative',
                                                    borderRadius: 2,
                                                    overflow: 'hidden',
                                                    paddingTop: getAspectRatioPadding(subcat.imageAspectRatio),
                                                    backgroundColor: 'grey.200'
                                                }}>
                                                    <img
                                                        src={subcat.image}
                                                        alt={subcat.title}
                                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                    {/* Category title overlay */}
                                                    <Box sx={{
                                                        position: 'absolute',
                                                        bottom: 0,
                                                        left: 0,
                                                        right: 0,
                                                        background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                                                        p: 2,
                                                        pt: 4
                                                    }}>
                                                        <Typography
                                                            variant="h6"
                                                            sx={{
                                                                color: 'white',
                                                                fontWeight: 700,
                                                                textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                                                            }}
                                                        >
                                                            {subcat.title}
                                                        </Typography>
                                                    </Box>
                                                    {/* ZONE 1: Banner on subcategory tile */}
                                                    <DiscountZonePlaceholder
                                                        zone={1}
                                                        variant="banner"
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

                        {/* "Other" Section - Products attached to Level 1 or unmatched */}
                        {productsBySubcategory['_other'] && productsBySubcategory['_other'].length > 0 && (
                            <Box
                                id="section-other"
                                sx={{ scrollMarginTop: '80px' }}
                            >
                                <Section
                                    title="Other"
                                    description="Additional items"
                                    products={productsBySubcategory['_other']}
                                    onProductClick={handleChooseProduct}
                                    showDivider={true}
                                />
                            </Box>
                        )}
                    </Box>
                </motion.div>
                )}
                </AnimatePresence>
                )}
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
                    // Single variant product - just use the product name (no variant suffix)
                    const fullName = variantInfo.name;
                    
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
                    // No variant info - pass product with availableVariants set from variants
                    productForModal = {
                        ...selectedProduct,
                        availableVariants: selectedProduct.variants?.length > 1 ? selectedProduct.variants : null
                    };
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
                        preSelectedModifier={preSelectedModifierRef.current}
                        storeLocations={storeLocations}
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
