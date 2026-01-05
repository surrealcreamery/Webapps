import React from 'react';
import { Box, Typography } from '@mui/material';
import { CateringBreadcrumbs } from './CateringBreadcrumbs';

const PLACEHOLDER_IMAGE = 'https://placehold.co/300x300/e0e0e0/666666?text=Product';

export const ItemListView = ({ items, categoryName, sendToCatering }) => {

    const handleItemClick = (item) => {
        const hasConfigurableAddons = item.ModifierCategories?.some(cat =>
            cat.ModifierCategoryMinimum !== null &&
            cat.ModifierCategoryMaximum !== null &&
            cat.Modifiers?.some(mod => mod['Modifier Type'] === 'Add On')
        );

        if (hasConfigurableAddons) {
            sendToCatering({ type: 'EDIT_ITEM', item });
        } else {
            sendToCatering({ type: 'VIEW_ITEM', item });
        }
    };

    const breadcrumbItems = [
        { label: 'Catering', action: { type: 'GO_TO_BROWSING' } },
        { label: categoryName }
    ];

    return (
        <Box sx={{ backgroundColor: 'white' }}>
            {/* Breadcrumbs */}
            <CateringBreadcrumbs items={breadcrumbItems} sendToCatering={sendToCatering} />

            {/* Category Header */}
            <Typography
                variant="h2"
                component="h1"
                sx={{
                    fontWeight: 700,
                    mb: 1,
                    fontSize: { xs: '2rem', md: '2.5rem' }
                }}
            >
                {categoryName}
            </Typography>

            <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 3 }}
            >
                {items.length} item{items.length !== 1 ? 's' : ''} available
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
                {items.map(item => (
                    <ProductCard
                        key={item['Item ID']}
                        item={item}
                        onClick={() => handleItemClick(item)}
                    />
                ))}
            </Box>
        </Box>
    );
};

const ProductCard = ({ item, onClick }) => {
    const imageUrl = item['Item Image'] || PLACEHOLDER_IMAGE;
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

export default ItemListView;
