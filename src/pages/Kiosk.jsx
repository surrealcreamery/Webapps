import React, { useContext, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, Container, Modal, IconButton, Chip } from '@mui/material';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { useShopify } from '@/contexts/commerce/ShopifyContext_GraphQL';
import { useNavigate, useLocation } from 'react-router-dom';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import { motion } from 'framer-motion';

import { CartDrawer } from '@/components/commerce/CartDrawer';
import { useDiscounts } from '@/components/commerce/useDiscounts';
import { useKioskWebSocket } from '@/hooks/useKioskWebSocket';
import Footer from '@/components/footer/commerce/commerceFooter';
import { useCatalog } from '@/contexts/commerce/CatalogContext';
import { getTextColorForBackground, getItemBackground, resolveDisplayModifiers } from '@/state/catalog/catalogUtils';
import { useLocationAvailability } from '@/hooks/useLocationAvailability';

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x400/e0e0e0/666666?text=No+Image';
const TERMINAL_API_URL = 'https://oquxxk2q56me3ve7mk7nz2gav40apced.lambda-url.us-east-1.on.aws';

// ── Helpers ──




// ── KioskProductDetailPage ──

const KioskProductDetailPage = ({ item, onAddToCart, onClose, onOpenCart, closing, storeLocations = [] }) => {
    const product = item?.product || item;
    const variants = product?.variants || [];
    const [selectedVariantId, setSelectedVariantId] = useState(
        variants.find(v => v.availableForSale !== false)?.id || variants[0]?.id || product?.variantId
    );
    const [quantity, setQuantity] = useState(1);
    const [addingToCart, setAddingToCart] = useState(false);
    const [contentVisible, setContentVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setContentVisible(true), 250);
        return () => clearTimeout(timer);
    }, []);

    const selectedVariant = variants.find(v => v.id === selectedVariantId) || variants[0];
    const displayPrice = selectedVariant?.price
        ? `$${parseFloat(selectedVariant.price).toFixed(2)}`
        : product?.price ? `$${parseFloat(product.price).toFixed(2)}` : '';
    const { available: availableAtLocation, locationName } = useLocationAvailability(selectedVariant, product, storeLocations);
    const isAvailable = (item?.inventory?.trackInventory
        ? item.inventory.inStock
        : selectedVariant?.availableForSale !== false) && availableAtLocation;

    const handleAdd = async () => {
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

    return (
        <>
            {!closing && (
                <>
                    <Box sx={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 110,
                        background: item?.gradientEndColor || item?.backgroundColor || '#1a1a2e',
                    }} />
                    <Box sx={{
                        display: 'flex',
                        position: 'fixed', top: 0, left: 0, right: 0,
                        height: '38dvh', zIndex: 111,
                        background: backgroundStyle,
                        alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                    }}>
                        {item?.image && (
                            <img
                                src={item.image}
                                alt={item.title || ''}
                                style={{
                                    width: '70%', maxWidth: '340px',
                                    aspectRatio: '1', objectFit: 'cover', borderRadius: 12,
                                }}
                            />
                        )}
                    </Box>
                </>
            )}

            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: closing ? '100%' : '0%' }}
                transition={{ duration: closing ? 0.3 : 0.4, ease: [0.22, 1, 0.36, 1] }}
                style={{
                    position: 'fixed', top: '38dvh', left: 12, right: 12, bottom: 0,
                    backgroundColor: 'white', borderRadius: '24px 24px 0 0',
                    zIndex: 120, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 1 }}>
                    <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'grey.300' }} />
                </Box>

                <Box sx={{
                    flex: 1, overflowY: 'auto', px: 3, pb: 2,
                    opacity: (contentVisible && !closing) ? 1 : 0,
                    transform: (contentVisible && !closing) ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'opacity 0.35s ease, transform 0.35s ease',
                }}>
                    <Typography sx={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.2, mb: 0.5 }}>
                        {item?.title || product?.name}
                    </Typography>
                    <Typography sx={{ fontSize: '1.6rem', fontWeight: 500, color: 'grey.600', mb: 1.5 }}>
                        {displayPrice}
                    </Typography>

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

                    {item?.displayModifiers?.length > 0 && (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 3 }}>
                            {item.displayModifiers.flatMap((dm) =>
                                dm.options.map((opt) => (
                                    <Box key={opt.optionId} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        {opt.image && (
                                            <Box component="img" src={opt.image} alt={opt.name}
                                                sx={{ width: '100%', aspectRatio: '1', borderRadius: 2, objectFit: 'cover', mb: 0.5 }} />
                                        )}
                                        <Typography sx={{ fontSize: '1.4rem', textAlign: 'center', color: 'grey.700', lineHeight: 1.2 }}>
                                            {opt.name}
                                        </Typography>
                                    </Box>
                                ))
                            )}
                        </Box>
                    )}

                    {product?.description && (
                        <Typography sx={{ fontSize: '1.6rem', color: 'grey.600', lineHeight: 1.6, mb: 3 }}>
                            {product.description}
                        </Typography>
                    )}

                    {variants.length > 1 && (
                        <Box sx={{ mb: 3 }}>
                            <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, mb: 1 }}>Options</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {variants.map((variant) => (
                                    <Button key={variant.id}
                                        variant={selectedVariantId === variant.id ? 'contained' : 'outlined'}
                                        size="small" onClick={() => setSelectedVariantId(variant.id)}
                                        sx={{
                                            textTransform: 'none', borderRadius: 2, px: 2, py: 0.75, fontSize: '1.6rem',
                                            bgcolor: selectedVariantId === variant.id ? 'black' : 'transparent',
                                            color: selectedVariantId === variant.id ? 'white' : 'black',
                                            borderColor: 'grey.400',
                                            '&:hover': {
                                                bgcolor: selectedVariantId === variant.id ? 'grey.800' : 'grey.100',
                                                borderColor: 'grey.600',
                                            },
                                        }}
                                    >
                                        {variant.title || variant.name || `Option ${variants.indexOf(variant) + 1}`}
                                    </Button>
                                ))}
                            </Box>
                        </Box>
                    )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.5, px: 3, py: 2, borderTop: '1px solid', borderColor: 'grey.200', bgcolor: 'white' }}>
                    <IconButton onClick={onClose} sx={{ border: '1px solid', borderColor: 'grey.300', borderRadius: 2, flexShrink: 0, aspectRatio: '1' }}>
                        <CloseIcon />
                    </IconButton>
                    <Button variant="contained" fullWidth onClick={handleAdd}
                        disabled={addingToCart || !selectedVariantId || !isAvailable}
                        sx={{
                            py: 1.5, fontSize: '1.6rem', fontWeight: 600, textTransform: 'none', borderRadius: 3,
                            bgcolor: isAvailable ? 'black' : 'grey.400',
                            '&:hover': { bgcolor: isAvailable ? 'grey.800' : 'grey.400' },
                        }}
                    >
                        {addingToCart ? <CircularProgress size={24} color="inherit" />
                            : isAvailable ? 'Add to Cart'
                            : !availableAtLocation ? `Not Available at ${locationName}`
                            : 'Out of Stock'}
                    </Button>
                </Box>
            </motion.div>
        </>
    );
};

// ── ScrollableProductList ──

