import React from 'react';
import { Box, Typography, Container } from '@mui/material';

const PLACEHOLDER_IMAGE = 'https://placehold.co/300x300/e0e0e0/666666?text=Category';

export const CategoryListView = ({ menu, sendToCatering }) => {
    const categories = Object.entries(menu);

    // Get all products from all categories for featured section
    const allProducts = categories.flatMap(([categoryName, categoryData]) =>
        (categoryData.items || []).map(item => ({ ...item, categoryName }))
    );

    // Featured products - first 6 items (or however many exist)
    const featuredProducts = allProducts.slice(0, 6);

    const handleProductClick = (item) => {
        // First select the category
        sendToCatering({ type: 'SELECT_CATEGORY', category: item.categoryName });

        // Then view the item
        setTimeout(() => {
            const hasModifiers = item.ModifierCategories && item.ModifierCategories.length > 0;
            if (hasModifiers) {
                sendToCatering({ type: 'EDIT_ITEM', item });
            } else {
                sendToCatering({ type: 'VIEW_ITEM', item });
            }
        }, 50);
    };

    return (
        <Box sx={{ backgroundColor: 'white' }}>

            {/* Category Grid */}
            <Box sx={{ pt: 1, pb: 2 }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 2,
                        maxWidth: '500px',
                        margin: '0 auto',
                        justifyContent: 'center'
                    }}
                >
                    {categories.map(([categoryName, categoryData]) => {
                        const imageSrc = categoryData.image || PLACEHOLDER_IMAGE;

                        return (
                            <Box
                                key={categoryName}
                                onClick={() => sendToCatering({ type: 'SELECT_CATEGORY', category: categoryName })}
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
                                        src={imageSrc}
                                        alt={categoryName}
                                        onError={(e) => {
                                            e.target.src = PLACEHOLDER_IMAGE;
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
                                    {categoryName}
                                </Typography>
                                {categoryData.description && categoryData.description.length > 0 && (
                                    <Typography
                                        variant="body2"
                                        align="center"
                                        color="text.secondary"
                                        sx={{ mt: 0.5, px: 1 }}
                                    >
                                        {categoryData.description[0]}
                                    </Typography>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* Featured Products Section */}
            {featuredProducts.length > 0 && (
                <Box sx={{ py: 4, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography
                        variant="h3"
                        component="h2"
                        sx={{
                            fontWeight: 700,
                            mb: 1,
                            fontSize: { xs: '1.75rem', md: '2.25rem' }
                        }}
                    >
                        Featured Products
                    </Typography>
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ mb: 3 }}
                    >
                        Popular catering options
                    </Typography>

                    {/* Product Grid */}
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr 1fr',
                                sm: '1fr 1fr',
                                md: '1fr 1fr 1fr'
                            },
                            gap: 3
                        }}
                    >
                        {featuredProducts.map((item) => (
                            <ProductCard
                                key={item['Item ID']}
                                item={item}
                                onClick={() => handleProductClick(item)}
                            />
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
};

const ProductCard = ({ item, onClick }) => {
    const imageUrl = item['Item Image'] || 'https://placehold.co/300x300/e0e0e0/666666?text=Product';
    const price = item['Item Price'] || 0;

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
                    paddingTop: '100%',
                    borderRadius: 2,
                    overflow: 'hidden',
                    backgroundColor: 'grey.200',
                    mb: 1
                }}
            >
                <img
                    src={imageUrl}
                    alt={item['Item Name']}
                    onError={(e) => {
                        e.target.src = 'https://placehold.co/300x300/e0e0e0/666666?text=Product';
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

            {/* Product Info */}
            <Typography
                variant="body1"
                sx={{
                    fontWeight: 600,
                    mb: 0.5
                }}
            >
                {item['Item Name']}
            </Typography>

            <Typography
                variant="body2"
                color="text.secondary"
            >
                ${price.toFixed(2)}
            </Typography>
        </Box>
    );
};

export default CategoryListView;
