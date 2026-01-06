import React, { useState, useRef, useEffect, useContext } from 'react';
import { Box, Typography, Container, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { GiWheat } from 'react-icons/gi';
import { FaLeaf, FaRecycle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { CateringLayoutContext } from '@/contexts/catering/CateringLayoutContext';

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
                position: 'relative',
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
            {/* Diagonal strikethrough line */}
            <Box
                sx={{
                    position: 'absolute',
                    width: '120%',
                    height: '3px',
                    backgroundColor: '#F9A825',
                    transform: 'rotate(-45deg)',
                    borderRadius: '2px',
                }}
            />
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

// Flavor categories per packaging type
const FLAVOR_CATEGORIES_BY_PACKAGING = {
    'Cake Jar Boxes': [
        { id: 'cake', label: 'Cake' },
        { id: 'cheesecake', label: 'Cheesecake' },
    ],
    'Cupcake Trays': [
        { id: 'cake', label: 'Cake' },
        { id: 'cheesecake', label: 'Cheesecake' },
        { id: 'cookie', label: 'Cookie' },
    ],
    'Cookies': [
        { id: 'cookie', label: 'Cookie' },
    ],
};

// Hardcoded flavors with colors, dietary info, and category
const FLAVORS = {
    cake: [
        { name: 'Make Your Own Cake Jar', image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/make-your-own-mini-cake-jar.png', color: '#FFD700', glutenFree: false, vegan: false },
        { name: "A'mour S'more", image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/amour-smore-mini-cake-jar.png', color: '#8B4513', glutenFree: false, vegan: false },
        { name: 'Chocolate Meltdown Overload', image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/chocolate-meltdown-overload-mini-cake-jar.png', color: '#3D1C02', glutenFree: true, vegan: true },
        { name: 'I Dream of Taro', image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/i-dream-of-taro-mini-cake-jar.png', color: '#9370DB', glutenFree: true, vegan: false },
        { name: 'All Very Strawberry', image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/all-very-strawberry-mini-cake-jar.png', color: '#FF6B81', glutenFree: true, vegan: true },
        { name: 'Nom Nom Cookie', color: '#2C2C2C', glutenFree: false, vegan: false },
        { name: 'La La Red Velvet', image: 'https://images.surrealcreamery.com/catering/mini-cake-jars/la-la-red-velvet-mini-cake-jar.png', color: '#C41E3A', glutenFree: false, vegan: false },
    ],
    cheesecake: [
        { name: 'Strawberry', color: '#FF6B81', glutenFree: true, vegan: false },
        { name: 'Cherry', color: '#C41E3A', glutenFree: true, vegan: false },
        { name: 'Apple', color: '#90EE90', glutenFree: true, vegan: false },
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
    {
        name: 'Cake Jar Boxes',
        heroImage: 'https://images.surrealcreamery.com/catering/packaging/cake-jar-box.png',
        sustainable: true,
        glutenFree: true,
        vegan: true,
    },
    {
        name: 'Cupcake Trays',
        heroImage: 'https://images.surrealcreamery.com/catering/packaging/cake-tray.png',
        sustainable: false,
        glutenFree: true,
        vegan: true,
    },
    {
        name: 'Cookies',
        heroImage: 'https://images.surrealcreamery.com/catering/packaging/cake-tray.png',
        sustainable: false,
        glutenFree: true,
        vegan: true,
    },
];

// Animated flavor circle component - smooth lift and fly
const AnimatedFlavorCircle = ({ flavor, onTearAway, isPlaced }) => {
    const [animationPhase, setAnimationPhase] = useState('idle'); // idle, lifting, flying

    const handleClick = () => {
        if (animationPhase !== 'idle' || isPlaced) return;

        setAnimationPhase('lifting');

        setTimeout(() => {
            setAnimationPhase('flying');
        }, 400);

        setTimeout(() => {
            onTearAway(flavor);
            setAnimationPhase('idle');
        }, 900);
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
            <Box
                onClick={handleClick}
                sx={{
                    position: 'relative',
                    width: 80,
                    height: 80,
                    cursor: isPlaced ? 'default' : 'pointer',
                }}
            >
                {/* Shadow - grows as sticker lifts */}
                <motion.div
                    animate={{
                        opacity: animationPhase === 'lifting' ? 0.4 : 0,
                        scale: animationPhase === 'lifting' ? 1.1 : 0.9,
                    }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.25)',
                        filter: 'blur(8px)',
                        zIndex: 0,
                    }}
                />

                {/* The sticker */}
                <motion.div
                    animate={
                        animationPhase === 'lifting' ? {
                            y: -12,
                            scale: 1.08,
                        } :
                        animationPhase === 'flying' ? {
                            y: 350,
                            scale: 0.5,
                            opacity: 0,
                        } :
                        { y: 0, scale: 1, opacity: 1 }
                    }
                    whileHover={!isPlaced && animationPhase === 'idle' ? {
                        y: -4,
                        scale: 1.03,
                    } : {}}
                    transition={{
                        duration: animationPhase === 'flying' ? 0.5 : 0.3,
                        ease: [0.34, 1.2, 0.64, 1],
                    }}
                    style={{
                        position: 'relative',
                        zIndex: animationPhase !== 'idle' ? 1000 : 1,
                    }}
                >
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            boxShadow: animationPhase === 'lifting'
                                ? '0 12px 24px rgba(0,0,0,0.25)'
                                : '0 2px 8px rgba(0,0,0,0.15)',
                            border: '3px solid white',
                            outline: '1px solid #e0e0e0',
                            backgroundColor: flavor.color,
                            transition: 'box-shadow 0.3s',
                        }}
                    >
                        {flavor.image && (
                            <img
                                src={flavor.image}
                                alt={flavor.name}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                        )}
                    </Box>
                </motion.div>

                {/* Gluten-free badge - top right (1 o'clock) */}
                {flavor.glutenFree && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: -2,
                            right: 2,
                            zIndex: 10,
                        }}
                    >
                        <GlutenFreeBadge size="small" />
                    </Box>
                )}
                {/* Vegan badge - top left (11 o'clock) */}
                {flavor.vegan && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: -2,
                            left: 2,
                            zIndex: 10,
                        }}
                    >
                        <VeganBadge size="small" />
                    </Box>
                )}
            </Box>

            <Typography
                variant="body2"
                sx={{ mt: 1, fontWeight: 500, textAlign: 'center', fontSize: '1.4rem' }}
            >
                {flavor.name}
            </Typography>
        </Box>
    );
};