const ScrollableProductList = ({ containers, selectedIndex, onSelect, isActive, textColor = 'black' }) => {
    const containerRef = useRef(null);
    const [pageIndex, setPageIndex] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(4);
    const [slideOffset, setSlideOffset] = useState(0);
    const [isSliding, setIsSliding] = useState(false);

    useEffect(() => {
        const calculateItemsPerPage = () => {
            const el = containerRef.current;
            if (!el) return;
            const containerWidth = el.clientWidth;
            const itemSize = 64;
            const gap = 12;
            const arrowWidth = 72;
            const availableWidth = containerWidth - arrowWidth;
            const count = Math.floor((availableWidth + gap) / (itemSize + gap));
            setItemsPerPage(Math.max(1, count));
        };
        calculateItemsPerPage();
        window.addEventListener('resize', calculateItemsPerPage);
        return () => window.removeEventListener('resize', calculateItemsPerPage);
    }, []);

    const totalItems = containers?.length || 0;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const canGoBack = pageIndex > 0;
    const canGoForward = pageIndex < totalPages - 1;

    useEffect(() => {
        if (selectedIndex == null || itemsPerPage === 0) return;
        const targetPage = Math.floor(selectedIndex / itemsPerPage);
        if (targetPage !== pageIndex && targetPage >= 0 && targetPage < totalPages) {
            setPageIndex(targetPage);
        }
    }, [selectedIndex, itemsPerPage, totalPages]);

    const startIndex = pageIndex * itemsPerPage;
    const visibleItems = (containers || []).slice(startIndex, startIndex + itemsPerPage);
    const slideWidth = itemsPerPage * 76;

    const goToPrevPage = (e) => {
        e.stopPropagation();
        if (isSliding) return;
        setIsSliding(true);
        setSlideOffset(slideWidth);
        setTimeout(() => {
            setPageIndex(prev => Math.max(0, prev - 1));
            setSlideOffset(0);
            setIsSliding(false);
        }, 250);
    };

    const goToNextPage = (e) => {
        e.stopPropagation();
        if (isSliding) return;
        setIsSliding(true);
        setSlideOffset(-slideWidth);
        setTimeout(() => {
            setPageIndex(prev => Math.min(totalPages - 1, prev + 1));
            setSlideOffset(0);
            setIsSliding(false);
        }, 250);
    };

    const hasMultiplePages = totalPages > 1;

    return (
        <Box ref={containerRef} sx={{ display: 'flex', flexDirection: 'row', pointerEvents: 'auto', overflow: 'hidden', overscrollBehaviorX: 'contain', touchAction: 'pan-y pinch-zoom' }}>
            {hasMultiplePages && (
                <Box onClick={canGoBack ? goToPrevPage : undefined} sx={{ flexShrink: 0, width: 48, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', cursor: canGoBack ? 'pointer' : 'default', opacity: canGoBack ? (isSliding ? 0 : 1) : 0, transition: 'opacity 0.15s ease-out', mr: 0.5 }}>
                    <IconButton aria-label="Previous products" disabled={!canGoBack} sx={{ bgcolor: 'transparent', border: `2px solid ${textColor}`, color: textColor, '&:hover': { bgcolor: textColor === 'white' || textColor === '#ffffff' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }, width: 40, height: 40 }}>
                        <ChevronLeftIcon sx={{ color: textColor }} />
                    </IconButton>
                </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, flex: 1, minWidth: 0, justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, transform: `translateX(${slideOffset}px)`, transition: isSliding ? 'transform 0.25s ease-out' : 'none' }}>
                    {visibleItems.map((container, idx) => {
                        const actualIndex = startIndex + idx;
                        const isSelected = actualIndex === selectedIndex;
                        const baseOpacity = isActive ? 1 : 0;
                        const baseScale = isActive ? 'scale(1)' : 'scale(0.8)';
                        const populateDelay = 300 + idx * 60;
                        return (
                            <Box key={`${pageIndex}-${container.id}`} onClick={(e) => { e.stopPropagation(); onSelect?.(actualIndex); }} sx={{ flexShrink: 0, width: 64, textAlign: 'center', cursor: 'pointer', opacity: isSliding ? 0 : baseOpacity, transform: isSliding ? 'scale(0.8)' : baseScale, transition: `opacity 0.2s ease-out ${populateDelay}ms, transform 0.2s ease-out ${populateDelay}ms` }}>
                                <Box sx={{ width: 64, height: 64, borderRadius: 2, overflow: 'hidden', mb: 0.5, outline: isSelected ? `2px solid ${textColor}` : 'none', outlineOffset: -2 }}>
                                    <img src={container.image || 'https://placehold.co/100x100/e0e0e0/666?text=...'} alt={container.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </Box>
                                <Typography title={container.title} sx={{ fontSize: '1.6rem', fontWeight: isSelected ? 700 : 500, color: textColor, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {container.title}
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
            {hasMultiplePages && (
                <Box onClick={canGoForward ? goToNextPage : undefined} sx={{ flexShrink: 0, width: 48, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', cursor: canGoForward ? 'pointer' : 'default', opacity: canGoForward ? (isSliding ? 0 : 1) : 0, transition: 'opacity 0.15s ease-out', ml: 0.5 }}>
                    <IconButton aria-label="Next products" disabled={!canGoForward} sx={{ bgcolor: 'transparent', border: `2px solid ${textColor}`, color: textColor, '&:hover': { bgcolor: textColor === 'white' || textColor === '#ffffff' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }, width: 40, height: 40 }}>
                        <ChevronRightIcon sx={{ color: textColor }} />
                    </IconButton>
                </Box>
            )}
            {(!containers || containers.length === 0) && (
                <Typography sx={{ color: '#888', py: 2 }}>No sub-categories available</Typography>
            )}
        </Box>
    );
};

// ── BottomNavWithButton ──

const BottomNavWithButton = ({ slide, isActive, containerSizeIndex, onSelectContainerSize, currentProduct, onProductClick, onAddToCart, textColor = 'black', storeLocations = [] }) => {
    const thumbnailRef = useRef(null);
    const [buttonMargin, setButtonMargin] = useState(80);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickAddQuantity, setQuickAddQuantity] = useState(1);
    const [selectedVariantId, setSelectedVariantId] = useState(null);
    const [addingToCart, setAddingToCart] = useState(false);

    useEffect(() => {
        if (currentProduct) {
            setQuickAddQuantity(1);
            const variants = currentProduct.variants || [];
            const defaultVariantId = variants.length > 0 ? variants[0].id : currentProduct.variantId;
            setSelectedVariantId(defaultVariantId);
        }
    }, [currentProduct?.id]);

    const handleQuickAddToCart = async () => {
        if (!currentProduct || !selectedVariantId) return;
        setAddingToCart(true);
        try {
            await onAddToCart?.(selectedVariantId, quickAddQuantity, []);
            setShowQuickAdd(false);
            setQuickAddQuantity(1);
        } catch (error) {
            console.error('Error adding to cart:', error);
        } finally {
            setAddingToCart(false);
        }
    };

    const variants = currentProduct?.variants || [];
    const selectedVariant = variants.find(v => v.id === selectedVariantId) || variants[0];
    const displayPrice = selectedVariant?.price
        ? `$${parseFloat(selectedVariant.price).toFixed(2)}`
        : currentProduct?.price ? `$${parseFloat(currentProduct.price).toFixed(2)}` : '';
    const { available: availableAtLocation, locationName } = useLocationAvailability(selectedVariant, currentProduct, storeLocations);
    const isAvailable = (selectedVariant?.availableForSale !== false) && availableAtLocation;

    useEffect(() => {
        const calculateMargin = () => {
            if (!thumbnailRef.current) return;
            const windowHeight = window.innerHeight;
            const thumbnailRect = thumbnailRef.current.getBoundingClientRect();
            const imageContainer = document.querySelector('[data-product-image-container="true"]');
            const actualImage = imageContainer?.querySelector('img');
            let imageBottom;
            if (actualImage) { imageBottom = actualImage.getBoundingClientRect().bottom; }
            else { imageBottom = windowHeight * 0.65; }
            const gap = thumbnailRect.top - imageBottom;
            const margin = gap > 32 ? gap / 2 : 16;
            setButtonMargin(margin);
        };
        calculateMargin();
        window.addEventListener('resize', calculateMargin);
        const timer = setTimeout(calculateMargin, 200);
        return () => { window.removeEventListener('resize', calculateMargin); clearTimeout(timer); };
    }, [isActive]);

    return (
        <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, px: 2, pb: 4, pointerEvents: isActive ? 'auto' : 'none', zIndex: isActive ? 110 : 100, visibility: isActive ? 'visible' : 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: `${buttonMargin}px` }}>
                <Button variant="text" size="small" endIcon={<ChevronRightIcon />} onClick={() => currentProduct && onProductClick?.(currentProduct.id)} sx={{ bgcolor: 'transparent', color: textColor, border: 'none', textTransform: 'none', fontSize: '1.4rem', fontWeight: 600, px: 1, py: 0.5, opacity: isActive && currentProduct ? 1 : 0, transition: 'opacity 0.3s ease-out 0.2s', '&:hover': { bgcolor: 'transparent' } }}>
                    View Details
                </Button>
                <Button variant="contained" size="small" startIcon={isAvailable ? <ShoppingCartIcon sx={{ fontSize: '1.4rem' }} /> : null} onClick={() => isAvailable && setShowQuickAdd(true)} disabled={!isAvailable} sx={{ bgcolor: isAvailable ? 'black' : 'grey.400', color: 'white', textTransform: 'none', fontSize: '1.4rem', fontWeight: 600, px: 2, py: 0.5, borderRadius: 2, opacity: isActive && currentProduct ? 1 : 0, transition: 'opacity 0.3s ease-out 0.25s', '&:hover': { bgcolor: isAvailable ? 'grey.800' : 'grey.400' }, '&.Mui-disabled': { color: 'white', bgcolor: 'grey.400' } }}>
                    {isAvailable ? 'Add to Cart' : !availableAtLocation ? `Not at ${locationName}` : 'Out of Stock'}
                </Button>
            </Box>
            <Modal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ bgcolor: 'white', borderRadius: 3, p: 3, mx: 2, maxWidth: 400, width: '100%', maxHeight: '80vh', overflow: 'auto', outline: 'none' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{currentProduct?.name}</Typography>
                    <Typography variant="body1" sx={{ color: 'grey.600', mb: 2 }}>{displayPrice}</Typography>
                    {variants.length > 1 && (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Select Option</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {variants.map((variant) => (
                                    <Button key={variant.id} variant={selectedVariantId === variant.id ? 'contained' : 'outlined'} size="small" onClick={() => setSelectedVariantId(variant.id)} sx={{ textTransform: 'none', borderRadius: 2, bgcolor: selectedVariantId === variant.id ? 'black' : 'transparent', color: selectedVariantId === variant.id ? 'white' : 'black', borderColor: 'black', '&:hover': { bgcolor: selectedVariantId === variant.id ? 'grey.800' : 'grey.100', borderColor: 'black' } }}>
                                        {variant.title || variant.name || `Option ${variants.indexOf(variant) + 1}`}
                                    </Button>
                                ))}
                            </Box>
                        </Box>
                    )}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Quantity</Typography>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', border: '1px solid', borderColor: 'grey.300', borderRadius: 2 }}>
                            <IconButton onClick={() => setQuickAddQuantity(q => Math.max(1, q - 1))} disabled={quickAddQuantity <= 1} size="small"><RemoveIcon /></IconButton>
                            <Typography sx={{ px: 2, fontWeight: 600, minWidth: 40, textAlign: 'center' }}>{quickAddQuantity}</Typography>
                            <IconButton onClick={() => setQuickAddQuantity(q => q + 1)} size="small"><AddIcon /></IconButton>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button variant="outlined" onClick={() => setShowQuickAdd(false)} sx={{ flex: 1, textTransform: 'none', borderColor: 'grey.300', color: 'grey.700' }}>Cancel</Button>
                        <Button variant="contained" onClick={handleQuickAddToCart} disabled={addingToCart || !selectedVariantId} sx={{ flex: 2, textTransform: 'none', bgcolor: 'black', '&:hover': { bgcolor: 'grey.800' } }}>
                            {addingToCart ? <CircularProgress size={20} color="inherit" /> : 'Add to Cart'}
                        </Button>
                    </Box>
                </Box>
            </Modal>
            <Box ref={thumbnailRef}>
                <ScrollableProductList containers={slide.containers} selectedIndex={containerSizeIndex} onSelect={(idx) => onSelectContainerSize?.(slide.id, idx)} isActive={isActive} textColor={textColor} />
            </Box>
        </Box>
    );
};

// ── FullScreenSwiper ──

const FullScreenSwiper = ({ slides = [], currentSlide, onSlideChange, selectedProducts = {}, onSelectProduct, selectedContainerSize = {}, onSelectContainerSize, onProductClick, onAddToCart }) => {
    const setCurrentSlide = onSlideChange;
    const containerRef = useRef(null);
    const isScrollingRef = useRef(false);
    const touchStartRef = useRef(null);
    const touchEndRef = useRef(null);
    const isHorizontalGestureRef = useRef(false);

    const [showFooter, setShowFooter] = useState(false);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        if (slides.length > 0 && !loaded) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setLoaded(true));
            });
        }
    }, [slides.length > 0]);

    const [activeGradient, setActiveGradient] = useState({
        startColor: '#ffffff',
        endColor: '#ffffff',
        direction: null,
        type: 'solid'
    });
    const [previousSlide, setPreviousSlide] = useState(currentSlide);

    const maxSlide = slides.length - 1;

    const prefersReducedMotion = typeof window !== 'undefined'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleTouchStart = (e) => {
            touchEndRef.current = null;
            isHorizontalGestureRef.current = false;
            touchStartRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        };

        const handleTouchMove = (e) => {
            if (!touchStartRef.current) return;
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = Math.abs(currentX - touchStartRef.current.x);
            const deltaY = Math.abs(currentY - touchStartRef.current.y);
            if (deltaX > deltaY && deltaX > 10) {
                isHorizontalGestureRef.current = true;
            } else if (deltaY > deltaX && deltaY > 10) {
                e.preventDefault();
            }
            touchEndRef.current = { x: currentX, y: currentY };
        };

        const handleTouchEnd = () => {
            if (!touchStartRef.current || !touchEndRef.current) return;
            const distanceX = touchStartRef.current.x - touchEndRef.current.x;
            const distanceY = touchStartRef.current.y - touchEndRef.current.y;

            if (isHorizontalGestureRef.current) {
                isHorizontalGestureRef.current = false;
                const currentSlideData = slides[currentSlide];
                if (!currentSlideData?.containers?.length) return;
                const currentContainerIndex = selectedContainerSize[currentSlideData.id] ?? 0;
                const maxContainer = currentSlideData.containers.length - 1;
                if (distanceX > 50) {
                    const nextIndex = Math.min(currentContainerIndex + 1, maxContainer);
                    if (nextIndex !== currentContainerIndex) onSelectContainerSize?.(currentSlideData.id, nextIndex);
                } else if (distanceX < -50) {
                    const prevIndex = Math.max(currentContainerIndex - 1, 0);
                    if (prevIndex !== currentContainerIndex) onSelectContainerSize?.(currentSlideData.id, prevIndex);
                }
                return;
            }

            if (distanceY > 50) {
                if (showFooter) { /* already on footer */ }
                else if (currentSlide >= maxSlide) setShowFooter(true);
                else onSlideChange(prev => Math.min(prev + 1, maxSlide));
            } else if (distanceY < -50) {
                if (showFooter) setShowFooter(false);
                else onSlideChange(prev => Math.max(prev - 1, 0));
            }
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });
        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [maxSlide, onSlideChange, slides, currentSlide, selectedContainerSize, onSelectContainerSize]);

    useEffect(() => {
        if (!slides.length) return;
        const slide = slides[currentSlide];
        if (!slide) return;
        const containerSizeIndex = selectedContainerSize[slide.id] ?? 0;
        const selectedContainer = slide.containers?.[containerSizeIndex];
        if (selectedContainer) {
            const bgColor = selectedContainer.backgroundColor || '#ffffff';
            const gradientDir = selectedContainer.gradientDirection;
            const startColor = selectedContainer.gradientStartColor || bgColor;
            const endColor = selectedContainer.gradientEndColor || bgColor;
            let type = 'solid';
            let angle = null;
            if (gradientDir) {
                if (gradientDir.startsWith('radial:')) type = 'radial';
                else if (gradientDir.startsWith('linear:')) {
                    type = 'linear';
                    const parts = gradientDir.split(':');
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
                    angle = Math.round(Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;
                } else if (gradientDir.startsWith('to-')) {
                    type = 'linear';
                    const legacyAngles = {
                        'to-bottom-right': 135, 'to-bottom-left': 225, 'to-bottom': 180,
                        'to-right': 90, 'to-top-right': 45, 'to-top-left': 315,
                        'to-top': 0, 'to-left': 270,
                    };
                    angle = legacyAngles[gradientDir] || 135;
                }
            }
            setActiveGradient({ startColor, endColor, angle, type, bgColor });
        }
        setPreviousSlide(currentSlide);
    }, [currentSlide, slides, selectedContainerSize]);

    useEffect(() => {
        if (currentSlide < maxSlide) setShowFooter(false);
    }, [currentSlide, maxSlide]);

    const goToSlide = (index) => {
        setCurrentSlide(Math.max(0, Math.min(index, maxSlide)));
    };

    const handleWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isScrollingRef.current) return;
        if (e.deltaY > 20) {
            isScrollingRef.current = true;
            if (showFooter) { /* nothing */ }
            else if (currentSlide >= maxSlide) setShowFooter(true);
            else setCurrentSlide(prev => Math.min(prev + 1, maxSlide));
            setTimeout(() => { isScrollingRef.current = false; }, 600);
        } else if (e.deltaY < -20) {
            isScrollingRef.current = true;
            if (showFooter) setShowFooter(false);
            else setCurrentSlide(prev => Math.max(prev - 1, 0));
            setTimeout(() => { isScrollingRef.current = false; }, 600);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            if (showFooter) { /* nothing */ }
            else if (currentSlide >= maxSlide) setShowFooter(true);
            else setCurrentSlide(prev => Math.min(prev + 1, maxSlide));
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            if (showFooter) setShowFooter(false);
            else setCurrentSlide(prev => Math.max(prev - 1, 0));
        }
    };

    if (slides.length === 0) return null;

    // Helper function to compute background style
    const getBackgroundStyle = (container) => {
        const bgColor = container?.backgroundColor || '#ffffff';
        const gradientDir = container?.gradientDirection;
        const gradientStartColor = container?.gradientStartColor || bgColor;
        const gradientEndColor = container?.gradientEndColor || bgColor;
        if (!gradientDir) return bgColor;
        if (gradientDir.startsWith('linear:') || gradientDir.startsWith('radial:')) {
            const parts = gradientDir.split(':');
            const type = parts[0];
            if (type === 'radial') {
                const position = parts[1]?.replace('-', ' ') || 'center';
                return `radial-gradient(circle at ${position}, ${gradientStartColor} 0%, ${gradientEndColor} 100%)`;
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
            return `linear-gradient(${angle}deg, ${gradientStartColor} 0%, ${gradientEndColor} 100%)`;
        }
        const legacyAngles = {
            'to-bottom-right': '135deg', 'to-bottom-left': '225deg', 'to-bottom': '180deg',
            'to-right': '90deg', 'to-top-right': '45deg', 'to-top-left': '315deg',
            'to-top': '0deg', 'to-left': '270deg',
        };
        const a = legacyAngles[gradientDir];
        return a ? `linear-gradient(${a}, ${gradientStartColor} 0%, ${gradientEndColor} 100%)` : bgColor;
    };

    return (
        <Box
            ref={containerRef}
            role="region"
            aria-roledescription="carousel"
            aria-label="Category slides"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onWheel={handleWheel}
            sx={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                height: '100dvh', width: '100vw',
                overflow: 'hidden', zIndex: 5,
                overscrollBehavior: 'none',
                touchAction: 'none',
                '&:focus': { outline: '3px solid #005fcc', outlineOffset: '-3px' },
            }}
        >
            {/* Background gradients + container images */}
            {slides.map((slide, slideIndex) => {
                const containerSizeIndex = selectedContainerSize[slide.id] ?? 0;
                const isSlideActive = slideIndex === currentSlide;
                const isSlidePrevious = slideIndex === previousSlide && previousSlide !== currentSlide;

                return (slide.containers || []).map((container, containerIndex) => {
                    const isContainerSelected = containerIndex === containerSizeIndex;
                    const isFullyActive = isSlideActive && isContainerSelected;
                    const backgroundStyle = getBackgroundStyle(container);
                    const showBg = loaded && isFullyActive;
                    const showImg = loaded && isFullyActive;

                    return (
                        <Box
                            key={`bg-${slide.id}-${container.id}`}
                            sx={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                background: backgroundStyle,
                                opacity: showBg ? 1 : 0,
                                transition: prefersReducedMotion ? 'none' : 'opacity 0.6s ease-out',
                                pointerEvents: 'none',
                            }}
                        >
                            {container?.image && (
                                <Box
                                    data-product-image-container="true"
                                    sx={{
                                        position: 'absolute', top: '220px', bottom: '200px', left: 0, right: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: showImg ? 1 : 0,
                                        transform: showImg
                                            ? 'scale(1) translateY(0)'
                                            : (isSlidePrevious ? 'scale(0.85) translateY(0)' : 'scale(1.1) translateY(20px)'),
                                        transition: prefersReducedMotion ? 'none' : 'opacity 0.5s ease-out 0.1s, transform 0.5s ease-out 0.1s',
                                    }}
                                >
                                    <Box sx={{ width: '70%', maxWidth: '300px', aspectRatio: '1', borderRadius: 3, overflow: 'hidden' }}>
                                        <img src={container.image} alt={container.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    );
                });
            })}

            {/* Fixed bottom content */}
            {slides.map((slide, index) => {
                const containerSizeIndex = selectedContainerSize[slide.id] ?? 0;
                const selectedContainer = slide.containers?.[containerSizeIndex];
                const currentProduct = selectedContainer?.product || selectedContainer;
                const isActive = index === currentSlide;
                const containerTextColor = selectedContainer?.textColor || getTextColorForBackground(selectedContainer?.backgroundColor);
                return (
                    <BottomNavWithButton
                        key={`bottom-${slide.id}`}
                        slide={slide}
                        isActive={isActive && loaded}
                        containerSizeIndex={containerSizeIndex}
                        onSelectContainerSize={onSelectContainerSize}
                        currentProduct={currentProduct}
                        onProductClick={onProductClick}
                        onAddToCart={onAddToCart}
                        textColor={containerTextColor}
                    />
                );
            })}

            {/* Footer slide */}
            <Box
                sx={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    transform: showFooter ? 'translateY(0)' : 'translateY(100%)',
                    transition: 'transform 0.4s ease-out',
                    pointerEvents: showFooter ? 'auto' : 'none',
                    zIndex: 20,
                }}
            >
                <Footer />
            </Box>
        </Box>
    );
};


