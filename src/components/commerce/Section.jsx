import React from 'react';
import { Box, Typography, Container } from '@mui/material';
import { DiscountZonePlaceholder } from './DiscountZonePlaceholder';

/**
 * Section Component
 * Reusable component for displaying a category/subcategory of products
 *
 * @param {string} title - Section title (e.g., "Frozen Treats", "Collectibles")
 * @param {string} description - Section description
 * @param {Array} products - Array of products to display
 * @param {Function} onProductClick - Callback when product is clicked
 * @param {string} backgroundColor - Optional background color
 * @param {React.ReactNode} afterDescription - Optional content to render after description
 * @param {number} discountPercent - Optional discount percentage to show on product cards
 * @param {Object} sectionDiscount - Discount data for Zone 2 (section level)
 * @param {Object} productDiscount - Discount data for Zone 3 (product level)
 * @param {string} subcategoryName - Name of subcategory for Buy X Get Y messaging
 * @param {Array} allProducts - All products data for looking up images in modals
 */
export const Section = ({
    title,
    description,
    products = [],
    onProductClick,
    backgroundColor = 'transparent',
    showDivider = true,
    afterDescription = null,
    discountPercent = null,
    sectionDiscount = null,
    productDiscount = null,
    subcategoryName = 'items',
    allProducts = []
}) => {

    if (!products || products.length === 0) {
        return null; // Don't render empty sections
    }

    return (
        <Box
            sx={{
                backgroundColor,
                py: 4,
                borderTop: showDivider ? '1px solid' : 'none',
                borderColor: 'divider'
            }}
        >
            <Container maxWidth="sm">
                {/* Section Header */}
                <Typography
                    variant="h3"
                    component="h2"
                    sx={{
                        fontWeight: 700,
                        mb: 1,
                        fontSize: { xs: '1.75rem', md: '2.25rem' }
                    }}
                >
                    {title}
                </Typography>

                {description && (
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                    >
                        {description}
                    </Typography>
                )}

                {/* ZONE 2: Below subcategory description - Collection/subcategory level discounts */}
                <DiscountZonePlaceholder
                    zone={2}
                    discount={sectionDiscount}
                    subcategoryName={subcategoryName}
                    products={allProducts}
                />

                {/* Optional content after description */}
                {afterDescription && (
                    <Box sx={{ mb: 4 }}>
                        {afterDescription}
                    </Box>
                )}

                {/* Product Grid - 3 columns on desktop, 2 on mobile */}
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr 1fr',    // Mobile: 2 columns
                            sm: '1fr 1fr',    // Small tablet: 2 columns
                            md: '1fr 1fr 1fr' // Desktop: 3 columns
                        },
                        gap: 3
                    }}
                >
                    {products.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            onClick={() => onProductClick(product.id)}
                            discountPercent={discountPercent}
                            productDiscount={productDiscount}
                            subcategoryName={subcategoryName}
                            allProducts={allProducts}
                        />
                    ))}
                </Box>
            </Container>
        </Box>
    );
};

/**
 * ProductCard Component
 * Individual product card within a section
 */
const ProductCard = ({ product, onClick, discountPercent, productDiscount, subcategoryName, allProducts }) => {
    return (
        <Box
            onClick={onClick}
            sx={{
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': {
                    transform: 'scale(1.02)'
                }
            }}
        >
            {/* Product Image */}
            <Box
                sx={{
                    position: 'relative',
                    paddingTop: '100%', // Square aspect ratio
                    borderRadius: 2,
                    overflow: 'hidden',
                    backgroundColor: 'grey.200',
                    mb: 1
                }}
            >
                <img
                    src={product.imageUrl || 'https://placehold.co/400x400/e0e0e0/666666?text=Product'}
                    alt={product.imageAlt || product.name}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                />

                {/* ZONE 3: Banner on product image */}
                <DiscountZonePlaceholder
                    zone={3}
                    variant="banner"
                    discount={productDiscount}
                    subcategoryName={subcategoryName}
                    products={allProducts}
                />
            </Box>

            {/* Product Info */}
            <Typography
                variant="body1"
                sx={{
                    fontWeight: 600,
                    mb: 0.5
                }}
            >
                {product.name}
            </Typography>

            {/* Size Options with Prices */}
            {product.availableVariants && product.availableVariants.length > 0 ? (
                <Box sx={{ mt: 0.5 }}>
                    {product.availableVariants.map((variant, idx) => {
                        const originalPrice = parseFloat(variant.price);
                        const discountedPrice = discountPercent
                            ? originalPrice * (1 - discountPercent / 100)
                            : null;

                        return (
                            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {variant.sizeData?.title || variant.size || 'Regular'}
                                </Typography>
                                {discountPercent ? (
                                    <>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: '#2e7d32',
                                                fontWeight: 600
                                            }}
                                        >
                                            ${discountedPrice.toFixed(2)}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: 'text.disabled',
                                                textDecoration: 'line-through'
                                            }}
                                        >
                                            ${originalPrice.toFixed(2)}
                                        </Typography>
                                    </>
                                ) : (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        ${originalPrice.toFixed(2)}
                                    </Typography>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            ) : (
                (() => {
                    // Parse price - handle both "$15.00" string and numeric formats
                    const priceStr = product.price?.toString() || '0';
                    const originalPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
                    const discountedPrice = discountPercent
                        ? originalPrice * (1 - discountPercent / 100)
                        : null;

                    return discountPercent ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: '#2e7d32',
                                    fontWeight: 600
                                }}
                            >
                                ${discountedPrice.toFixed(2)}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: 'text.disabled',
                                    textDecoration: 'line-through'
                                }}
                            >
                                ${originalPrice.toFixed(2)}
                            </Typography>
                        </Box>
                    ) : (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                        >
                            {product.price}
                        </Typography>
                    );
                })()
            )}

            {/* ZONE 3: Below product price - Individual product discounts */}
            <DiscountZonePlaceholder
                zone={3}
                variant="inline"
                discount={productDiscount}
                subcategoryName={subcategoryName}
                products={allProducts}
            />
        </Box>
    );
};

export default Section;