// Animated packaging component - smooth lift and fly
const AnimatedPackaging = ({ item, onSelect, isSelected, isHighlighted }) => {
    const [animationPhase, setAnimationPhase] = useState('idle'); // idle, lifting, flying

    const handleClick = () => {
        if (animationPhase !== 'idle' || isSelected) return;

        setAnimationPhase('lifting');

        setTimeout(() => {
            setAnimationPhase('flying');
        }, 400);

        setTimeout(() => {
            onSelect(item);
            setAnimationPhase('idle');
        }, 900);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: isSelected ? 'default' : 'pointer',
                opacity: isSelected ? 0.4 : 1,
                transition: 'all 0.3s',
                transform: isHighlighted ? 'scale(1.05)' : 'scale(1)',
            }}
        >
            <Box
                onClick={handleClick}
                sx={{
                    position: 'relative',
                    width: '100%',
                    paddingTop: '100%',
                    cursor: isSelected ? 'default' : 'pointer',
                }}
            >
                {/* Shadow - grows as card lifts */}
                <motion.div
                    animate={{
                        opacity: animationPhase === 'lifting' ? 0.4 : 0,
                        scale: animationPhase === 'lifting' ? 1.05 : 0.95,
                    }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        width: '100%',
                        height: '100%',
                        borderRadius: 8,
                        background: 'rgba(0,0,0,0.25)',
                        filter: 'blur(12px)',
                        zIndex: 0,
                    }}
                />

                {/* The card */}
                <motion.div
                    animate={
                        animationPhase === 'lifting' ? {
                            y: -15,
                            scale: 1.05,
                        } :
                        animationPhase === 'flying' ? {
                            y: -350,
                            scale: 0.4,
                            opacity: 0,
                        } :
                        { y: 0, scale: 1, opacity: 1 }
                    }
                    whileHover={!isSelected && animationPhase === 'idle' ? {
                        y: -6,
                        scale: 1.02,
                    } : {}}
                    transition={{
                        duration: animationPhase === 'flying' ? 0.5 : 0.3,
                        ease: [0.34, 1.2, 0.64, 1],
                    }}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: animationPhase !== 'idle' ? 1000 : 1,
                    }}
                >
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            borderRadius: 2,
                            overflow: 'hidden',
                            boxShadow: animationPhase === 'lifting'
                                ? '0 15px 30px rgba(0,0,0,0.25)'
                                : isHighlighted
                                ? '0 0 0 3px #000, 0 4px 20px rgba(0,0,0,0.25)'
                                : '0 2px 8px rgba(0,0,0,0.15)',
                            transition: 'box-shadow 0.3s',
                        }}
                    >
                        {item.image ? (
                            <img
                                src={item.image}
                                alt={item.name}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                        ) : (
                            <Box sx={{ width: '100%', height: '100%', backgroundColor: item.color }} />
                        )}
                    </Box>
                </motion.div>
            </Box>

            <Typography
                variant="body2"
                sx={{
                    mt: 1,
                    fontWeight: isHighlighted ? 700 : 500,
                    textAlign: 'center',
                    fontSize: '1.4rem',
                    transition: 'font-weight 0.3s',
                }}
            >
                {item.name}
            </Typography>
            {item.sustainable && (
                <Box sx={{ mt: 0.5 }}>
                    <SustainableBadge size="small" />
                </Box>
            )}
        </Box>
    );
};