// ── KioskProductCard ──

const KioskProductCard = ({ container, onProductTap }) => {
    const bgColor = container.backgroundColor || '#1a1a2e';
    const bgGradient = getItemBackground(container);
    const textColor = container.textColor || getTextColorForBackground(bgColor);
    const product = container.product || container;

    const handleClick = (e) => {
        const cardEl = e.currentTarget.querySelector('[data-card]');
        const rect = cardEl ? cardEl.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
        const imgEl = e.currentTarget.querySelector('[data-product-img]');
        const imgRect = imgEl ? imgEl.getBoundingClientRect() : null;
        const imgAR = imgEl ? imgEl.naturalWidth / imgEl.naturalHeight : 1;
        onProductTap?.(container, { rect, bgColor, bgGradient, imgRect, imgSrc: container.image, imgAR });
    };

    return (
        <Box
            data-container-id={container.id}
            onClick={handleClick}
            sx={{
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
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
                {/* Image area with split-color background */}
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
                    {container.image && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: '3%', left: '2%', right: '2%', bottom: '3%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <img
                                data-product-img
                                src={container.image}
                                srcSet={container.pwa ? `${container.pwa.sm} 480w, ${container.pwa.md} 960w` : undefined}
                                sizes={container.pwa ? '50vw' : undefined}
                                alt={container.title || ''}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </Box>
                    )}
                </Box>
                {/* Product name */}
                <Box sx={{ bgcolor: bgColor, p: 1.5, pt: 0.5, flex: 1 }}>
                    <Typography
                        sx={{
                            fontWeight: 700,
                            fontSize: '1.6rem',
                            lineHeight: 1.2,
                            color: textColor,
                        }}
                    >
                        {container.title}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

// ── KioskGridView ──

const KioskGridView = ({ categories, currentSlide, onCategoryChange, onProductTap }) => {
    const scrollRef = useRef(null);

    // Scroll to current category on mount
    useEffect(() => {
        const el = document.getElementById(`kiosk-grid-category-${currentSlide}`);
        if (el) {
            el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
    }, []); // only on mount

    // IntersectionObserver to sync category nav with scroll position
    useEffect(() => {
        const observers = [];
        categories.forEach((_, idx) => {
            const el = document.getElementById(`kiosk-grid-category-${idx}`);
            if (!el) return;
            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) onCategoryChange(idx);
                },
                { rootMargin: '-20px 0px -60% 0px', threshold: 0 }
            );
            observer.observe(el);
            observers.push(observer);
        });
        return () => observers.forEach(o => o.disconnect());
    }, [categories.length, onCategoryChange]);

    return (
        <Box
            ref={scrollRef}
            data-kiosk-grid-scroll
            sx={{
                position: 'fixed',
                top: '160px', left: 0, right: 0, bottom: 0,
                bgcolor: 'white',
                overflowY: 'auto',
                overflowX: 'hidden',
                py: 2,
                zIndex: 5,
                WebkitOverflowScrolling: 'touch',
            }}
        >
            <Box sx={{ px: 2 }}>
                {categories.map((category, catIdx) => (
                    <Box key={category.id} id={`kiosk-grid-category-${catIdx}`} sx={{ mb: 3 }}>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                gap: 2,
                            }}
                        >
                            {category.containers.map(container => (
                                <KioskProductCard
                                    key={container.id}
                                    container={container}
                                    onProductTap={onProductTap}
                                />
                            ))}
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// Kiosk Page
// ═══════════════════════════════════════════════════════════════════════════

function KioskInner() {
    const { commerceState, sendToCommerce, setActiveTextColor, setKioskCartCount, kioskViewMode } = useContext(LayoutContext);
    const {
        products: shopifyProducts,
        loading: shopifyLoading,
        error: shopifyError,
        categories,
        dessertSubcategories,
        getProductHierarchy,
        getSubcategories,
    } = useShopify();

    const navigate = useNavigate();

    // ── Catalog engine (shared state machine) ──
    const {
        catalog,
        subcategories: CATALOG_DESSERT_SUBCATEGORIES,
        storeLocations,
    } = useCatalog();

    // ── Kiosk terminal state ──
    const [kioskTerminal, setKioskTerminal] = useState(() => {
        try { const s = localStorage.getItem('kioskTerminal'); return s ? JSON.parse(s) : null; } catch { return null; }
    });
    const kioskTerminalRef = useRef(kioskTerminal);
    kioskTerminalRef.current = kioskTerminal;

    // Show code entry dialog if no terminal is set
    const [showKioskDialog, setShowKioskDialog] = useState(() => !kioskTerminal);
    const [kioskCodeInput, setKioskCodeInput] = useState('');
    const [kioskCodeLoading, setKioskCodeLoading] = useState(false);
    const [kioskCodeError, setKioskCodeError] = useState('');

    // Persist kiosk terminal info
    useEffect(() => {
        if (kioskTerminal) {
            localStorage.setItem('kioskTerminal', JSON.stringify(kioskTerminal));
        } else {
            localStorage.removeItem('kioskTerminal');
            localStorage.removeItem('surreal_kiosk_device_id');
        }
    }, [kioskTerminal]);

    // ── Debug Console ──
    const [debugLogs, setDebugLogs] = useState([]);
    const [showDebugConsole, setShowDebugConsole] = useState(false);
    const debugLogsRef = useRef([]);
    const debugFlushTimer = useRef(null);
    const debugInAddLog = useRef(false);

    useEffect(() => {
        const origLog = console.log;
        const origWarn = console.warn;
        const origError = console.error;
        const maxLogs = 200;
        const flushLogs = () => {
            debugFlushTimer.current = null;
            setDebugLogs([...debugLogsRef.current]);
        };
        const addLog = (level, args) => {
            if (debugInAddLog.current) return;
            debugInAddLog.current = true;
            try {
                const msg = args.map(a => {
                    try {
                        if (a == null) return String(a);
                        if (a instanceof Error) return `${a.message}\n${a.stack}`;
                        if (typeof a === 'object') return JSON.stringify(a, null, 1);
                        return String(a);
                    } catch { return '[unserializable]'; }
                }).join(' ');
                debugLogsRef.current = [...debugLogsRef.current.slice(-maxLogs), { level, msg, ts: Date.now() }];
                if (!debugFlushTimer.current) {
                    debugFlushTimer.current = setTimeout(flushLogs, 100);
                }
            } finally {
                debugInAddLog.current = false;
            }
        };
        console.log = (...args) => { origLog.apply(console, args); addLog('log', args); };
        console.warn = (...args) => { origWarn.apply(console, args); addLog('warn', args); };
        console.error = (...args) => { origError.apply(console, args); addLog('error', args); };
        const onError = (e) => addLog('error', [`[Uncaught] ${e.message || e}`]);
        const onRejection = (e) => addLog('error', [`[Unhandled Promise] ${e.reason?.message || e.reason || e}`]);
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        addLog('log', ['[Debug Console] Initialized']);
        return () => {
            console.log = origLog;
            console.warn = origWarn;
            console.error = origError;
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
            if (debugFlushTimer.current) clearTimeout(debugFlushTimer.current);
        };
    }, []);

    // ── Wake Lock ──
    const kioskWakeLockRef = useRef(null);
    useEffect(() => {
        let isMounted = true;
        const requestWakeLock = async () => {
            if (!('wakeLock' in navigator)) return;
            try {
                if (kioskWakeLockRef.current) await kioskWakeLockRef.current.release();
                kioskWakeLockRef.current = await navigator.wakeLock.request('screen');
                console.log('[Kiosk] Wake lock acquired');
                kioskWakeLockRef.current.addEventListener('release', () => {
                    console.log('[Kiosk] Wake lock released');
                });
            } catch (err) {
                console.warn('[Kiosk] Wake lock failed:', err.message);
            }
        };
        requestWakeLock();
        const handleVisibility = () => {
            if (isMounted && document.visibilityState === 'visible') requestWakeLock();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        const interval = setInterval(() => {
            if (isMounted && (!kioskWakeLockRef.current || kioskWakeLockRef.current.released)) requestWakeLock();
        }, 30000);
        return () => {
            isMounted = false;
            kioskWakeLockRef.current?.release().catch(() => {});
            kioskWakeLockRef.current = null;
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(interval);
        };
    }, []);

    // ── Kiosk WebSocket ──
    const [kioskCart, setKioskCart] = useState([]);
    const kioskCartRef = useRef(kioskCart);
    kioskCartRef.current = kioskCart;
    const isRemoteCartUpdateRef = useRef(false);
    const [kioskRemoteCheckout, setKioskRemoteCheckout] = useState(null);
    const kioskWsDeviceId = kioskTerminal?.kioskDeviceId || localStorage.getItem('surreal_kiosk_device_id');
    const isKioskPaired = !!kioskTerminal?.pairedDevice;
    const kioskSendForwardRef = useRef(null);
    const shopifyProductsRef = useRef(shopifyProducts);
    shopifyProductsRef.current = shopifyProducts;
    const sendToCommerceRef = useRef(sendToCommerce);
    sendToCommerceRef.current = sendToCommerce;
    const setGridDetailItemRef = useRef(null);
    const setGridDetailActiveRef = useRef(null);

    const { isConnected: kioskWsConnected, sendForward: kioskSendForward } = useKioskWebSocket({
        enabled: !!kioskTerminal && !!kioskWsDeviceId,
        deviceId: kioskWsDeviceId,
        onViewProduct: useCallback((payload) => {
            console.log('[Kiosk] view_product from POS:', payload);
            const products = shopifyProductsRef.current || [];
            const skuUpper = (payload.sku || '').toUpperCase();
            const nameLower = (payload.name || '').toLowerCase();
            const product = products.find(p =>
                (p.sku && p.sku.toUpperCase() === skuUpper) ||
                p.variants?.some(v => v.sku && v.sku.toUpperCase() === skuUpper)
            ) || products.find(p =>
                p.title?.toLowerCase() === nameLower ||
                p.name?.toLowerCase() === nameLower
            );
            if (product) {
                console.log('[Kiosk] Found product:', product.id, product.title);
                // Open as grid detail page instead of modal
                setGridDetailItemRef.current?.({
                    type: 'product',
                    id: product.id,
                    title: product.name || product.title,
                    product,
                    image: product.imageUrl || product.images?.[0]?.url,
                    catalogImages: product.images || [],
                    isMYO: (product.name || '').toLowerCase().includes('make your own'),
                    variants: product.variants || [],
                });
                setGridDetailActiveRef.current?.(true);
            }
        }, []),
        onCartSync: useCallback((payload) => {
            console.log('[Kiosk] cart_sync from POS:', payload.items?.length, 'items');
            isRemoteCartUpdateRef.current = true;
            setKioskCart(payload.items || []);
            if (payload.items?.length > 0) {
                sendToCommerceRef.current?.({ type: 'OPEN_CART' });
            }
        }, []),
        onCheckoutStatus: useCallback((payload) => {
            console.log('[Kiosk] checkout_status from POS:', payload.status);
            if (payload.status === 'completed' || payload.status === 'canceled' || payload.status === 'failed') {
                setKioskRemoteCheckout(null);
            } else {
                setKioskRemoteCheckout(payload);
            }
        }, []),
        onCartRequest: useCallback(() => {
            kioskSendForwardRef.current?.('cart_sync', { items: kioskCartRef.current });
        }, []),
    });
    kioskSendForwardRef.current = kioskSendForward;

    // Broadcast kiosk cart changes to paired POS
    useEffect(() => {
        if (!isKioskPaired || !kioskTerminal) return;
        if (isRemoteCartUpdateRef.current) {
            isRemoteCartUpdateRef.current = false;
            return;
        }
        console.log('[Kiosk] Broadcasting cart_sync:', kioskCart.length, 'items');
        kioskSendForward('cart_sync', { items: kioskCart });
    }, [kioskCart, isKioskPaired, kioskTerminal, kioskSendForward, kioskWsConnected]);

    // Sync kiosk cart count to layout context
    useEffect(() => {
        const count = kioskCart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        setKioskCartCount(count);
    }, [kioskCart, setKioskCartCount]);

    // ── Kiosk code entry ──
    const handleKioskCodeSubmit = useCallback(async () => {
        if (!kioskCodeInput.trim()) return;
        setKioskCodeLoading(true);
        setKioskCodeError('');
        try {
            const res = await fetch(TERMINAL_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resolveKioskCode', kioskCode: kioskCodeInput.trim() }),
            });
            const data = await res.json();
            const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;
            if (result.error) {
                setKioskCodeError(result.error);
                return;
            }
            setKioskTerminal({
                deviceId: result.deviceId,
                locationId: result.locationId,
                terminalName: result.terminalName,
                locationName: result.locationName,
                kioskDeviceId: result.kioskDeviceId,
                pairedDevice: result.pairedDevice || null,
            });
            if (result.kioskDeviceId) {
                localStorage.setItem('surreal_kiosk_device_id', result.kioskDeviceId);
            }
            setShowKioskDialog(false);
            setKioskCodeInput('');
        } catch (err) {
            console.error('[Kiosk] Code validation error:', err);
            setKioskCodeError('Failed to validate code. Check your connection and try again.');
        } finally {
            setKioskCodeLoading(false);
        }
    }, [kioskCodeInput]);

    // ── Kiosk mode toggle (type "kiosk" anywhere) ──
    useEffect(() => {
        let buffer = '';
        let timeout;
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            buffer += e.key.toLowerCase();
            clearTimeout(timeout);
            timeout = setTimeout(() => { buffer = ''; }, 1500);
            if (buffer.includes('kiosk')) {
                buffer = '';
                if (kioskTerminalRef.current) {
                    // Exit kiosk mode — navigate back to web
                    setKioskTerminal(null);
                    navigate('/');
                } else {
                    setShowKioskDialog(true);
                    setKioskCodeInput('');
                    setKioskCodeError('');
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            clearTimeout(timeout);
        };
    }, [navigate]);

    // ── Swiper state ──
    const [currentSlide, setCurrentSlide] = useState(0);
    const [selectedProducts, setSelectedProducts] = useState({});
    const [selectedContainerSize, setSelectedContainerSize] = useState({});

    // ── Build dessert subcategories (slides) ──

    // Hierarchy-based subcategories (fallback)
    const HIERARCHY_DESSERT_SUBCATEGORIES = useMemo(() => {
        if (!getSubcategories || !categories?.length) return [];
        const subcats = getSubcategories('desserts');
        return subcats.map(subcat => {
            const subcatProducts = shopifyProducts.filter(p => {
                const hierarchy = getProductHierarchy(p);
                return hierarchy?.subcategory?.handle === subcat.handle;
            });
            const containers = subcatProducts.map(product => {
                const productName = product.name?.toLowerCase();
                const firstVariant = product.variants?.[0];
                const variantSku = firstVariant?.sku?.toUpperCase();
                let catalogProduct = catalog?.products?.find(p => {
                    if (variantSku && p.sku?.toUpperCase() === variantSku) return true;
                    if (variantSku && p.variants?.some(v => v.sku?.toUpperCase() === variantSku)) return true;
                    return false;
                });
                if (!catalogProduct && productName) {
                    catalogProduct = catalog?.products?.find(p => p.name?.toLowerCase() === productName);
                }
                const catalogMasterImage = catalogProduct?.masterImage;
                const masterImage = catalogProduct?.images?.find(img => img.url?.includes('/master/'));
                const firstImage = catalogProduct?.images?.[0];
                const s3Image = catalogMasterImage?.url || masterImage?.url || firstImage?.url || null;
                const backgroundColor = catalogMasterImage?.backgroundColor || masterImage?.backgroundColor || firstImage?.backgroundColor || null;
                const textColorVal = catalogMasterImage?.textColor || masterImage?.textColor || firstImage?.textColor || null;
                const gradientDirection = catalogMasterImage?.gradientDirection || masterImage?.gradientDirection || firstImage?.gradientDirection || null;
                const gradientStartColor = catalogMasterImage?.gradientStartColor || masterImage?.gradientStartColor || firstImage?.gradientStartColor || null;
                const gradientEndColor = catalogMasterImage?.gradientEndColor || masterImage?.gradientEndColor || firstImage?.gradientEndColor || null;
                return {
                    id: product.id,
                    title: product.name,
                    product,
                    image: s3Image,
                    pwa: catalogMasterImage?.pwa || null,
                    backgroundColor,
                    textColor: textColorVal,
                    gradientDirection,
                    gradientStartColor,
                    gradientEndColor,
                };
            });
            return {
                id: subcat.handle,
                title: subcat.title,
                description: '',
                image: subcat.image?.url || `https://placehold.co/300x300/e0e0e0/666666?text=${encodeURIComponent(subcat.title)}`,
                containers,
                products: containers.map(c => c.product),
            };
        }).filter(subcat => subcat.containers.length > 0);
    }, [catalog, shopifyProducts, categories, getSubcategories, getProductHierarchy]);

    // Variant-based subcategories (second fallback)
    const VARIANT_DESSERT_SUBCATEGORIES = useMemo(() => {
        if (!dessertSubcategories?.length) return [];
        return dessertSubcategories.map(subcat => {
            const matchingProducts = [];
            shopifyProducts.forEach(product => {
                const matchingVariants = product.variants?.filter(v =>
                    v.subcategory?.toLowerCase() === subcat.id?.toLowerCase()
                ) || [];
                if (matchingVariants.length > 0) {
                    const productName = product.name?.toLowerCase();
                    const firstVariant = matchingVariants[0];
                    const variantSku = firstVariant?.sku?.toUpperCase();
                    let catalogProduct = catalog?.products?.find(p => {
                        if (variantSku && p.sku?.toUpperCase() === variantSku) return true;
                        if (variantSku && p.variants?.some(v => v.sku?.toUpperCase() === variantSku)) return true;
                        return false;
                    });
                    if (!catalogProduct && productName) {
                        catalogProduct = catalog?.products?.find(p => p.name?.toLowerCase() === productName);
                    }
                    const catalogMasterImage = catalogProduct?.masterImage;
                    const masterImage = catalogProduct?.images?.find(img => img.url?.includes('/master/'));
                    const firstImage = catalogProduct?.images?.[0];
                    const s3Image = catalogMasterImage?.url || masterImage?.url || firstImage?.url || null;
                    const backgroundColor = catalogMasterImage?.backgroundColor || masterImage?.backgroundColor || firstImage?.backgroundColor || null;
                    const textColorVal = catalogMasterImage?.textColor || masterImage?.textColor || firstImage?.textColor || null;
                    const gradientDirection = catalogMasterImage?.gradientDirection || masterImage?.gradientDirection || firstImage?.gradientDirection || null;
                    const gradientStartColor = catalogMasterImage?.gradientStartColor || masterImage?.gradientStartColor || firstImage?.gradientStartColor || null;
                    const gradientEndColor = catalogMasterImage?.gradientEndColor || masterImage?.gradientEndColor || firstImage?.gradientEndColor || null;
                    matchingProducts.push({
                        id: `${product.id}-${subcat.id}`,
                        title: product.name,
                        product,
                        image: s3Image,
                        pwa: catalogMasterImage?.pwa || null,
                        backgroundColor,
                        textColor: textColorVal,
                        gradientDirection,
                        gradientStartColor,
                        gradientEndColor,
                        variantId: firstVariant?.id,
                        variants: matchingVariants,
                    });
                }
            });
            return {
                id: subcat.id,
                title: subcat.title,
                description: subcat.description || '',
                image: subcat.image?.url || `https://placehold.co/300x300/e0e0e0/666666?text=${encodeURIComponent(subcat.title)}`,
                containers: matchingProducts,
                products: matchingProducts.map(p => p.product),
            };
        }).filter(subcat => subcat.containers.length > 0);
    }, [dessertSubcategories, shopifyProducts, catalog]);

    // Select best subcategories source
    const USE_HIERARCHY_GROUPING = categories?.some(c => c.level > 1);
    const DESSERT_SUBCATEGORIES = CATALOG_DESSERT_SUBCATEGORIES.length > 0
        ? CATALOG_DESSERT_SUBCATEGORIES
        : USE_HIERARCHY_GROUPING
            ? HIERARCHY_DESSERT_SUBCATEGORIES
            : VARIANT_DESSERT_SUBCATEGORIES;

    // ── UI State from machine ──
    const selectedProductId = commerceState.context.selectedProductId;
    const showCartDrawer = commerceState.context.showCartDrawer;

    const selectedProduct = selectedProductId
        ? shopifyProducts.find(p => {
            const idToMatch = typeof selectedProductId === 'string' ? selectedProductId : selectedProductId?.id;
            return p.id === idToMatch;
        })
        : null;

    // ── Discounts (minimal for kiosk — discounts handled at POS) ──
    const dummyCart = useMemo(() => ({
        cart: kioskCart,
        getCartCount: () => kioskCart.reduce((sum, item) => sum + (item.quantity || 1), 0),
        getSubtotal: () => kioskCart.reduce((sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 1), 0),
        addToCart: () => {},
        removeFromCart: () => {},
        updateQuantity: () => {},
        clearCart: () => {},
    }), [kioskCart]);

    const { orderDiscounts } = useDiscounts(dummyCart, {}, shopifyProducts);

    // ── Product selection (opens full-page detail, no modal) ──
    const handleChooseProduct = useCallback((productId) => {
        const id = typeof productId === 'string' ? productId : productId?.id || String(productId);
        const product = shopifyProducts.find(p => p.id === id);
        if (product) {
            setGridDetailItem({
                type: 'product',
                id: product.id,
                title: product.name || product.title,
                product,
                image: product.imageUrl || product.images?.[0]?.url,
                catalogImages: product.images || [],
                isMYO: (product.name || '').toLowerCase().includes('make your own'),
                variants: product.variants || [],
            });
            setGridDetailActive(true);
        }
    }, [shopifyProducts]);

    // ── Grid detail page state ──
    const [gridDetailItem, setGridDetailItem] = useState(null);
    const [gridDetailActive, setGridDetailActive] = useState(false);
    setGridDetailItemRef.current = setGridDetailItem;
    setGridDetailActiveRef.current = setGridDetailActive;
    const [gridClosing, setGridClosing] = useState(false);
    const [expandTransition, setExpandTransition] = useState(null);
    const [collapseTransition, setCollapseTransition] = useState(null);
    const lastCardTransitionRef = useRef(null);
    const gridScrollRef = useRef(0);
    const closeTimeoutRef = useRef(null);

    const handleGridProductTap = useCallback((container, cardData) => {
        gridScrollRef.current = document.querySelector('[data-kiosk-grid-scroll]')?.scrollTop || 0;
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
            setGridClosing(false);
            setCollapseTransition(null);
        }
        setGridDetailItem(container);
        lastCardTransitionRef.current = cardData;
        if (cardData?.rect) {
            setExpandTransition({
                rect: cardData.rect,
                bgStyle: cardData.bgGradient,
                imgRect: cardData.imgRect,
                imgSrc: cardData.imgSrc,
                imgAR: cardData.imgAR,
            });
            setGridDetailActive(true);
            setTimeout(() => setExpandTransition(null), 450);
        } else {
            setGridDetailActive(true);
        }
    }, []);

    const closeGridDetail = useCallback(() => {
        setGridClosing(true);
        const cardData = lastCardTransitionRef.current;

        if (cardData) {
            requestAnimationFrame(() => {
                const gridScroll = document.querySelector('[data-kiosk-grid-scroll]');
                if (gridScroll) gridScroll.scrollTop = gridScrollRef.current;
                requestAnimationFrame(() => {
                    const cardId = gridDetailItem?.id;
                    const cardWrapper = cardId ? document.querySelector(`[data-container-id="${cardId}"]`) : null;
                    let targetRect = cardData.rect;
                    let targetImgRect = cardData.imgRect;
                    if (cardWrapper) {
                        const cardEl = cardWrapper.querySelector('[data-card]');
                        if (cardEl) targetRect = cardEl.getBoundingClientRect();
                        const imgEl = cardWrapper.querySelector('[data-product-img]');
                        if (imgEl) targetImgRect = imgEl.getBoundingClientRect();
                    }
                    setCollapseTransition({
                        targetRect,
                        targetImgRect,
                        imgSrc: gridDetailItem?.image || cardData.imgSrc,
                        imgAR: cardData.imgAR,
                    });
                });
            });
        }

        closeTimeoutRef.current = setTimeout(() => {
            setGridClosing(false);
            setGridDetailActive(false);
            setGridDetailItem(null);
            setCollapseTransition(null);
            lastCardTransitionRef.current = null;
            closeTimeoutRef.current = null;
        }, 700);
    }, [gridDetailItem]);

    // ── Add to cart (always kiosk cart) ──
    const handleAddToCart = useCallback(async (productId, variantId, quantity = 1, customAttributes = []) => {
        const product = shopifyProducts.find(p => p.id === productId);
        const variant = product?.variants?.find(v => v.id === variantId) || product?.variants?.[0];

        const sku = product?.sku || variant?.sku || productId;
        const variantSku = variant?.sku || variantId;
        const modifiers = (customAttributes || [])
            .filter(a => !a.key?.startsWith('_'))
            .map(a => ({ name: `${a.key}: ${a.value}`, price: 0 }));
        const modKey = modifiers.map(m => m.name).sort().join('|');

        setKioskCart(prev => {
            const existingIdx = prev.findIndex(i => {
                if (i.variantSku !== variantSku) return false;
                const eModKey = (i.modifiers || []).map(m => m.name).sort().join('|');
                return eModKey === modKey;
            });
            if (existingIdx !== -1) {
                return prev.map((i, idx) => idx === existingIdx
                    ? { ...i, quantity: i.quantity + quantity }
                    : i
                );
            }
            return [...prev, {
                sku,
                variantSku,
                name: product?.title || product?.name || '',
                variantName: variant?.title !== 'Default Title' ? variant?.title : '',
                unitPrice: parseFloat(variant?.price?.amount || variant?.price || 0),
                quantity,
                modifiers,
                image: variant?.image?.url || product?.images?.[0]?.url || product?.imageUrl || '',
            }];
        });

        console.log('[Kiosk] Added to kiosk cart');
        sendToCommerce({ type: 'CLOSE_PRODUCT' });
        sendToCommerce({ type: 'OPEN_CART' });
    }, [shopifyProducts, sendToCommerce]);

    // Get recommendations for cart drawer
    const getRecommendations = useCallback(() => {
        if (!selectedProductId) return [];
        const sp = shopifyProducts.find(p => p.id === selectedProductId);
        if (!sp) return [];
        return shopifyProducts.filter(p => p.category === sp.category && p.id !== selectedProductId).slice(0, 4);
    }, [selectedProductId, shopifyProducts]);

    // ── Update activeTextColor for swiper ──
    useEffect(() => {
        if (!setActiveTextColor || DESSERT_SUBCATEGORIES.length === 0) return;
        if (kioskViewMode === 'grid') {
            setActiveTextColor('black');
            return;
        }
        const slide = DESSERT_SUBCATEGORIES[currentSlide];
        const containerIdx = selectedContainerSize[slide?.id] ?? 0;
        const container = slide?.containers?.[containerIdx];
        const textColor = container?.textColor || getTextColorForBackground(container?.backgroundColor);
        setActiveTextColor(textColor);
    }, [currentSlide, selectedContainerSize, DESSERT_SUBCATEGORIES, setActiveTextColor, kioskViewMode]);

    // ── Loading / Error ──
    if (shopifyLoading) {
        return (
            <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                <CircularProgress sx={{ color: 'black' }} />
                <Typography sx={{ mt: 2, color: 'black' }}>Loading...</Typography>
            </Box>
        );
    }

    if (shopifyError) {
        return (
            <Container maxWidth="md" sx={{ py: 8 }}>
                <Alert severity="error">Error loading products: {shopifyError}</Alert>
            </Container>
        );
    }

    return (
        <>
            {/* Category navigation */}
            {DESSERT_SUBCATEGORIES.length > 0 && (
                <Box
                    sx={{
                        display: 'flex',
                        position: 'fixed',
                        top: '128px',
                        left: 0, right: 0,
                        zIndex: 50,
                        gap: 3, px: 2, py: 0,
                        overflowX: 'auto', overflowY: 'hidden',
                        '&::-webkit-scrollbar': { display: 'none' },
                        scrollbarWidth: 'none',
                        pointerEvents: 'auto',
                        touchAction: 'pan-x',
                        bgcolor: kioskViewMode === 'grid' ? 'rgba(255,255,255,0.95)' : 'transparent',
                        transition: 'background-color 0.3s ease',
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        style={{ display: 'flex', flexDirection: 'row', gap: '24px' }}
                    >
                        {DESSERT_SUBCATEGORIES.map((category, idx) => {
                            const isSelected = idx === currentSlide;
                            const currentCategory = DESSERT_SUBCATEGORIES[currentSlide];
                            const currentContainerIndex = selectedContainerSize[currentCategory?.id] ?? 0;
                            const currentContainer = currentCategory?.containers?.[currentContainerIndex];
                            const catTextColor = kioskViewMode === 'grid'
                                ? 'black'
                                : (currentContainer?.textColor || getTextColorForBackground(currentContainer?.backgroundColor));
                            return (
                                <Typography
                                    key={category.id}
                                    onClick={() => {
                                        setCurrentSlide(idx);
                                        if (kioskViewMode === 'grid') {
                                            const el = document.getElementById(`kiosk-grid-category-${idx}`);
                                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }
                                    }}
                                    sx={{
                                        flexShrink: 0,
                                        fontSize: '1.6rem',
                                        fontWeight: isSelected ? 700 : 400,
                                        color: catTextColor,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'color 0.3s ease-out',
                                    }}
                                >
                                    {category.title}
                                </Typography>
                            );
                        })}
                    </motion.div>
                </Box>
            )}

            {/* Slideshow view */}
            {DESSERT_SUBCATEGORIES.length > 0 && kioskViewMode === 'slideshow' && (
                <motion.div
                    key="slideshow"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <FullScreenSwiper
                        slides={DESSERT_SUBCATEGORIES}
                        currentSlide={currentSlide}
                        onSlideChange={setCurrentSlide}
                        selectedProducts={selectedProducts}
                        onSelectProduct={(slideId, productIndex) => {
                            setSelectedProducts(prev => ({ ...prev, [slideId]: productIndex }));
                        }}
                        selectedContainerSize={selectedContainerSize}
                        onSelectContainerSize={(slideId, containerIndex) => {
                            setSelectedContainerSize(prev => ({ ...prev, [slideId]: containerIndex }));
                        }}
                        onProductClick={handleChooseProduct}
                        onAddToCart={async (variantId, quantity, customAttributes) => {
                            const ownerProduct = shopifyProducts.find(p => p.variants?.some(v => v.id === variantId));
                            await handleAddToCart(ownerProduct?.id || variantId, variantId, quantity, customAttributes);
                        }}
                    />
                </motion.div>
            )}

            {/* Grid view */}
            {DESSERT_SUBCATEGORIES.length > 0 && kioskViewMode === 'grid' && (
                <motion.div
                    key="grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    {(!gridDetailActive || gridClosing) && (
                        <KioskGridView
                            categories={DESSERT_SUBCATEGORIES}
                            currentSlide={currentSlide}
                            onCategoryChange={setCurrentSlide}
                            onProductTap={handleGridProductTap}
                        />
                    )}
                </motion.div>
            )}

            {/* Grid detail page — rendered outside grid wrapper to escape stacking context */}
            {gridDetailActive && gridDetailItem && (
                <KioskProductDetailPage
                    item={gridDetailItem}
                    onAddToCart={async (productId, variantId, quantity) => {
                        await handleAddToCart(productId, variantId, quantity);
                    }}
                    onClose={closeGridDetail}
                    onOpenCart={() => sendToCommerce({ type: 'OPEN_CART' })}
                    closing={gridClosing}
                    storeLocations={storeLocations}
                />
            )}

            {/* Expand transition overlay */}
            {expandTransition && (() => {
                const ir = expandTransition.imgRect;
                const imgSize = Math.min(window.innerWidth * 0.7, 340);
                const imgStartCenterX = ir ? ir.left + ir.width / 2 : 0;
                const imgStartCenterY = ir ? ir.top + ir.height / 2 : 0;
                const imgTargetCenterX = window.innerWidth / 2;
                const imgTargetCenterY = window.innerHeight * 0.38 / 2;
                const dx = imgTargetCenterX - imgStartCenterX;
                const dy = imgTargetCenterY - imgStartCenterY;
                const containerAR = ir ? ir.width / ir.height : 1;
                const imgAR = expandTransition.imgAR || 1;
                const imgScale = ir ? imgSize / (imgAR > containerAR ? ir.height : ir.width) : 1;
                return (
                    <>
                        <motion.div
                            key="expand-bg"
                            initial={{
                                top: expandTransition.rect.top,
                                left: expandTransition.rect.left,
                                width: expandTransition.rect.width,
                                height: expandTransition.rect.height,
                                borderRadius: 24,
                            }}
                            animate={{
                                top: 0, left: 0,
                                width: window.innerWidth,
                                height: window.innerHeight * 0.38,
                                borderRadius: 0,
                            }}
                            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                            style={{
                                position: 'fixed', zIndex: 115,
                                background: expandTransition.bgStyle,
                                overflow: 'hidden', pointerEvents: 'none',
                            }}
                        />
                        {expandTransition.imgSrc && ir && (
                            <motion.img
                                key="expand-img"
                                src={expandTransition.imgSrc}
                                initial={{ x: 0, y: 0, scale: 1 }}
                                animate={{ x: dx, y: dy, scale: imgScale }}
                                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                style={{
                                    position: 'fixed',
                                    top: ir.top, left: ir.left,
                                    width: ir.width, height: ir.height,
                                    zIndex: 116, objectFit: 'cover',
                                    borderRadius: 12, pointerEvents: 'none',
                                    willChange: 'transform',
                                }}
                            />
                        )}
                    </>
                );
            })()}

            {/* Collapse transition overlay */}
            {collapseTransition && (() => {
                const tr = collapseTransition.targetImgRect;
                if (!collapseTransition.imgSrc || !tr) return null;
                const imgSize = Math.min(window.innerWidth * 0.7, 340);
                const cardCenterX = tr.left + tr.width / 2;
                const cardCenterY = tr.top + tr.height / 2;
                const screenCenterX = window.innerWidth / 2;
                const screenCenterY = window.innerHeight * 0.38 / 2;
                const offsetX = screenCenterX - cardCenterX;
                const offsetY = screenCenterY - cardCenterY;
                const collapseContainerAR = tr.width / tr.height;
                const collapseImgAR = collapseTransition.imgAR || 1;
                const imgStartScale = imgSize / (collapseImgAR > collapseContainerAR ? tr.height : tr.width);
                return (
                    <motion.img
                        key="collapse-img"
                        src={collapseTransition.imgSrc}
                        initial={{ x: offsetX, y: offsetY, scale: imgStartScale }}
                        animate={{ x: 0, y: 0, scale: 1 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            position: 'fixed',
                            top: tr.top, left: tr.left,
                            width: tr.width, height: tr.height,
                            zIndex: 116, objectFit: 'cover',
                            borderRadius: 12, pointerEvents: 'none',
                            willChange: 'transform',
                        }}
                    />
                );
            })()}

            {/* Cart Drawer */}
            <CartDrawer
                open={showCartDrawer}
                onClose={() => sendToCommerce({ type: 'CLOSE_CART' })}
                recommendations={getRecommendations()}
                onProductClick={handleChooseProduct}
                orderDiscounts={orderDiscounts}
                kioskTerminal={kioskTerminal}
                kioskCart={kioskCart}
                onKioskCartChange={setKioskCart}
                isKioskPaired={isKioskPaired}
                kioskRemoteCheckout={kioskRemoteCheckout}
                kioskSendForward={kioskSendForward}
            />

            {/* Kiosk Code Entry Dialog */}
            <Modal
                open={showKioskDialog}
                onClose={() => { setShowKioskDialog(false); setKioskCodeError(''); setKioskCodeInput(''); }}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
                <Box sx={{ bgcolor: 'white', borderRadius: 3, p: 4, mx: 2, maxWidth: 360, width: '100%', outline: 'none', textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                        Enter Device Code
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Enter the 6-digit registration code
                    </Typography>

                    {/* Code display */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 1 }}>
                        {[0, 1, 2, 3, 4, 5].map(i => (
                            <Box key={i} sx={{
                                width: 40, height: 48, borderRadius: 1.5,
                                border: '2px solid', borderColor: kioskCodeError ? 'error.main' : kioskCodeInput.length === i ? 'primary.main' : 'grey.300',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: kioskCodeInput[i] ? 'grey.50' : 'white',
                                transition: 'border-color 0.15s',
                            }}>
                                <Typography sx={{ fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700 }}>
                                    {kioskCodeInput[i] || ''}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                    {kioskCodeError && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
                            {kioskCodeError}
                        </Typography>
                    )}

                    {/* Numeric keypad */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 2, mt: 2 }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                            <Button
                                key={n}
                                variant="outlined"
                                onClick={() => {
                                    if (kioskCodeInput.length < 6) {
                                        setKioskCodeInput(prev => prev + n);
                                        setKioskCodeError('');
                                    }
                                }}
                                sx={{ fontSize: '2rem', fontWeight: 600, py: 1.5, minWidth: 0, borderColor: 'grey.300', color: 'text.primary' }}
                            >
                                {n}
                            </Button>
                        ))}
                        <Button
                            variant="outlined"
                            onClick={() => { setKioskCodeInput(''); setKioskCodeError(''); }}
                            sx={{ fontSize: '1.2rem', fontWeight: 600, py: 1.5, minWidth: 0, borderColor: 'grey.300', color: 'text.secondary' }}
                        >
                            Clear
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => {
                                if (kioskCodeInput.length < 6) {
                                    setKioskCodeInput(prev => prev + '0');
                                    setKioskCodeError('');
                                }
                            }}
                            sx={{ fontSize: '2rem', fontWeight: 600, py: 1.5, minWidth: 0, borderColor: 'grey.300', color: 'text.primary' }}
                        >
                            0
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => setKioskCodeInput(prev => prev.slice(0, -1))}
                            disabled={kioskCodeInput.length === 0}
                            sx={{ fontSize: '1.6rem', fontWeight: 600, py: 1.5, minWidth: 0, borderColor: 'grey.300', color: 'text.secondary' }}
                        >
                            &#9003;
                        </Button>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            onClick={() => { setShowKioskDialog(false); setKioskCodeError(''); setKioskCodeInput(''); }}
                            sx={{ flex: 1, textTransform: 'none', borderColor: 'grey.300', color: 'grey.700' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleKioskCodeSubmit}
                            disabled={kioskCodeInput.length !== 6 || kioskCodeLoading}
                            sx={{ flex: 2, textTransform: 'none', bgcolor: 'black', '&:hover': { bgcolor: 'grey.800' } }}
                        >
                            {kioskCodeLoading ? <CircularProgress size={20} color="inherit" /> : 'Enter Kiosk Mode'}
                        </Button>
                    </Box>
                </Box>
            </Modal>

            {/* Floating Debug Console */}
            <>
                {/* Toggle button */}
                <Box
                    onClick={() => setShowDebugConsole(prev => !prev)}
                    sx={{
                        position: 'fixed', bottom: 12, right: 12, zIndex: 99999,
                        width: 40, height: 40, borderRadius: '50%',
                        bgcolor: debugLogs.some(l => l.level === 'error') ? '#d32f2f' : 'rgba(0,0,0,0.6)',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '18px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                >
                    {showDebugConsole ? 'X' : '\u{1F41B}'}
                </Box>
                {/* Console panel */}
                {showDebugConsole && (
                    <Box
                        sx={{
                            position: 'fixed', bottom: 60, right: 8, left: 8, zIndex: 99999,
                            maxHeight: '45vh', bgcolor: 'rgba(0,0,0,0.92)', borderRadius: 2,
                            border: '1px solid rgba(255,255,255,0.15)', overflow: 'hidden',
                            display: 'flex', flexDirection: 'column',
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <Typography sx={{ color: '#aaa', fontSize: '11px', fontFamily: 'monospace' }}>
                                Debug Console ({debugLogs.length} entries)
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Typography
                                    onClick={() => setDebugLogs([])}
                                    sx={{ color: '#888', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer', '&:hover': { color: 'white' } }}
                                >
                                    Clear
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ flex: 1, overflow: 'auto', p: 1, display: 'flex', flexDirection: 'column-reverse' }}>
                            <Box>
                                {debugLogs.map((log, i) => (
                                    <Box key={i} sx={{ py: 0.25, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <Typography
                                            component="pre"
                                            sx={{
                                                fontFamily: 'monospace', fontSize: '10px', m: 0,
                                                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                                color: log.level === 'error' ? '#ff6b6b' : log.level === 'warn' ? '#ffd93d' : '#b8e6b8',
                                            }}
                                        >
                                            <span style={{ color: '#666', marginRight: 4 }}>
                                                {new Date(log.ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                            {log.level !== 'log' && <span>[{log.level.toUpperCase()}] </span>}
                                            {log.msg}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Box>
                )}
            </>
        </>
    );
}

export default function Kiosk() {
    return <KioskInner />;
}
