import React, { useState } from 'react';
import { Box, Typography, Stack, Button, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

const CartQuantitySelector = ({ value, onIncrement, onDecrement }) => (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', border: '1px solid', borderColor: 'grey.300', borderRadius: 1 }}>
        <Button sx={{ minWidth: '40px' }} onClick={onDecrement} disabled={value <= 1}>-</Button>
        <Typography sx={{ px: 2, fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{value}</Typography>
        <Button sx={{ minWidth: '40px' }} onClick={onIncrement}>+</Button>
    </Box>
);

export const ItemDetailView = ({ item, sendToCatering, isAuthenticated }) => {
    const [quantity, setQuantity] = useState(1);

    const inclusiveModifiers = item.ModifierCategories.flatMap(category => 
        category.Modifiers.filter(modifier => modifier['Modifier Type'] === 'Inclusive')
    );

    // Helper to find the best applicable discount
    const getApplicableDiscount = (qty) => {
        if (!item.discounts || item.discounts.length === 0 || !isAuthenticated) {
            return null;
        }
        // Sort discounts by quantity descending to find the highest applicable tier
        const sortedDiscounts = [...item.discounts].sort((a, b) => b.minimumQuantity - a.minimumQuantity);
        return sortedDiscounts.find(d => qty >= d.minimumQuantity) || null;
    };

    const applicableDiscount = getApplicableDiscount(quantity);
    let displayPrice = item['Item Price'];
    if (applicableDiscount) {
        if (applicableDiscount.fixedAmount) {
            displayPrice -= applicableDiscount.fixedAmount;
        } else if (applicableDiscount.percentage) {
            displayPrice *= (1 - applicableDiscount.percentage);
        }
    }

    const handleAddToCart = () => {
        sendToCatering({ type: 'ADD_TO_CART', item, selectedModifiers: {}, quantity });
        // ✅ Also send an event to navigate to the cart
        sendToCatering({ type: 'VIEW_CART' });
    };

    return (
        <Box>
            <Box sx={{ height: 300, backgroundColor: 'grey.200', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                <img 
                    src={item['Item Category Image']?.[0] || `https://placehold.co/600x400/EEE/31343C?text=${encodeURIComponent(item['Item Name'])}`} 
                    alt={item['Item Name']} 
                    style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        imageRendering: 'high-quality'
                    }} 
                />
            </Box>
            <Typography variant="h2" component="h1" gutterBottom>{item['Item Name']}</Typography>
            <Divider sx={{ my: 2 }} />
            
            {/* ✅ FIX: Logic to display strikethrough price */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 2 }}>
                {applicableDiscount ? (
                    <>
                        <Typography variant="h5" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                            ${item['Item Price'].toFixed(2)}
                        </Typography>
                        <Typography variant="h5" color="text.primary" sx={{ fontWeight: 'bold' }}>
                            ${displayPrice.toFixed(2)}
                        </Typography>
                    </>
                ) : (
                    <Typography variant="h5" color="text.secondary">
                        ${item['Item Price'].toFixed(2)}
                    </Typography>
                )}
            </Box>

            {inclusiveModifiers.length > 0 && (
                <>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ my: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Includes:</Typography>
                        <Stack component="ul" sx={{ pl: 2.5, my: 1, color: 'text.secondary' }}>
                            {inclusiveModifiers.map(modifier => (
                                <Typography component="li" variant="body1" key={modifier['Modifier ID']} sx={{ display: 'list-item' }}>
                                    {modifier['Modifier Name']}
                                </Typography>
                            ))}
                        </Stack>
                    </Box>
                </>
            )}

            {item.discounts && item.discounts.length > 0 && (
                isAuthenticated ? (
                    <Box sx={{ my: 2, p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Bulk Discounts Available:</Typography>
                        <Stack>
                            {item.discounts.map(d => {
                                const discountText = d.fixedAmount
                                    ? `get $${d.fixedAmount} off each`
                                    : d.percentage
                                    ? `get ${d.percentage * 100}% off each`
                                    : '';
                                return (
                                    <Typography key={d.minimumQuantity} variant="body2" color="text.secondary">
                                        - Buy {d.minimumQuantity} or more, {discountText}.
                                    </Typography>
                                );
                            })}
                        </Stack>
                    </Box>
                ) : (
                    <Button variant="outlined" fullWidth sx={{ my: 2 }} onClick={() => sendToCatering({ type: 'TRIGGER_AUTH' })}>
                        Login to View Discounts
                    </Button>
                )
            )}
            
            <Box sx={{ mt: 3 }}>
                <CartQuantitySelector
                    value={quantity}
                    onIncrement={() => setQuantity(q => q + 1)}
                    onDecrement={() => setQuantity(q => Math.max(1, q - 1))}
                />
            </Box>

            <Button
                variant="contained"
                fullWidth
                startIcon={<AddIcon />}
                onClick={handleAddToCart}
                sx={{
                    backgroundColor: 'black', color: 'white', borderRadius: '50px',
                    textTransform: 'none', py: 1.5, px: 2, mt: 2,
                    '&:hover': { backgroundColor: '#333' }
                }}
            >
                Add {quantity} to Cart
            </Button>
        </Box>
    );
};

