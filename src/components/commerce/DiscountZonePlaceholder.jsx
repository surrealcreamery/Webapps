import React, { useState } from 'react';
import { Box, Typography, Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Discount Zone Component
 * Shows actual discount if provided, or placeholder for visualization
 *
 * @param {number} zone - Zone number (1-4) for color coding
 * @param {string} variant - 'default', 'banner', 'inline'
 * @param {string} label - Placeholder label when no discount
 * @param {Object} discount - Actual discount data to display
 * @param {boolean} showPlaceholder - Force show placeholder even if no discount
 * @param {string} subcategoryName - Name of subcategory for Buy X Get Y messaging
 * @param {Array} products - Products data for looking up images
 */
export const DiscountZonePlaceholder = ({
    zone,
    variant = 'default',
    label,
    discount = null,
    showPlaceholder = false,
    subcategoryName = 'items',
    products = []
}) => {
    const [modalOpen, setModalOpen] = useState(false);

    const zoneColors = {
        1: { bg: 'transparent', border: 'transparent', text: '#1b5e20' }, // No border/bg - Product modal collection discount
        2: { bg: 'transparent', border: 'transparent', text: '#1b5e20' }, // No border/bg - Below subcategory description
        3: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' }, // Green - Product level
    };

    const discountColors = {
        bg: '#e8f5e9',
        border: '#4caf50',
        text: '#1b5e20',
        bannerBg: '#2e7d32'
    };

    const colors = zoneColors[zone] || zoneColors[1];

    const handleOpenModal = (e) => {
        e.stopPropagation();
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
    };

    // If we have a discount, render it with modal
    if (discount) {
        return (
            <>
                {renderDiscount(discount, variant, discountColors, handleOpenModal, subcategoryName, zone)}
                <DiscountModal
                    open={modalOpen}
                    onClose={handleCloseModal}
                    discount={discount}
                    subcategoryName={subcategoryName}
                    products={products}
                />
            </>
        );
    }

    // If no discount and showPlaceholder is false, render nothing
    if (!showPlaceholder) {
        return null;
    }

    // Render placeholder
    if (variant === 'banner') {
        return (
            <Box
                sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    bgcolor: colors.bg,
                    border: `2px dashed ${colors.border}`,
                    color: colors.text,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '1.6rem',
                    fontWeight: 700,
                    zIndex: 10,
                    opacity: 0.9
                }}
            >
                {label || `ZONE ${zone}`}
            </Box>
        );
    }

    if (variant === 'inline') {
        return (
            <Box
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    bgcolor: colors.bg,
                    border: `2px dashed ${colors.border}`,
                    color: colors.text,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '1.6rem',
                    fontWeight: 600,
                    mt: 0.5
                }}
            >
                {label || `Zone ${zone} - Discount`}
            </Box>
        );
    }

    // Default - full width box
    return (
        <Box
            sx={{
                bgcolor: colors.bg,
                border: `2px dashed ${colors.border}`,
                borderRadius: 2,
                p: 2,
                my: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <Typography sx={{ color: colors.text, fontWeight: 600, fontSize: '1.6rem' }}>
                {label || `DISCOUNT ZONE ${zone}`}
            </Typography>
        </Box>
    );
};

/**
 * Render actual discount content
 */
function renderDiscount(discount, variant, colors, onOpenModal, subcategoryName = 'items', zone = 1) {
    const { type, title, percentOff, threshold, freeItemName, quantityRequired, current, remaining } = discount;

    // Zone 1 and Zone 2 should have no border/background
    const isZone1or2 = zone === 1 || zone === 2;
    // Zone 3 should be flush with price (no margin/padding)
    const isZone3 = zone === 3;

    // Banner variant (on images)
    if (variant === 'banner') {
        if (type === 'percent') {
            return (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        bgcolor: colors.bannerBg,
                        color: 'white',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '1.6rem',
                        fontWeight: 700,
                        boxShadow: 1,
                        zIndex: 10
                    }}
                >
                    {percentOff}% OFF
                </Box>
            );
        }
        if (type === 'freeItem') {
            return (
                <Box
                    onClick={onOpenModal}
                    sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        bgcolor: colors.bannerBg,
                        color: 'white',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '1.6rem',
                        fontWeight: 700,
                        boxShadow: 1,
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        cursor: 'pointer',
                        '&:hover': {
                            opacity: 0.9
                        }
                    }}
                >
                    <CardGiftcardIcon sx={{ fontSize: '1.6rem' }} />
                    FREE GIFT
                </Box>
            );
        }
        return null;
    }

    // Inline variant (below price, below image)
    if (variant === 'inline') {
        if (type === 'percent') {
            return (
                <Box
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        color: colors.text,
                        px: 1,
                        py: 0.25,
                        fontSize: '1.6rem',
                        fontWeight: 600,
                        mt: 0.5
                    }}
                >
                    <LocalOfferIcon sx={{ fontSize: '1.6rem' }} />
                    {percentOff}% off {threshold ? `orders $${threshold}+` : ''}
                </Box>
            );
        }
        if (type === 'freeItem') {
            const message = `Buy ${quantityRequired} ${subcategoryName} to get a free item!`;
            return (
                <Box
                    onClick={onOpenModal}
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        color: colors.text,
                        px: isZone3 ? 0 : 1,
                        py: isZone3 ? 0 : 0.25,
                        fontSize: '1.6rem',
                        fontWeight: 600,
                        mt: isZone3 ? 0 : 0.5,
                        cursor: 'pointer',
                        '&:hover': {
                            textDecoration: 'underline'
                        }
                    }}
                >
                    <CardGiftcardIcon sx={{ fontSize: '1.6rem' }} />
                    {message}
                </Box>
            );
        }
        return null;
    }

    // Default - full width box
    if (type === 'percent') {
        return (
            <Box
                sx={{
                    bgcolor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 2,
                    p: 2,
                    my: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                }}
            >
                <LocalOfferIcon sx={{ color: colors.text, fontSize: '1.6rem' }} />
                <Typography sx={{ color: colors.text, fontWeight: 500, fontSize: '1.6rem' }}>
                    {title || `${percentOff}% off ${threshold ? `orders over $${threshold}` : ''}`}
                </Typography>
            </Box>
        );
    }

    if (type === 'freeItem') {
        const message = `Buy ${quantityRequired} ${subcategoryName} to get a free item!`;
        return (
            <Box
                onClick={onOpenModal}
                sx={{
                    bgcolor: isZone1or2 ? 'transparent' : colors.bg,
                    border: isZone1or2 ? 'none' : `1px solid ${colors.border}`,
                    borderRadius: isZone1or2 ? 0 : 2,
                    p: isZone1or2 ? 0 : 2,
                    my: isZone1or2 ? 1 : 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    cursor: 'pointer',
                    '&:hover': {
                        textDecoration: isZone1or2 ? 'underline' : 'none',
                        opacity: isZone1or2 ? 1 : 0.9
                    }
                }}
            >
                <CardGiftcardIcon sx={{ color: colors.text, fontSize: '1.6rem' }} />
                <Typography sx={{ color: colors.text, fontWeight: 500, fontSize: '1.6rem' }}>
                    {message}
                </Typography>
            </Box>
        );
    }

    if (type === 'collection') {
        return (
            <Box
                sx={{
                    bgcolor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 2,
                    p: 2,
                    my: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                }}
            >
                <LocalOfferIcon sx={{ color: colors.text, fontSize: '1.6rem' }} />
                <Typography sx={{ color: colors.text, fontWeight: 500, fontSize: '1.6rem' }}>
                    {title}
                </Typography>
            </Box>
        );
    }

    return null;
}

