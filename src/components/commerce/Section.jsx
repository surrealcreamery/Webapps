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
    allProducts = [],
    groupByContainer = false
}) => {

    if (!products || products.length === 0) {
        return null; // Don't render empty sections
    }

    // Group products by container if enabled
    const groupedProducts = React.useMemo(() => {
        if (!groupByContainer) return null;

        const groups = {};
        products.forEach(product => {
            // Get container from product or first variant
            const containerTitle = product.containerData?.title
                || product.availableVariants?.[0]?.containerData?.title
                || 'Other';

            if (!groups[containerTitle]) {
                groups[containerTitle] = {
                    products: [],
                    minPrice: Infinity,
                    maxPrice: 0
                };
            }
            groups[containerTitle].products.push(product);

            // Calculate price range
            const getPrice = (p) => {
                if (p.availableVariants?.length > 0) {
                    return p.availableVariants.map(v => parseFloat(v.price) || 0);
                }
                const priceStr = p.price?.toString() || '0';
                return [parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0];
            };

            const prices = getPrice(product);
            prices.forEach(price => {
                if (price < groups[containerTitle].minPrice) {
                    groups[containerTitle].minPrice = price;
                }
                if (price > groups[containerTitle].maxPrice) {
                    groups[containerTitle].maxPrice = price;
                }
            });
        });

        // Sort products within each group: "Make Your Own" (MYO in SKU) first, then alphabetically
        Object.values(groups).forEach(group => {
            group.products.sort((a, b) => {
                // Check SKU for "MYO" - check product SKU or first variant's SKU
                const aSkuHasMYO = a.sku?.toUpperCase().includes('MYO')
                    || a.availableVariants?.[0]?.sku?.toUpperCase().includes('MYO');
                const bSkuHasMYO = b.sku?.toUpperCase().includes('MYO')
                    || b.availableVariants?.[0]?.sku?.toUpperCase().includes('MYO');

                if (aSkuHasMYO && !bSkuHasMYO) return -1;
                if (!aSkuHasMYO && bSkuHasMYO) return 1;
                return (a.name || '').localeCompare(b.name || '');
            });
        });

        // Sort groups alphabetically, but put "Other" at the end
        return Object.entries(groups).sort(([a], [b]) => {
            if (a === 'Other') return 1;
            if (b === 'Other') return -1;
            return a.localeCompare(b);
        });
    }, [products, groupByContainer]);

    // Generate anchor ID from container name
    const getContainerAnchorId = (containerName, sectionTitle) => {
        const sectionSlug = sectionTitle?.toLowerCase().replace(/\s+/g, '-') || 'section';
        const containerSlug = containerName.toLowerCase().replace(/\s+/g, '-');
        return `${sectionSlug}-${containerSlug}`;
    };

    // Scroll to container group
    const scrollToContainer = (containerName) => {
        const anchorId = getContainerAnchorId(containerName, title);
        const element = document.getElementById(anchorId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

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
                        fontSize: { xs: '1.75rem', md: '2.25rem' },
                        textAlign: 'center'
                    }}
                >
                    {title}
                </Typography>

                {description && (
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ mb: 2, textAlign: 'center' }}
                    >
                        {description}
                    </Typography>
                )}

                {/* Container anchor links with price ranges */}
                {groupByContainer && groupedProducts && groupedProducts.length > 1 && (
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            gap: 1,
                            mb: 3
                        }}
                    >
                        {groupedProducts.map(([containerName]) => {
                            return (
                                <Box
                                    key={containerName}
                                    onClick={() => scrollToContainer(containerName)}
                                    sx={{
                                        display: 'inline-flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        px: 2,
                                        py: 1,
                                        borderRadius: 2,
                                        backgroundColor: 'grey.100',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            backgroundColor: 'grey.200',
                                            transform: 'translateY(-1px)'
                                        }
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontWeight: 600,
                                            fontSize: '1.6rem',
                                            color: 'text.primary'
                                        }}
                                    >
                                        {containerName}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Box>
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
                {groupByContainer && groupedProducts ? (
                    // Grouped by container
                    groupedProducts.map(([containerName, groupData]) => (
                        <Box
                            key={containerName}
                            id={getContainerAnchorId(containerName, title)}
                            sx={{ mb: 4, scrollMarginTop: '80px' }}
                        >
                            {/* Container Group Header */}
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 600,
                                    mb: 2,
                                    color: 'text.primary',
                                    fontSize: '1.6rem',
                                    textAlign: 'center'
                                }}
                            >
                                {containerName}
                            </Typography>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: {
                                        xs: 'repeat(2, 1fr)',
                                        sm: 'repeat(2, 1fr)',
                                        md: 'repeat(3, 1fr)'
                                    },
                                    gap: 3
                                }}
                            >
                                {groupData.products.map((product) => {
                                    // Check if this is a Make Your Own product (MYO in SKU)
                                    const isMYO = product.sku?.toUpperCase().includes('MYO')
                                        || product.availableVariants?.[0]?.sku?.toUpperCase().includes('MYO');

                                    return (
                                        <Box
                                            key={product.id}
                                            sx={{
                                                gridColumn: isMYO ? {
                                                    xs: 'span 2',
                                                    md: 'span 2'
                                                } : 'span 1'
                                            }}
                                        >
                                            <ProductCard
                                                product={product}
                                                onClick={() => onProductClick(product.id)}
                                                discountPercent={discountPercent}
                                                productDiscount={productDiscount}
                                                subcategoryName={subcategoryName}
                                                allProducts={allProducts}
                                                featured={isMYO}
                                            />
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    ))
                ) : (
                    // Flat list (original behavior)
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
                )}
            </Container>
        </Box>
    );
};

/**
 * ProductCard Component
 * Individual product card within a section
 */
const ProductCard = ({ product, onClick, discountPercent, productDiscount, subcategoryName, allProducts, featured = false }) => {
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
                    paddingTop: featured ? '60%' : '100%', // Wider aspect ratio for featured
                    borderRadius: 2,
                    overflow: 'hidden',
                    backgroundColor: featured ? 'primary.light' : 'grey.200',
                    mb: 1,
                    ...(featured && {
                        border: '2px solid',
                        borderColor: 'primary.main',
                    })
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
                    fontWeight: featured ? 700 : 600,
                    mb: 0.5,
                    fontSize: featured ? '1.8rem' : 'inherit',
                    textAlign: 'center'
                }}
            >
                {product.name}
            </Typography>

            {/* Featured badge for MYO products */}
            {featured && (
                <Typography
                    sx={{
                        fontSize: '1.4rem',
                        color: 'primary.main',
                        fontWeight: 600,
                        mb: 0.5,
                        textAlign: 'center'
                    }}
                >
                    Build Your Own
                </Typography>
            )}

            {/* Size Options with Prices */}
            {product.availableVariants && product.availableVariants.length > 0 ? (
                <Box sx={{ mt: 0.5, textAlign: 'center' }}>
                    {product.availableVariants.map((variant, idx) => {
                        const originalPrice = parseFloat(variant.price);
                        const discountedPrice = discountPercent
                            ? originalPrice * (1 - discountPercent / 100)
                            : null;

                        return (
                            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
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
                            sx={{ textAlign: 'center' }}
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
