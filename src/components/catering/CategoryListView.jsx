import React, { useState, useRef } from 'react';
import { Box, Typography, Container, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { GiWheat } from 'react-icons/gi';
import { FaLeaf, FaRecycle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const PLACEHOLDER_IMAGE = 'https://placehold.co/300x300/e0e0e0/666666?text=Category';

// Dietary Badge Components
export const GlutenFreeBadge = ({ size = 'medium' }) => {
    const sizes = {
        small: { width: 28, height: 28, iconSize: 18 },
        medium: { width: 36, height: 36, iconSize: 22 },
        large: { width: 44, height: 44, iconSize: 28 },
    };
    const s = sizes[size] || sizes.medium;

    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: s.width,
                height: s.height,
                borderRadius: '50%',
                backgroundColor: '#FFF8E1',
                border: '2px solid #F9A825',
            }}
            title="Gluten-Free"
        >
            {/* Wheat icon */}
            <GiWheat size={s.iconSize} color="#F9A825" />
        </Box>
    );
};

export const VeganBadge = ({ size = 'medium' }) => {
    const sizes = {
        small: { width: 28, height: 28, iconSize: 16 },
        medium: { width: 36, height: 36, iconSize: 20 },
        large: { width: 44, height: 44, iconSize: 26 },
    };
    const s = sizes[size] || sizes.medium;

    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: s.width,
                height: s.height,
                borderRadius: '50%',
                backgroundColor: '#E8F5E9',
                border: '2px solid #4CAF50',
            }}
            title="Vegan"
        >
            {/* Leaf icon */}
            <FaLeaf size={s.iconSize} color="#4CAF50" />
        </Box>
    );
};

export const SustainableBadge = ({ size = 'medium' }) => {
    const sizes = {
        small: { width: 28, height: 28, iconSize: 16 },
        medium: { width: 36, height: 36, iconSize: 20 },
        large: { width: 44, height: 44, iconSize: 26 },
    };
    const s = sizes[size] || sizes.medium;

    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: s.width,
                height: s.height,
                borderRadius: '50%',
                backgroundColor: '#E3F2FD',
                border: '2px solid #2196F3',
            }}
            title="Sustainable"
        >
            {/* Recycle icon */}
            <FaRecycle size={s.iconSize} color="#2196F3" />
        </Box>
    );
};

// Combined badge display component
export const DietaryBadges = ({ glutenFree, vegan, size = 'small' }) => {
    if (!glutenFree && !vegan) return null;

    return (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {glutenFree && <GlutenFreeBadge size={size} />}
            {vegan && <VeganBadge size={size} />}
        </Box>
    );
};

// Flavor categories
const FLAVOR_CATEGORIES = [
    { id: 'cake', label: 'Cake' },
    { id: 'cheesecake', label: 'Cheesecake' },
    { id: 'cookie', label: 'Cookie' },
];

