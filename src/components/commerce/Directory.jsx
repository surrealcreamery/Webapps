import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { useCatalog } from '@/contexts/commerce/CatalogContext';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { useCart } from '@/hooks/useCart';
import { useLocation, useNavigate } from 'react-router-dom';
import { Section } from '@/components/commerce/Section';
import { ProductModal } from '@/components/commerce/ProductModal';
import { CartDrawer } from '@/components/commerce/CartDrawer';
import { sortProductsByOrder } from '@/services/catalogService';

/**
 * CategoryCard - Clickable category card with image
 */
const CategoryCard = ({ category, onClick }) => {
    const imageUrl = category.image?.url || `https://placehold.co/300x300/f5f5f5/666666?text=${encodeURIComponent(category.name)}`;

    return (
        <Box
            role="button"
            tabIndex={0}
            aria-label={`View ${category.name}`}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            sx={{
                cursor: 'pointer',
                '&:hover': { opacity: 0.85, transform: 'scale(1.02)' },
                '&:focus-visible': { outline: '2px solid #1976d2', outlineOffset: '2px' },
                transition: 'all 0.2s'
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
                    src={imageUrl}
                    alt={category.name}
                    onError={(e) => {
                        e.target.src = `https://placehold.co/300x300/f5f5f5/666666?text=${encodeURIComponent(category.name)}`;
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
                {category.name}
            </Typography>
        </Box>
    );
};

/**
 * Directory Page - Browse all products by category
 * Main product catalog organized by desserts and merchandise
 */
export const Directory = () => {
    const { allProducts: products, catalog, isLoading: loading, storeLocations } = useCatalog();
    const localCart = useCart();
    const { commerceState, sendToCommerce } = useContext(LayoutContext);
    const location = useLocation();
    const navigate = useNavigate();

    // Get state from machine
    const showProductModal = commerceState.context.showProductModal;
    const selectedProductId = commerceState.context.selectedProductId;
    const showCartDrawer = commerceState.context.showCartDrawer;

    const isInternalNavigation = useRef(false);

    // Build category lookup and tree from catalog
    const { categoryMap, categoryChildren } = useMemo(() => {
        if (!catalog?.categories) return { categoryMap: {}, categoryChildren: {} };

        const map = {};
        const children = {};

        // Build map by ID
        catalog.categories.forEach(cat => {
            map[cat.id] = cat;
            children[cat.id] = [];
        });

        // Build children arrays
        catalog.categories.forEach(cat => {
            if (cat.parentId && children[cat.parentId]) {
                children[cat.parentId].push(cat);
            }
        });

        // Sort children by position
        Object.values(children).forEach(arr => {
            arr.sort((a, b) => (a.position || 0) - (b.position || 0));
        });

        return { categoryMap: map, categoryChildren: children };
    }, [catalog]);

    // Find category by name (case-insensitive)
    const findCategoryByName = (name) => {
        if (!catalog?.categories) return null;
        return catalog.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    };

    // Get subcategories of a category
    const getSubcategories = (categoryId) => {
        return categoryChildren[categoryId] || [];
    };

    // Get all descendant categories (recursive)
    const getAllDescendants = (categoryId) => {
        const descendants = [];
        const children = categoryChildren[categoryId] || [];
        children.forEach(child => {
            descendants.push(child);
            descendants.push(...getAllDescendants(child.id));
        });
        return descendants;
    };

    // Handle hash navigation (scroll to section)
    useEffect(() => {
        if (location.hash) {
            const sectionId = location.hash.replace('#', '');
            const element = document.getElementById(`${sectionId}-section`);
            
            if (element) {
                // Small delay to ensure content is rendered
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    }, [location.hash]);

    // Category definitions
    const CATEGORIES = {
        desserts: {
            title: "Frozen Treats & Desserts",
            description: "Handcrafted tokidoki desserts",
            subcategories: {
                milkshakes: {
                    title: "Milkshakes",
                    description: "Thick & creamy blended treats",
                    filter: (product) => product.tags?.includes('milkshake')
                },
                iceCream: {
                    title: "Ice Cream",
                    description: "Available in Cup, Cone, or Jar",
                    filter: (product) => product.tags?.includes('ice-cream') && !product.tags?.includes('milkshake')
                },
                bubbleTea: {
                    title: "Bubble Tea (Floteas)",
                    description: "Boba tea with ice cream",
                    filter: (product) => product.tags?.includes('bubble-tea') || product.tags?.includes('flotea')
                },
                cake: {
                    title: "Cake",
                    description: "Ice cream cake cups and jars",
                    filter: (product) => product.tags?.includes('cake')
                }
            }
        },
        merchandise: {
            title: "tokidoki Collectibles",
            description: "Limited edition blind box collectibles",
            subcategories: {
                blindBoxes: {
                    title: "Blind Box Collectibles",
                    description: "Mystery tokidoki figures",
                    filter: (product) => product.tags?.includes('blind-box')
                }
            }
        }
    };

    // Get merged productOrder from ALL categories in catalog
    // This allows products to be sorted by their respective category orders
    const getMergedProductOrder = () => {
        if (!catalog?.categories) {
            console.log('[Directory] getMergedProductOrder: no catalog');
            return [];
        }
        // Collect all SKUs from all productOrder arrays, maintaining relative order
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
        console.log('[Directory] getMergedProductOrder:', allOrdered.length, 'SKUs');
        return allOrdered;
    };

    // Filter products by category
    const getProductsByCategory = (categoryKey) => {
        console.log('🔍 Filtering by category:', categoryKey);
        console.log('🔍 Total products:', products.length);

        let filtered;
        if (categoryKey === 'desserts') {
            filtered = products.filter(p => p.productType === 'desserts' || p.category === 'desserts');
        } else if (categoryKey === 'merchandise') {
            filtered = products.filter(p => p.productType === 'merchandise' || p.category === 'merchandise');
        } else {
            filtered = [];
        }

        // Sort by merged productOrder from all catalog categories
        const productOrder = getMergedProductOrder();
        if (productOrder.length > 0) {
            filtered = sortProductsByOrder(filtered, productOrder);
            console.log('🔍 Sorted by productOrder:', productOrder.slice(0, 5), '...');
        }

        console.log('🔍 Filtered products:', filtered.length);
        console.log('🔍 Products:', filtered.map(p => p.name));

        return filtered;
    };

    // Filter products by subcategory
    const getProductsBySubcategory = (categoryKey, subcategoryKey) => {
        const categoryProducts = getProductsByCategory(categoryKey);
        const subcategory = CATEGORIES[categoryKey]?.subcategories?.[subcategoryKey];
        
        if (!subcategory || !subcategory.filter) {
            return [];
        }

        return categoryProducts.filter(subcategory.filter);
    };

    const handleProductClick = (productId) => {
        // Ensure productId is a string
        const id = typeof productId === 'string' ? productId : productId?.id || String(productId);
        
        console.log('📍 Directory: Product clicked:', id);
        isInternalNavigation.current = true;
        sendToCommerce({ type: 'VIEW_PRODUCT', productId: id });
        navigate(`/product/${id}`, { replace: false });
    };
    
    // Handle closing product modal
    const handleCloseProductModal = () => {
        sendToCommerce({ type: 'CLOSE_PRODUCT' });
        navigate('/directory', { replace: true });
    };
    
    // Find selected product
    const selectedProduct = selectedProductId 
        ? products.find(p => {
            const idToMatch = typeof selectedProductId === 'string' 
                ? selectedProductId 
                : selectedProductId?.id;
            return p.id === idToMatch;
        })
        : null;

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }} role="status" aria-busy="true">
                <Typography>Loading products...</Typography>
            </Container>
        );
    }

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: 'white' }}>
            {/* Category Grid - at top */}
            <Container maxWidth="md" sx={{ pt: 3, pb: 2 }}>
                <Box 
                    sx={{ 
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 2,
                        mb: 4,
                        maxWidth: '500px',
                        margin: '0 auto',
                        marginBottom: 4,
                        justifyContent: 'center'
                    }}
                >
                    {/* Desserts */}
                    <Box
                        role="button"
                        tabIndex={0}
                        aria-label="Jump to Desserts"
                        onClick={() => {
                            const element = document.getElementById('desserts-section');
                            element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                const element = document.getElementById('desserts-section');
                                element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }}
                        sx={{
                            cursor: 'pointer',
                            width: 'calc(50% - 8px)',
                            '&:hover': { opacity: 0.8 },
                            '&:focus-visible': { outline: '2px solid #1976d2', outlineOffset: '2px' }
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
                                src="https://images.surrealcreamery.com/commerce/category-images/desserts.png"
                                alt="Desserts"
                                onError={(e) => {
                                    e.target.src = 'https://placehold.co/300x300/FFB6C1/000000?text=Desserts';
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
                            Desserts
                        </Typography>
                    </Box>

                    {/* Collectibles */}
                    <Box
                        role="button"
                        tabIndex={0}
                        aria-label="Jump to Collectibles"
                        onClick={() => {
                            const element = document.getElementById('merchandise-section');
                            element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                const element = document.getElementById('merchandise-section');
                                element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }}
                        sx={{
                            cursor: 'pointer',
                            width: 'calc(50% - 8px)',
                            '&:hover': { opacity: 0.8 },
                            '&:focus-visible': { outline: '2px solid #1976d2', outlineOffset: '2px' }
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
                                src="https://images.surrealcreamery.com/commerce/category-images/merchandise.png"
                                alt="Collectibles"
                                onError={(e) => {
                                    e.target.src = 'https://placehold.co/300x300/87CEEB/000000?text=Collectibles';
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
                            Collectibles
                        </Typography>
                    </Box>
                </Box>
            </Container>

            {/* DESSERTS - Main Category */}
            <Box id="desserts-section" sx={{ mb: 6 }}>
                <Container maxWidth="md" sx={{ mb: 2 }}>
                    <Typography
                        variant="h2"
                        sx={{
                            fontWeight: 700,
                            fontSize: { xs: '2rem', md: '2.5rem' },
                            mb: 1
                        }}
                    >
                        {CATEGORIES.desserts.title}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {CATEGORIES.desserts.description}
                    </Typography>
                </Container>

                {/* Dessert Subcategories Grid - Shows all descendants with images */}
                {(() => {
                    const dessertsCategory = findCategoryByName('Desserts');
                    console.log('[Directory] Desserts category:', dessertsCategory);
                    if (!dessertsCategory) return null;

                    // Get all descendants (not just direct children) that have images
                    const allDescendants = getAllDescendants(dessertsCategory.id);
                    console.log('[Directory] All descendants:', allDescendants.map(c => ({ name: c.name, hasImage: !!c.image?.url })));

                    const subcategoriesWithImages = allDescendants
                        .filter(cat => cat.image?.url)
                        .sort((a, b) => (a.position || 0) - (b.position || 0));

                    console.log('[Directory] Subcategories with images:', subcategoriesWithImages.map(c => c.name));

                    if (subcategoriesWithImages.length === 0) return null;

                    return (
                        <Container maxWidth="md" sx={{ mb: 4 }}>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: {
                                        xs: 'repeat(2, 1fr)',
                                        sm: 'repeat(3, 1fr)',
                                        md: 'repeat(4, 1fr)'
                                    },
                                    gap: 2
                                }}
                            >
                                {subcategoriesWithImages.map(subcat => (
                                    <CategoryCard
                                        key={subcat.id}
                                        category={subcat}
                                        onClick={() => {
                                            // Scroll to the products section
                                            const element = document.getElementById('desserts-products');
                                            element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }}
                                    />
                                ))}
                            </Box>
                        </Container>
                    );
                })()}

                {/* All Desserts Section - Shows everything */}
                <Box id="desserts-products">
                    <Section
                        title="All Desserts"
                        description="Browse our complete collection"
                        products={getProductsByCategory('desserts')}
                        onProductClick={handleProductClick}
                        showDivider={false}
                    />
                </Box>
            </Box>

            {/* MERCHANDISE - Main Category */}
            <Box id="merchandise-section">
                <Container maxWidth="md" sx={{ mb: 2 }}>
                    <Typography 
                        variant="h2" 
                        sx={{ 
                            fontWeight: 700,
                            fontSize: { xs: '2rem', md: '2.5rem' },
                            mb: 1
                        }}
                    >
                        {CATEGORIES.merchandise.title}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {CATEGORIES.merchandise.description}
                    </Typography>
                </Container>

                {/* All Merchandise Section - Shows everything */}
                <Section
                    title="All Collectibles"
                    description="Browse our complete collection"
                    products={getProductsByCategory('merchandise')}
                    onProductClick={handleProductClick}
                    showDivider={false}
                />

                {/* Merchandise Subcategories */}
                <Section
                    title="Blind Box Collectibles"
                    description="Mystery tokidoki figures"
                    products={getProductsBySubcategory('merchandise', 'blindBoxes')}
                    onProductClick={handleProductClick}
                />
            </Box>

            {/* Product Modal */}
            {showProductModal && selectedProductId && selectedProduct && (
                <ProductModal
                    open={showProductModal}
                    product={selectedProduct}
                    onClose={handleCloseProductModal}
                    onAddToCart={async (productId, variantId, quantity, customAttributes) => {
                        const product = products.find(p => p.id === productId);
                        const variant = product?.variants?.find(v => v.id === variantId) || product?.variants?.[0];
                        const modifiers = (customAttributes || [])
                            .filter(a => !a.key?.startsWith('_'))
                            .map(a => ({ key: a.key, value: a.value, price: a.price || 0, modifierDetails: a.modifierDetails || [] }));
                        localCart.addToCart(product, variant, quantity, modifiers);
                        sendToCommerce({ type: 'SHOW_CART_BANNER' });
                        setTimeout(() => {
                            sendToCommerce({ type: 'HIDE_CART_BANNER' });
                        }, 3000);
                    }}
                    storeLocations={storeLocations}
                />
            )}

            {/* Cart Drawer */}
            {showCartDrawer && (
                <CartDrawer
                    open={showCartDrawer}
                    onClose={() => sendToCommerce({ type: 'CLOSE_CART_DRAWER' })}
                    localCart={localCart}
                />
            )}
        </Box>
    );
};

export default Directory;