/**
 * Modal to display discount offer details
 */
function DiscountModal({ open, onClose, discount, subcategoryName = 'items', products = [] }) {
    if (!discount) return null;

    const { type, title, percentOff, threshold, freeItemName, quantityRequired, current, remaining, options } = discount;

    const PLACEHOLDER_IMAGE = 'https://placehold.co/80x80/f5f5f5/666666?text=Gift';

    // Helper to find product image from products data
    const findProductImage = (gift) => {
        if (!products || products.length === 0) return PLACEHOLDER_IMAGE;

        const variantId = gift.variantId;
        const productId = gift.id;

        // Look up product in products array
        const matchedProduct = products.find(p =>
            p.id === productId ||
            p.shopifyId === productId ||
            p.variantId === variantId ||
            p.variants?.some(v => v.id === variantId)
        );

        if (matchedProduct) {
            // Try to get image from matched product
            return matchedProduct.imageUrl
                || matchedProduct.images?.[0]?.url
                || matchedProduct.variants?.find(v => v.id === variantId)?.image?.url
                || PLACEHOLDER_IMAGE;
        }

        return PLACEHOLDER_IMAGE;
    };

    // Collect all free gifts from all options
    const allFreeGifts = [];
    if (options && options.length > 0) {
        options.forEach(option => {
            if (option.freeProducts && option.freeProducts.length > 0) {
                option.freeProducts.forEach(product => {
                    // Avoid duplicates
                    if (!allFreeGifts.find(g => g.variantId === product.variantId)) {
                        allFreeGifts.push({
                            ...product,
                            imageUrl: findProductImage(product)
                        });
                    }
                });
            } else if (option.freeProduct) {
                if (!allFreeGifts.find(g => g.variantId === option.freeProduct.variantId)) {
                    allFreeGifts.push({
                        ...option.freeProduct,
                        imageUrl: findProductImage(option.freeProduct)
                    });
                }
            }
        });
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    maxWidth: '400px'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pb: 1
            }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1.8rem' }}>
                    Special Offer
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                {type === 'freeItem' && (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography sx={{ fontSize: '1.8rem', fontWeight: 600, mb: 2, color: '#1b5e20' }}>
                            Buy {quantityRequired} {subcategoryName} to get a free item!
                        </Typography>
                        <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary', mb: 3 }}>
                            Add {quantityRequired} or more {subcategoryName.toLowerCase()} to your cart and receive a free gift with your order.
                        </Typography>

                        {/* Display free gift options with images */}
                        {allFreeGifts.length > 0 && (
                            <Box sx={{ mt: 2, mb: 3 }}>
                                <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, mb: 2, color: '#1b5e20' }}>
                                    Choose your free gift:
                                </Typography>
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0,
                                    alignItems: 'center'
                                }}>
                                    {allFreeGifts.map((gift, index) => (
                                        <React.Fragment key={gift.variantId || index}>
                                            {/* Show -OR- between items */}
                                            {index > 0 && (
                                                <Typography sx={{
                                                    fontSize: '1.6rem',
                                                    fontWeight: 600,
                                                    color: 'text.secondary',
                                                    py: 1.5
                                                }}>
                                                    - OR -
                                                </Typography>
                                            )}
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2,
                                                    bgcolor: 'white',
                                                    borderRadius: 2,
                                                    p: 1.5,
                                                    width: '100%',
                                                    maxWidth: '300px',
                                                    border: '1px solid',
                                                    borderColor: 'grey.200'
                                                }}
                                            >
                                                <Box
                                                    component="img"
                                                    src={gift.imageUrl || PLACEHOLDER_IMAGE}
                                                    alt={gift.title}
                                                    sx={{
                                                        width: 60,
                                                        height: 60,
                                                        borderRadius: 1,
                                                        objectFit: 'cover',
                                                        flexShrink: 0
                                                    }}
                                                />
                                                <Box sx={{ textAlign: 'left' }}>
                                                    <Typography sx={{ fontSize: '1.6rem', fontWeight: 500 }}>
                                                        {gift.title}
                                                    </Typography>
                                                    {gift.variantTitle && gift.variantTitle !== 'Default Title' && (
                                                        <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary' }}>
                                                            {gift.variantTitle}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        </React.Fragment>
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {current > 0 && (
                            <Box sx={{
                                bgcolor: '#e8f5e9',
                                borderRadius: 2,
                                p: 2,
                                mt: 2
                            }}>
                                <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, color: '#2e7d32' }}>
                                    Your progress: {current} / {quantityRequired}
                                </Typography>
                                {remaining > 0 ? (
                                    <Typography sx={{ fontSize: '1.6rem', color: '#1b5e20' }}>
                                        Add {remaining} more to unlock your free gift!
                                    </Typography>
                                ) : (
                                    <Typography sx={{ fontSize: '1.6rem', color: '#1b5e20' }}>
                                        You've unlocked a free gift!
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </Box>
                )}
                {type === 'percent' && (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography sx={{ fontSize: '1.8rem', fontWeight: 600, mb: 2, color: '#1b5e20' }}>
                            {percentOff}% Off!
                        </Typography>
                        <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary' }}>
                            {title || `Get ${percentOff}% off ${threshold ? `on orders over $${threshold}` : 'your order'}`}
                        </Typography>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default DiscountZonePlaceholder;
