import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Box, Typography, Stack, ToggleButtonGroup, ToggleButton, Button } from '@mui/material';
import { HeroSection } from '@/components/commerce/HeroSection';
import { DetailCard } from '@/components/commerce/DetailCard';
import { DirectorySection } from '@/components/commerce/DirectorySection';

/**
 * Commerce.jsx - Self-contained commerce pages
 * Handles:
 * - Category browsing/listing
 * - Product detail pages
 * - Product filtering
 */

const Commerce = () => {
    const { view, id } = useParams(); // view can be 'category' or 'product'
    const navigate = useNavigate();
    
    // State
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [currentCategory, setCurrentCategory] = useState(null);
    const [currentProduct, setCurrentProduct] = useState(null);
    const [filter, setFilter] = useState('All');
    const [loading, setLoading] = useState(true);

    // Fetch data on mount
    useEffect(() => {
        fetchData();
    }, [view, id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // TODO: Replace with your actual API calls
            if (view === 'category' && id) {
                // Fetch category details and its products
                const categoryData = await fetchCategory(id);
                const productsData = await fetchProductsByCategory(id);
                setCurrentCategory(categoryData);
                setProducts(productsData);
            } else if (view === 'product' && id) {
                // Fetch product details
                const productData = await fetchProduct(id);
                setCurrentProduct(productData);
            } else {
                // Fetch all categories for directory
                const categoriesData = await fetchCategories();
                setCategories(categoriesData);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Mock API functions - replace with your actual API
    const fetchCategories = async () => {
        // Example structure
        return [
            {
                id: 'ice-cream',
                name: 'Ice Cream',
                imageUrl: '/images/categories/ice-cream.jpg',
                description: 'Delicious handcrafted ice cream flavors'
            },
            {
                id: 'toppings',
                name: 'Toppings',
                imageUrl: '/images/categories/toppings.jpg',
                description: 'Premium toppings and mix-ins'
            }
        ];
    };

    const fetchCategory = async (categoryId) => {
        // Example structure
        return {
            id: categoryId,
            name: 'Ice Cream',
            imageUrl: '/images/categories/ice-cream.jpg',
            description: 'Our handcrafted ice cream is made fresh daily with premium ingredients.',
            bulletPoints: '🍦 Made fresh daily\n🥛 Premium ingredients\n✨ Unique flavors'
        };
    };

    const fetchProductsByCategory = async (categoryId) => {
        // Example structure
        return [
            {
                id: 'vanilla',
                name: 'Vanilla Bean',
                imageUrl: '/images/products/vanilla.jpg',
                price: 5.99,
                description: 'Classic vanilla with real vanilla bean',
                inStock: true,
                isNew: false
            },
            {
                id: 'chocolate',
                name: 'Dark Chocolate',
                imageUrl: '/images/products/chocolate.jpg',
                price: 5.99,
                description: 'Rich dark chocolate ice cream',
                inStock: true,
                isNew: true
            }
        ];
    };

    const fetchProduct = async (productId) => {
        // Example structure
        return {
            id: productId,
            name: 'Vanilla Bean',
            categoryId: 'ice-cream',
            imageUrl: '/images/products/vanilla.jpg',
            price: 5.99,
            description: 'Our classic vanilla ice cream features real Madagascar vanilla beans for an authentic, rich flavor.',
            bulletPoints: '✨ Real vanilla beans\n🥛 Made with whole milk\n🌱 Gluten-free',
            ingredients: 'Milk, Cream, Sugar, Vanilla Bean, Egg Yolks',
            allergens: 'Contains: Milk, Eggs',
            nutrition: {
                servingSize: '1/2 cup (65g)',
                calories: 140,
                fat: '7g',
                carbs: '17g',
                protein: '3g'
            },
            inStock: true,
            sku: 'IC-VAN-001'
        };
    };

    // Handlers
    const handleCategoryClick = (categoryId) => {
        navigate(`/commerce/category/${categoryId}`);
    };

    const handleProductClick = (productId) => {
        navigate(`/commerce/product/${productId}`);
    };

    const handleAddToCart = (product) => {
        // TODO: Implement add to cart logic
        console.log('Add to cart:', product);
        alert(`Added ${product.name} to cart!`);
    };

    const handleBackToCategory = () => {
        if (currentProduct) {
            navigate(`/commerce/category/${currentProduct.categoryId}`);
        }
    };

    const handleViewAllCategories = () => {
        navigate('/commerce');
    };

    // Filter products
    const filteredProducts = products.filter(p => {
        if (filter === 'All') return true;
        if (filter === 'In Stock') return p.inStock;
        if (filter === 'New') return p.isNew;
        return true;
    });

    // Render loading state
    if (loading) {
        return (
            <Container maxWidth="sm" sx={{ pt: 4, pb: 4 }}>
                <Typography align="center">Loading...</Typography>
            </Container>
        );
    }

    // Render: Categories Directory (Homepage)
    if (!view || view === 'categories') {
        return (
            <DirectorySection
                title="Shop by Category"
                items={categories}
                onItemClick={handleCategoryClick}
            />
        );
    }

    // Render: Category Page (Product Listing)
    if (view === 'category' && currentCategory) {
        return (
            <Container maxWidth="sm" sx={{ pt: 0, pb: 4 }}>
                {/* Category Hero */}
                <HeroSection
                    title={currentCategory.name}
                    imageUrl={currentCategory.imageUrl}
                    description={currentCategory.description}
                    bulletPoints={currentCategory.bulletPoints}
                    isSingleLocation={false}
                />

                {/* Filters */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 3 }}>
                    <ToggleButtonGroup
                        color="primary"
                        value={filter}
                        exclusive
                        onChange={(e, newFilter) => newFilter && setFilter(newFilter)}
                        aria-label="Filter products"
                    >
                        <ToggleButton value="All">All</ToggleButton>
                        <ToggleButton value="In Stock">In Stock</ToggleButton>
                        <ToggleButton value="New">New</ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                {/* Products Grid */}
                <Stack spacing={3}>
                    {filteredProducts.length > 0 ? (
                        filteredProducts.map(product => (
                            <Box
                                key={product.id}
                                onClick={() => handleProductClick(product.id)}
                                sx={{
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    '&:hover': { transform: 'scale(1.02)', boxShadow: 6 },
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'grey.300'
                                }}
                            >
                                <Box sx={{ height: 200, backgroundColor: 'grey.200' }}>
                                    <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </Box>
                                <Box sx={{ p: 2 }}>
                                    <Typography variant="h3" sx={{ mb: 1 }}>{product.name}</Typography>
                                    <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 'bold', mb: 1 }}>
                                        ${product.price.toFixed(2)}
                                    </Typography>
                                    {product.isNew && (
                                        <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                                            NEW
                                        </Typography>
                                    )}
                                    <Typography variant="body2" color="text.secondary">
                                        {product.description}
                                    </Typography>
                                </Box>
                            </Box>
                        ))
                    ) : (
                        <Typography color="text.secondary" align="center">
                            No products found.
                        </Typography>
                    )}
                </Stack>

                {/* Back Button */}
                <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleViewAllCategories}
                    sx={{ mt: 3 }}
                >
                    View All Categories
                </Button>
            </Container>
        );
    }

    // Render: Product Detail Page
    if (view === 'product' && currentProduct) {
        return (
            <Container maxWidth="sm" sx={{ pt: 0, pb: 4 }}>
                {/* Product Hero */}
                <HeroSection
                    title={currentProduct.name}
                    imageUrl={currentProduct.imageUrl}
                    description={currentProduct.description}
                    bulletPoints={currentProduct.bulletPoints}
                    actions={[
                        {
                            label: `Add to Cart - $${currentProduct.price.toFixed(2)}`,
                            onClick: () => handleAddToCart(currentProduct),
                            variant: 'contained'
                        }
                    ]}
                    isSingleLocation={true}
                />

                {/* Product Details Card */}
                <DetailCard
                    title="Product Details"
                    metadata={{
                        'SKU': currentProduct.sku,
                        'Price': `$${currentProduct.price.toFixed(2)}`,
                        'Availability': currentProduct.inStock ? 'In Stock' : 'Out of Stock'
                    }}
                    sx={{ mb: 3 }}
                />

                {/* Ingredients Card */}
                {currentProduct.ingredients && (
                    <DetailCard
                        title="Ingredients"
                        description={currentProduct.ingredients}
                        sx={{ mb: 3 }}
                    />
                )}

                {/* Allergens Card */}
                {currentProduct.allergens && (
                    <DetailCard
                        title="Allergen Information"
                        description={currentProduct.allergens}
                        sx={{ mb: 3 }}
                    />
                )}

                {/* Nutrition Card */}
                {currentProduct.nutrition && (
                    <DetailCard
                        title="Nutrition Facts"
                        metadata={{
                            'Serving Size': currentProduct.nutrition.servingSize,
                            'Calories': currentProduct.nutrition.calories,
                            'Total Fat': currentProduct.nutrition.fat,
                            'Total Carbs': currentProduct.nutrition.carbs,
                            'Protein': currentProduct.nutrition.protein
                        }}
                        sx={{ mb: 3 }}
                    />
                )}

                {/* Navigation Buttons */}
                <Stack spacing={2}>
                    <Button
                        variant="outlined"
                        fullWidth
                        onClick={handleBackToCategory}
                    >
                        Back to {currentProduct.categoryId}
                    </Button>
                    <Button
                        variant="text"
                        fullWidth
                        onClick={handleViewAllCategories}
                    >
                        View All Categories
                    </Button>
                </Stack>
            </Container>
        );
    }

    // Fallback: 404
    return (
        <Container maxWidth="sm" sx={{ pt: 4, pb: 4 }}>
            <Typography variant="h1" align="center" sx={{ mb: 2 }}>
                Page Not Found
            </Typography>
            <Button
                variant="contained"
                fullWidth
                onClick={handleViewAllCategories}
            >
                View All Categories
            </Button>
        </Container>
    );
};

export default Commerce;
