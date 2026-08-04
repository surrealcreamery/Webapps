import React from 'react';
import { Box, Typography, Container, Button } from '@mui/material';
import { DiscountZonePlaceholder } from './DiscountZonePlaceholder';
import { useCatalog } from '@/contexts/commerce/CatalogContext';

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
 * @param {Array} catalogCategories - Catalog categories for looking up container images
 * @param {Function} onAddToCart - Callback for add to cart (productId, variantId, quantity, customAttributes)
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
    groupByContainer = false,
    catalogCategories = [],
    onAddToCart = null,
}) => {

    // Debug: Log Section props
    console.log(`[Section] "${title}" rendered:`, {
        productsCount: products?.length,
        groupByContainer,
        hasOnAddToCart: !!onAddToCart,
        hasCatalogCategories: !!catalogCategories?.length
    });

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
            const selectedSlug = localStorage.getItem('selectedLocation');
            const getPrice = (p) => {
                if (p.availableVariants?.length > 0) {
                    return p.availableVariants.map(v => {
                        const locPrice = selectedSlug && v.locationPrices?.[selectedSlug];
                        return parseFloat(locPrice != null ? locPrice : v.price) || 0;
                    });
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

        // Products are already sorted by productOrder from Commerce.jsx
        // Don't re-sort here - preserve the incoming order

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

    const sectionTitleId = `section-title-${title?.toLowerCase().replace(/\s+/g, '-') || 'unnamed'}`;

    return (
        <Box
            component="section"
            aria-labelledby={sectionTitleId}
            sx={{
                backgroundColor,
                py: 4,
                borderTop: showDivider ? '1px solid' : 'none',
                borderColor: 'divider',
                overflow: 'hidden',
                width: '100%'
            }}
        >
            <Container maxWidth="md" sx={{ overflow: 'hidden' }}>
                {/* Section Header */}
                <Typography
                    id={sectionTitleId}
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
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Jump to ${containerName}`}
                                    onClick={() => scrollToContainer(containerName)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            scrollToContainer(containerName);
                                        }
                                    }}
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
                                        },
                                        '&:focus-visible': {
                                            outline: '2px solid #1976d2',
                                            outlineOffset: '2px'
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
                    groupedProducts.map(([containerName, groupData]) => {
                        // Look up container image from catalog categories
                        const containerCategory = catalogCategories?.find(
                            c => c.name?.toLowerCase() === containerName?.toLowerCase()
                        );
                        const containerImage = containerCategory?.image?.url;

                        // Find MYO product in this container group
                        // Check for "MYO" or "MAKE-YOUR-OWN" in SKU, or "Make Your Own" in name
                        const myoProduct = groupData.products.find(p => {
                            const sku = (p.sku || p.availableVariants?.[0]?.sku || '').toUpperCase();
                            const name = (p.name || '').toLowerCase();
                            return sku.includes('MYO') ||
                                   sku.includes('MAKE-YOUR-OWN') ||
                                   name.includes('make your own');
                        });

                        // Filter out MYO products from the grid (they'll be shown in the builder)
                        const nonMyoProducts = groupData.products.filter(p => {
                            const sku = (p.sku || p.availableVariants?.[0]?.sku || '').toUpperCase();
                            const name = (p.name || '').toLowerCase();
                            return !(sku.includes('MYO') ||
                                     sku.includes('MAKE-YOUR-OWN') ||
                                     name.includes('make your own'));
                        });

                        return (
                            <Box
                                key={containerName}
                                id={getContainerAnchorId(containerName, title)}
                                sx={{ mb: 4, scrollMarginTop: '80px', overflow: 'hidden', maxWidth: '100%' }}
                            >
                                {/* Container Group Header with optional banner image (16:9) */}
                                {containerImage && (
                                    <Box
                                        sx={{
                                            position: 'relative',
                                            width: '100%',
                                            paddingTop: '56.25%', // 16:9 aspect ratio
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                            mb: 2
                                        }}
                                    >
                                        <img
                                            src={containerImage}
                                            alt={containerName}
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
                                )}
                                <Typography
                                    variant="h6"
                                    component="h3"
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

                                {/* MYO Hero Area */}
                                {myoProduct && (
                                    <Box
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`${myoProduct.name} - Create Your Own`}
                                        onClick={() => onProductClick(myoProduct.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onProductClick(myoProduct.id);
                                            }
                                        }}
                                        sx={{
                                            position: 'relative',
                                            width: '100%',
                                            borderRadius: 3,
                                            overflow: 'hidden',
                                            mb: 3,
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s',
                                            '&:hover': {
                                                transform: 'scale(1.01)',
                                            },
                                            '&:focus-visible': {
                                                outline: '2px solid #1976d2',
                                                outlineOffset: '2px'
                                            },
                                        }}
                                    >
                                        {/* Hero Image */}
                                        <Box
                                            sx={{
                                                position: 'relative',
                                                width: '100%',
                                                paddingTop: { xs: '75%', md: '50%' },
                                            }}
                                        >
                                            <img
                                                src={myoProduct.imageUrl || 'https://placehold.co/800x400/e0e0e0/666666?text=Make+Your+Own'}
                                                srcSet={myoProduct.pwa ? `${myoProduct.pwa.heroSm} 800w, ${myoProduct.pwa.heroMd} 1280w, ${myoProduct.pwa.heroLg} 1920w` : undefined}
                                                sizes={myoProduct.pwa ? "(max-width: 600px) 100vw, (max-width: 960px) 100vw, 900px" : undefined}
                                                alt={myoProduct.imageAlt || myoProduct.name}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                }}
                                            />
                                            {/* Gradient overlay */}
                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    left: 0,
                                                    right: 0,
                                                    height: '60%',
                                                    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                                                }}
                                            />
                                            {/* Text overlay */}
                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    left: 0,
                                                    right: 0,
                                                    p: { xs: 2, sm: 3 },
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <Typography
                                                    sx={{
                                                        color: 'white',
                                                        fontWeight: 700,
                                                        fontSize: { xs: '1.6rem', sm: '1.8rem' },
                                                        textAlign: 'center',
                                                        textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    {myoProduct.name}
                                                </Typography>
                                                <Typography
                                                    sx={{
                                                        color: 'rgba(255,255,255,0.9)',
                                                        fontSize: '1.6rem',
                                                        textAlign: 'center',
                                                        mb: 1.5,
                                                    }}
                                                >
                                                    Starting from {myoProduct.price || `$${parseFloat(myoProduct.availableVariants?.[0]?.price || '0').toFixed(2)}`}
                                                </Typography>
                                                <Button
                                                    variant="contained"
                                                    sx={{
                                                        bgcolor: 'white',
                                                        color: '#333',
                                                        fontWeight: 700,
                                                        fontSize: '1.6rem',
                                                        px: { xs: 3, sm: 4 },
                                                        py: { xs: 1, sm: 1.25 },
                                                        borderRadius: 2,
                                                        textTransform: 'none',
                                                        '&:hover': {
                                                            bgcolor: 'rgba(255,255,255,0.9)',
                                                        },
                                                    }}
                                                >
                                                    Create Your Own
                                                </Button>
                                            </Box>
                                        </Box>
                                    </Box>
                                )}

                                {/* Product Grid - excludes MYO products (they're in the builder) */}
                                {nonMyoProducts.length > 0 && (
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
                                        {nonMyoProducts.map((product) => (
                                            <Box key={product.id} sx={{ height: '100%' }}>
                                                <ProductCard
                                                    product={product}
                                                    onClick={() => onProductClick(product.id)}
                                                    discountPercent={discountPercent}
                                                    productDiscount={productDiscount}
                                                    subcategoryName={subcategoryName}
                                                    allProducts={allProducts}
                                                />
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        );
                    })
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
    const { storeLocations = [], selectedLocation } = useCatalog();
    const selectedLocationId = selectedLocation || localStorage.getItem('selectedLocation');
    const warehouseIds = storeLocations.filter(l => l.type === 'Warehouse').map(l => l.id);
    const inv = product.inventory;
    const isTracked = inv?.trackInventory;
    const locations = inv?.byLocation || [];
    const storeQty = isTracked && selectedLocationId
        ? locations.find(l => l.locationId === selectedLocationId)?.quantity || 0
        : null;
    const warehouseQty = isTracked
        ? locations.filter(l => warehouseIds.includes(l.locationId)).reduce((sum, l) => sum + Math.max(0, l.quantity || 0), 0)
        : 0;
    const otherRetailQty = isTracked
        ? locations.filter(l => l.locationId && l.locationId !== selectedLocationId && !warehouseIds.includes(l.locationId)).reduce((sum, l) => sum + Math.max(0, l.quantity || 0), 0)
        : 0;
    const anyLocationHasStock = locations.some(l => (l.quantity || 0) > 0);
    const allowsShipping = !product.fulfillmentMethods?.length || product.fulfillmentMethods.includes('shipping');
    const canShipFromAnywhere = allowsShipping && locations.some(l => {
        if ((l.quantity || 0) <= 0) return false;
        const loc = storeLocations.find(sl => sl.id === l.locationId);
        return loc && !loc.disableShipping;
    });
    const isSoldOut = isTracked && (!anyLocationHasStock || (storeQty != null && storeQty <= 0 && !canShipFromAnywhere));
    const hasLocalStock = !isTracked || (storeQty != null && storeQty > 0);
    const fm = product.fulfillmentMethods?.length > 0 ? product.fulfillmentMethods : ['pickup', 'delivery', 'shipping'];
    const pickupOk = hasLocalStock && fm.includes('pickup');
    const deliveryOk = hasLocalStock && fm.includes('delivery');
    const shippingOk = canShipFromAnywhere;
    const showFulfillment = isTracked && !isSoldOut;

    return (
        <Box
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            sx={{
                cursor: 'pointer',
                transition: 'transform 0.2s',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                    transform: 'scale(1.02)'
                },
                '&:focus-visible': {
                    outline: '2px solid #1976d2',
                    outlineOffset: '2px'
                }
            }}
        >
            {/* Sold Out Banner — above image */}
            {isSoldOut && (
                <Box sx={{ bgcolor: 'rgba(180, 30, 30, 1)', py: 0.5, textAlign: 'center', borderRadius: '8px 8px 0 0' }}>
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.4rem', letterSpacing: 2, textTransform: 'uppercase' }}>
                        Sold Out
                    </Typography>
                </Box>
            )}

            {/* Product Image */}
            <Box
                sx={{
                    position: 'relative',
                    paddingTop: featured ? '60%' : '100%', // Wider aspect ratio for featured
                    borderRadius: isSoldOut ? '0 0 8px 8px' : 2,
                    overflow: 'hidden',
                    backgroundColor: featured ? 'primary.light' : 'grey.200',
                    mb: 1,
                    flexShrink: 0,
                    ...(featured && {
                        border: '2px solid',
                        borderColor: 'primary.main',
                    })
                }}
            >
                <img
                    src={product.imageUrl || 'https://placehold.co/400x400/e0e0e0/666666?text=Product'}
                    srcSet={product.pwa ? `${product.pwa.xs || product.pwa.sm} 320w, ${product.pwa.sm} 480w, ${product.pwa.md} 960w, ${product.pwa.lg} 1440w` : undefined}
                    sizes={product.pwa ? "(max-width: 600px) 45vw, (max-width: 960px) 33vw, 300px" : undefined}
                    alt={product.imageAlt || product.name}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        ...(isSoldOut ? { filter: 'grayscale(100%)' } : {})
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
                    fontWeight: featured ? 600 : 400,
                    mb: 0.5,
                    fontSize: featured ? '1.8rem' : '1.6rem',
                    textAlign: 'center'
                }}
            >
                {product.name}
            </Typography>

            {/* Featured badge for MYO products */}
            {featured && (
                <Typography
                    sx={{
                        fontSize: '1.6rem',
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
                        const locSlug = localStorage.getItem('selectedLocation');
                        const locPrice = locSlug && variant.locationPrices?.[locSlug];
                        const originalPrice = parseFloat(locPrice != null ? locPrice : variant.price);
                        const discountedPrice = discountPercent
                            ? originalPrice * (1 - discountPercent / 100)
                            : null;

                        return (
                            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {variant.name || variant.catalogName || variant.sizeData?.title || variant.size || 'Regular'}
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
                                            <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0 }}>Sale: </span>
                                            ${discountedPrice.toFixed(2)}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: '#757575',
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
                                <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0 }}>Sale: </span>
                                ${discountedPrice.toFixed(2)}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: '#757575',
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

            {showFulfillment && (
                <Box sx={{ mt: 0.5, textAlign: 'center' }}>
                    {shippingOk && <Typography variant="caption" sx={{ display: 'block', color: 'success.main', fontWeight: 700 }}>Shipping</Typography>}
                    {pickupOk && <Typography variant="caption" sx={{ display: 'block', color: 'success.main', fontWeight: 700 }}>Pickup</Typography>}
                    {deliveryOk && <Typography variant="caption" sx={{ display: 'block', color: 'success.main', fontWeight: 700 }}>Delivery</Typography>}
                </Box>
            )}
        </Box>
    );
};

export { ProductCard };
export default Section;