export const CategoryListView = ({ menu, sendToCatering }) => {
    const { cateringState } = useContext(CateringLayoutContext);
    const { packagingResetCounter } = cateringState.context;

    const categories = Object.entries(menu);
    const [selectedFlavorCategory, setSelectedFlavorCategory] = useState('cake');
    const [selectedPackaging, setSelectedPackaging] = useState(null);
    const [placedFlavors, setPlacedFlavors] = useState([]);
    const heroRef = useRef(null);

    // Reset packaging selection when logo is clicked (counter increments)
    useEffect(() => {
        setSelectedPackaging(null);
        setPlacedFlavors([]);
        setSelectedFlavorCategory('cake');
    }, [packagingResetCounter]);

    const handleFlavorCategoryChange = (event, newCategory) => {
        if (newCategory !== null) {
            setSelectedFlavorCategory(newCategory);
        }
    };

    const handlePackagingSelect = (packaging) => {
        setSelectedPackaging(packaging);
        // Clear placed flavors when changing packaging
        setPlacedFlavors([]);
        // Set default flavor category to first available for this packaging
        const categories = FLAVOR_CATEGORIES_BY_PACKAGING[packaging.name] || [];
        if (categories.length > 0) {
            setSelectedFlavorCategory(categories[0].id);
        }
    };

    const handleTearAway = (flavor) => {
        // For Cake Jar Boxes, find the next empty slot
        if (selectedPackaging?.name === 'Cake Jar Boxes') {
            // Max 6 slots
            if (placedFlavors.length >= 6) return;

            // Find first empty slot index
            const usedSlots = placedFlavors.map(f => f.slotIndex);
            let nextSlot = 0;
            for (let i = 0; i < 6; i++) {
                if (!usedSlots.includes(i)) {
                    nextSlot = i;
                    break;
                }
            }

            const newPlacement = {
                ...flavor,
                id: `${flavor.name}-${Date.now()}`,
                slotIndex: nextSlot,
            };
            setPlacedFlavors(prev => [...prev, newPlacement]);
        } else {
            // For other packaging types, use random positioning
            const newPlacement = {
                ...flavor,
                id: `${flavor.name}-${Date.now()}`,
                x: Math.random() * 60 + 20,
                y: Math.random() * 40 + 30,
                rotation: Math.random() * 20 - 10,
            };
            setPlacedFlavors(prev => [...prev, newPlacement]);
        }
    };

    const handleRemoveFromSlot = (id) => {
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

            {/* Packaging Selection - Vertical Cards */}
            {!selectedPackaging && (
                <Box sx={{ pt: 2, pb: 4 }}>
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            color: 'black',
                            fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
                            textAlign: 'center',
                            mb: 1,
                        }}
                    >
                        Looking to make your next event So Surreal?
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            color: 'text.secondary',
                            textAlign: 'center',
                            mb: 3,
                            fontSize: '1.4rem',
                        }}
                    >
                        Proudly diverse, minority, and women-owned. Let us bring your unique style to life.
                    </Typography>

                    {/* Vertical stack of packaging cards */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {PACKAGING.map((item) => (
                            <motion.div
                                key={item.name}
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handlePackagingSelect(item)}
                                style={{ cursor: 'pointer' }}
                            >
                                <Box
                                    sx={{
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                                        backgroundColor: '#f8f8f8',
                                        transition: 'box-shadow 0.3s',
                                        '&:hover': {
                                            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                                        },
                                    }}
                                >
                                    {/* Hero Image */}
                                    <Box
                                        sx={{
                                            width: '100%',
                                            height: { xs: 200, sm: 250, md: 300 },
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: 'white',
                                            p: 2,
                                        }}
                                    >
                                        {item.heroImage && (
                                            <img
                                                src={item.heroImage}
                                                alt={item.name}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '100%',
                                                    objectFit: 'contain',
                                                }}
                                            />
                                        )}
                                    </Box>

                                    {/* Card Footer */}
                                    <Box
                                        sx={{
                                            p: 2,
                                            backgroundColor: 'white',
                                            borderTop: '1px solid',
                                            borderColor: 'grey.100',
                                        }}
                                    >
                                        {/* Title and Modify row */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Typography
                                                variant="h6"
                                                sx={{
                                                    fontWeight: 700,
                                                    fontSize: '1.6rem',
                                                }}
                                            >
                                                {item.name}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    fontWeight: 600,
                                                    color: 'primary.main',
                                                    fontSize: '1.6rem',
                                                }}
                                            >
                                                Modify →
                                            </Typography>
                                        </Box>

                                        {/* Dietary badges with labels */}
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                            {item.sustainable && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <SustainableBadge size="small" />
                                                    <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                                                        Sustainable
                                                    </Typography>
                                                </Box>
                                            )}
                                            {item.glutenFree && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <GlutenFreeBadge size="small" />
                                                    <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                                                        Gluten Free
                                                    </Typography>
                                                </Box>
                                            )}
                                            {item.vegan && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <VeganBadge size="small" />
                                                    <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                                                        Vegan
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                </Box>
                            </motion.div>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Sticky Bottom Box - Fixed at bottom for Cake Jar Boxes */}
            {selectedPackaging && selectedPackaging.name === 'Cake Jar Boxes' && (
                <Box
                    sx={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        borderTop: '1px solid',
                        borderColor: 'grey.300',
                        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                        zIndex: 1000,
                        p: 2,
                    }}
                >
                    <Box sx={{ maxWidth: 600, margin: '0 auto' }}>
                        {/* Title and count row */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography
                                variant="h6"
                                sx={{ fontWeight: 700, fontSize: '1.4rem' }}
                            >
                                {selectedPackaging.name}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontSize: '1.4rem' }}
                            >
                                {placedFlavors.length}/6 filled
                            </Typography>
                        </Box>

                        {/* 6-Slot Box - Compact horizontal layout */}
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(6, 1fr)',
                                gap: 1,
                                p: 1.5,
                                backgroundColor: '#f5f0e6',
                                borderRadius: 2,
                                border: '2px solid #d4c4a8',
                            }}
                        >
                            {[0, 1, 2, 3, 4, 5].map((slotIndex) => {
                                const flavorInSlot = placedFlavors.find(f => f.slotIndex === slotIndex);
                                return (
                                    <Box
                                        key={slotIndex}
                                        sx={{
                                            aspectRatio: '1',
                                            borderRadius: '50%',
                                            backgroundColor: flavorInSlot ? 'transparent' : '#e8e0d0',
                                            border: flavorInSlot ? 'none' : '2px dashed #c4b89c',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                            cursor: flavorInSlot ? 'pointer' : 'default',
                                        }}
                                        onClick={() => flavorInSlot && handleRemoveFromSlot(flavorInSlot.id)}
                                    >
                                        {/* Slot number when empty */}
                                        {!flavorInSlot && (
                                            <Typography
                                                sx={{
                                                    fontSize: '1.2rem',
                                                    fontWeight: 600,
                                                    color: '#b8a88c',
                                                }}
                                            >
                                                {slotIndex + 1}
                                            </Typography>
                                        )}
                                        <AnimatePresence>
                                            {flavorInSlot && (
                                                <motion.div
                                                    key={flavorInSlot.id}
                                                    initial={{ scale: 0, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0, opacity: 0 }}
                                                    transition={{
                                                        type: 'spring',
                                                        stiffness: 400,
                                                        damping: 25
                                                    }}
                                                    style={{ width: '100%', height: '100%' }}
                                                >
                                                    <Box
                                                        sx={{
                                                            width: '100%',
                                                            height: '100%',
                                                            borderRadius: '50%',
                                                            backgroundColor: flavorInSlot.color,
                                                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            overflow: 'hidden',
                                                        }}
                                                    >
                                                        {flavorInSlot.image && (
                                                            <img
                                                                src={flavorInSlot.image}
                                                                alt={flavorInSlot.name}
                                                                style={{
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    objectFit: 'cover',
                                                                }}
                                                            />
                                                        )}
                                                    </Box>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                </Box>
            )}

            {/* Selected Packaging Header - for non-box packaging */}
            {selectedPackaging && selectedPackaging.name !== 'Cake Jar Boxes' && (
                <Box sx={{ py: 2, mb: 2 }}>
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 700,
                            textAlign: 'center',
                            fontSize: '1.6rem',
                        }}
                    >
                        {selectedPackaging.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 0.5 }}>
                        Choose your flavors
                    </Typography>
                </Box>
            )}

            {/* Show Toggle and Flavors only after packaging is selected */}
            {selectedPackaging && (
                <>
                    {/* Flavors Section */}
                    <Box sx={{
                        pt: 2,
                        pb: selectedPackaging?.name === 'Cake Jar Boxes' ? 20 : 4,
                        borderTop: '1px solid',
                        borderColor: 'divider'
                    }}>
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
                        mb: 2
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <GlutenFreeBadge size="small" />
                        <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                            Gluten Free
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <VeganBadge size="small" />
                        <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                            Vegan
                        </Typography>
                    </Box>
                </Box>

                {/* Category Toggle */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
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
                        {(FLAVOR_CATEGORIES_BY_PACKAGING[selectedPackaging?.name] || []).map((category) => (
                            <ToggleButton key={category.id} value={category.id}>
                                {category.label}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
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
                            isPlaced={false}
                        />
                        ))}
                    </Box>
                </Box>
            </>
            )}

            {/*
            ===========================================
            CATEGORY GRID - Currently disabled
            ===========================================
            This section displays categories from the JSON menu data.
            Each category shows an image and name, clicking navigates to that category.

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
            */}

            {/*
            ===========================================
            FEATURED PRODUCTS SECTION - Currently disabled
            ===========================================
            This section displays featured products from the menu.
            Uses the ProductCard component defined below.

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
            */}
        </Box>
    );
};

/*
===========================================
PRODUCT CARD COMPONENT - Currently disabled
===========================================
Used by the Featured Products section to display individual product cards.

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
*/

export default CategoryListView;