// Hardcoded flavors with colors, dietary info, and category
const FLAVORS = {
    cake: [
        { name: "A'mour S'more", image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/amour-smore-mini-cake-jar.png', color: '#8B4513', glutenFree: false, vegan: false },
        { name: 'Chocolate Meltdown Overload', color: '#3D1C02', glutenFree: true, vegan: true },
        { name: 'Vanilla', color: '#F3E5AB', glutenFree: true, vegan: false },
        { name: 'All Very Strawberry', color: '#FF6B81', glutenFree: true, vegan: true },
        { name: 'Nom Nom Cookie', color: '#2C2C2C', glutenFree: false, vegan: false },
        { name: 'La La Red Velvet', color: '#C41E3A', glutenFree: false, vegan: false },
    ],
    cheesecake: [
        { name: "A'mour S'more", color: '#8B4513', glutenFree: false, vegan: false },
        { name: 'Chocolate Meltdown Overload', color: '#3D1C02', glutenFree: true, vegan: true },
        { name: 'Vanilla', color: '#F3E5AB', glutenFree: true, vegan: false },
        { name: 'All Very Strawberry', color: '#FF6B81', glutenFree: true, vegan: true },
        { name: 'Nom Nom Cookie', color: '#2C2C2C', glutenFree: false, vegan: false },
        { name: 'La La Red Velvet', color: '#C41E3A', glutenFree: false, vegan: false },
    ],
    cookie: [
        { name: "A'mour S'more", color: '#8B4513', glutenFree: false, vegan: false },
        { name: 'Chocolate Meltdown Overload', color: '#3D1C02', glutenFree: true, vegan: true },
        { name: 'Vanilla', color: '#F3E5AB', glutenFree: true, vegan: false },
        { name: 'All Very Strawberry', color: '#FF6B81', glutenFree: true, vegan: true },
        { name: 'Nom Nom Cookie', color: '#2C2C2C', glutenFree: false, vegan: false },
        { name: 'La La Red Velvet', color: '#C41E3A', glutenFree: false, vegan: false },
    ],
};

// Packaging options
const PACKAGING = [
    { name: 'Cake Jars', image: 'https://images.surrealcreamery.com/catering/packaging/cake-jars.png', sustainable: true },
    { name: 'Cupcake Trays', image: 'https://images.surrealcreamery.com/catering/packaging/cake-tray.png', sustainable: false },
];

// Animated flavor circle component
const AnimatedFlavorCircle = ({ flavor, onTearAway, isPlaced }) => {
    const [isAnimating, setIsAnimating] = useState(false);
    const circleRef = useRef(null);

    const handleClick = () => {
        if (isAnimating || isPlaced) return;

        setIsAnimating(true);

        // After animation completes, mark as placed
        setTimeout(() => {
            onTearAway(flavor);
            setIsAnimating(false);
        }, 600);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: isPlaced ? 'default' : 'pointer',
                opacity: isPlaced ? 0.4 : 1,
                transition: 'opacity 0.3s',
            }}
        >
            <motion.div
                ref={circleRef}
                onClick={handleClick}
                initial={false}
                animate={isAnimating ? {
                    y: [0, -15, -300],
                    x: [0, 10, 0],
                    rotate: [0, -8, 5, 0],
                    scale: [1, 1.15, 0.8],
                } : {}}
                transition={{
                    duration: 0.6,
                    ease: [0.25, 0.46, 0.45, 0.94],
                    times: [0, 0.3, 1],
                }}
                whileHover={!isPlaced && !isAnimating ? { scale: 1.08, rotate: -3 } : {}}
                whileTap={!isPlaced && !isAnimating ? { scale: 0.95 } : {}}
                style={{
                    cursor: isPlaced ? 'default' : 'pointer',
                    zIndex: isAnimating ? 1000 : 1,
                    position: 'relative',
                }}
            >
                {/* Image or Color Circle */}
                {flavor.image ? (
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            boxShadow: isAnimating
                                ? '0 12px 40px rgba(0,0,0,0.4)'
                                : '0 2px 8px rgba(0,0,0,0.15)',
                            border: '3px solid white',
                            outline: '1px solid #e0e0e0',
                            transition: 'box-shadow 0.2s',
                        }}
                    >
                        <img
                            src={flavor.image}
                            alt={flavor.name}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                    </Box>
                ) : (
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            backgroundColor: flavor.color,
                            boxShadow: isAnimating
                                ? '0 12px 40px rgba(0,0,0,0.4)'
                                : '0 2px 8px rgba(0,0,0,0.15)',
                            border: '3px solid white',
                            outline: '1px solid #e0e0e0',
                            transition: 'box-shadow 0.2s',
                        }}
                    />
                )}
            </motion.div>
            {/* Flavor Name */}
            <Typography
                variant="body2"
                sx={{
                    mt: 1,
                    fontWeight: 500,
                    textAlign: 'center',
                    fontSize: '1.4rem'
                }}
            >
                {flavor.name}
            </Typography>
            {/* Dietary Badges */}
            {(flavor.glutenFree || flavor.vegan) && (
                <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                    <DietaryBadges
                        glutenFree={flavor.glutenFree}
                        vegan={flavor.vegan}
                        size="small"
                    />
                </Box>
            )}
        </Box>
    );
};

