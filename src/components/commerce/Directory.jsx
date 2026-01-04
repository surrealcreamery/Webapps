import React, { useState, useEffect, useContext, useRef } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { useShopify } from '@/contexts/commerce/ShopifyContext_GraphQL';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Section } from '@/components/commerce/Section';
import { ProductModal } from '@/components/commerce/ProductModal';
import { CartDrawer } from '@/components/commerce/CartDrawer';

/**
 * Directory Page - Browse all products by category
 * Main product catalog organized by desserts and merchandise
 */
export const Directory = () => {
    const { products, loading, addToCart } = useShopify();
    const { commerceState, sendToCommerce } = useContext(LayoutContext);
    const location = useLocation();
    const navigate = useNavigate();
    
    // Get state from machine
    const showProductModal = commerceState.context.showProductModal;
    const selectedProductId = commerceState.context.selectedProductId;
    const showCartDrawer = commerceState.context.showCartDrawer;
    
    const isInternalNavigation = useRef(false);

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
            <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
                <Typography>Loading products...</Typography>
            </Container>
        );
    }

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: 'white' }}>
            {/* Category Grid - at top */}
            <Container maxWidth="sm" sx={{ pt: 3, pb: 2 }}>
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
                        onClick={() => {
                            const element = document.getElementById('desserts-section');
                            element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

                    {/* Merchandise */}
                    <Box 
                        onClick={() => {
                            const element = document.getElementById('merchandise-section');
                            element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                                src="https://images.surrealcreamery.com/commerce/category-images/merchandise.png"
                                alt="Merchandise"
                                onError={(e) => {
                                    e.target.src = 'https://placehold.co/300x300/87CEEB/000000?text=Merchandise';
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
                            Merchandise
                        </Typography>
                    </Box>
                </Box>
            </Container>

            {/* DESSERTS - Main Category */}
            <Box id="desserts-section" sx={{ mb: 6 }}>
                <Container maxWidth="sm" sx={{ mb: 2 }}>
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

                {/* All Desserts Section - Shows everything */}
                <Section
                    title="All Desserts"
                    description="Browse our complete collection"
                    products={getProductsByCategory('desserts')}
                    onProductClick={handleProductClick}
                    showDivider={false}
                />
            </Box>

            {/* MERCHANDISE - Main Category */}
            <Box id="merchandise-section">
                <Container maxWidth="sm" sx={{ mb: 2 }}>
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
                    onAddToCart={async (productId, variantId, quantity) => {
                        try {
                            await addToCart(variantId, quantity);
                            sendToCommerce({ type: 'SHOW_CART_BANNER' });
                            
                            setTimeout(() => {
                                sendToCommerce({ type: 'HIDE_CART_BANNER' });
                            }, 3000);
                        } catch (error) {
                            console.error('Error adding to cart:', error);
                        }
                    }}
                />
            )}

            {/* Cart Drawer */}
            {showCartDrawer && (
                <CartDrawer
                    open={showCartDrawer}
                    onClose={() => sendToCommerce({ type: 'CLOSE_CART_DRAWER' })}
                />
            )}
        </Box>
    );
};

export default Directory;