export const CategoryListView = ({ menu, sendToCatering }) => {
    const categories = Object.entries(menu);
    const [selectedFlavorCategory, setSelectedFlavorCategory] = useState('cake');
    const [placedFlavors, setPlacedFlavors] = useState([]);
    const heroRef = useRef(null);

    const handleFlavorCategoryChange = (event, newCategory) => {
        if (newCategory !== null) {
            setSelectedFlavorCategory(newCategory);
        }
    };

    const handleTearAway = (flavor) => {
        // Add flavor to placed list with a random position on the hero
        const newPlacement = {
            ...flavor,
            id: `${flavor.name}-${Date.now()}`,
            x: Math.random() * 60 + 20, // 20-80% from left
            y: Math.random() * 40 + 30, // 30-70% from top
            rotation: Math.random() * 20 - 10, // -10 to 10 degrees
        };
        setPlacedFlavors(prev => [...prev, newPlacement]);
    };

    const handleRemoveFromHero = (id) => {
        setPlacedFlavors(prev => prev.filter(f => f.id !== id));
    };

    const currentFlavors = FLAVORS[selectedFlavorCategory] || [];

    // Check if a flavor is already placed
    const isFlavorPlaced = (flavorName) => {
        return placedFlavors.some(f => f.name === flavorName);
    };

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

            {/* Category Toggle */}
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2, mb: 3 }}>
                <ToggleButtonGroup
                    value={selectedFlavorCategory}
                    exclusive
                    onChange={handleFlavorCategoryChange}
                    aria-label="flavor category"
                    sx={{
                        '& .MuiToggleButton-root': {
                            px: 3,
                            py: 1,
                            textTransform: 'none',
                            fontSize: '1.4rem',
                            fontWeight: 500,
                            border: '1px solid',
                            borderColor: 'grey.300',
                            '&.Mui-selected': {
                                backgroundColor: 'black',
                                color: 'white',
                                '&:hover': {
                                    backgroundColor: '#333',
                                },
                            },
                        },
                    }}
                >
                    {FLAVOR_CATEGORIES.map((category) => (
                        <ToggleButton key={category.id} value={category.id}>
                            {category.label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>

            {/* Hero Image Placeholder */}
            <Box
                ref={heroRef}
                sx={{
                    width: '100%',
                    height: { xs: 200, sm: 280, md: 350 },
                    backgroundColor: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 2,
                    mb: 4,
                    overflow: 'visible',
                    border: '2px dashed #ccc',
                    position: 'relative',
                }}
            >
                {placedFlavors.length === 0 && (
                    <Typography
                        variant="h5"
                        color="text.secondary"
                        sx={{ fontWeight: 500 }}
                    >
                        Tap a flavor to add it here!
                    </Typography>
                )}

                {/* Placed flavor circles */}
                <AnimatePresence>
                    {placedFlavors.map((flavor) => (
                        <motion.div
                            key={flavor.id}
                            initial={{ scale: 0, opacity: 0, y: 50 }}
                            animate={{
                                scale: 1,
                                opacity: 1,
                                y: 0,
                                rotate: flavor.rotation
                            }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{
                                type: 'spring',
                                stiffness: 400,
                                damping: 25
                            }}
                            whileHover={{ scale: 1.1, zIndex: 10 }}
                            onClick={() => handleRemoveFromHero(flavor.id)}
                            style={{
                                position: 'absolute',
                                left: `${flavor.x}%`,
                                top: `${flavor.y}%`,
                                transform: 'translate(-50%, -50%)',
                                cursor: 'pointer',
                                zIndex: 5,
                            }}
                        >
                            {flavor.image ? (
                                <Box
                                    sx={{
                                        width: 60,
                                        height: 60,
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                                        border: '3px solid white',
                                    }}
                                >
                                    <img
                                        src={flavor.image}
                                        alt={flavor.name}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                </Box>
                            ) : (
                                <Box
                                    sx={{
                                        width: 60,
                                        height: 60,
                                        borderRadius: '50%',
                                        backgroundColor: flavor.color,
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                                        border: '3px solid white',
                                    }}
                                />
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </Box>

            {/* Packaging Section */}
            <Box sx={{ pt: 2, pb: 4 }}>
                <Typography
                    variant="h3"
                    component="h2"
                    sx={{
                        fontWeight: 700,
                        mb: 2,
                        fontSize: { xs: '1.75rem', md: '2.25rem' },
                        textAlign: 'center'
                    }}
                >
                    Packaging
                </Typography>

                {/* Legend */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 3,
                        mb: 3
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SustainableBadge size="small" />
                        <Typography variant="body2" color="text.secondary">
                            Sustainable
                        </Typography>
                    </Box>
                </Box>

                {/* Packaging Grid - 2 columns */}
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 3,
                        maxWidth: '400px',
                        margin: '0 auto'
                    }}
                >
                    {PACKAGING.map((item) => (
                        <Box
                            key={item.name}
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                cursor: 'pointer',
                                '&:hover': { opacity: 0.8 }
                            }}
                        >
                            {/* Image or Color Square */}
                            {item.image ? (
                                <Box
                                    sx={{
                                        width: '100%',
                                        paddingTop: '100%',
                                        position: 'relative',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                    }}
                                >
                                    <img
                                        src={item.image}
                                        alt={item.name}
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
                            ) : (
                                <Box
                                    sx={{
                                        width: '100%',
                                        paddingTop: '100%',
                                        position: 'relative',
                                        borderRadius: 2,
                                        backgroundColor: item.color,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                    }}
                                />
                            )}
                            {/* Packaging Name */}
                            <Typography
                                variant="body2"
                                sx={{
                                    mt: 1,
                                    fontWeight: 500,
                                    textAlign: 'center',
                                    fontSize: '1.4rem'
                                }}
                            >
                                {item.name}
                            </Typography>
                            {/* Sustainable Badge */}
                            {item.sustainable && (
                                <Box sx={{ mt: 0.5 }}>
                                    <SustainableBadge size="small" />
                                </Box>
                            )}
                        </Box>
                    ))}
                </Box>
            </Box>

            {/* Flavors Section */}
            <Box sx={{ pt: 2, pb: 4, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography
                    variant="h3"
                    component="h2"
                    sx={{
                        fontWeight: 700,
                        mb: 2,
                        fontSize: { xs: '1.75rem', md: '2.25rem' },
                        textAlign: 'center'
                    }}
                >
                    Flavors
                </Typography>

                {/* Legend */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 3,
                        mb: 3
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <GlutenFreeBadge size="small" />
                        <Typography variant="body2" color="text.secondary">
                            Gluten-Free
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <VeganBadge size="small" />
                        <Typography variant="body2" color="text.secondary">
                            Vegan
                        </Typography>
                    </Box>
                </Box>

                {/* Flavors Grid - 3 columns */}
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 3,
                        maxWidth: '400px',
                        margin: '0 auto'
                    }}
                >
                    {currentFlavors.map((flavor) => (
                        <AnimatedFlavorCircle
                            key={flavor.name}
                            flavor={flavor}
                            onTearAway={handleTearAway}
                            isPlaced={isFlavorPlaced(flavor.name)}
                        />
                    ))}
                </Box>
            </Box>

            {/* Category Grid */}
            <Box sx={{ pt: 1, pb: 2, borderTop: '1px solid', borderColor: 'divider' }}>
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
