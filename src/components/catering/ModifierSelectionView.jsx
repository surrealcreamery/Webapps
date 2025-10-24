import React, { useState } from 'react';
import { Box, Typography, Stack, Button, Paper, Divider } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const QuantitySelector = ({ name, value, onIncrement, onDecrement, incrementDisabled }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', py: 1.5 }}>
        <Typography variant="body1">{name}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid', borderColor: 'grey.300', borderRadius: 1 }}>
            <Button sx={{ minWidth: '40px' }} onClick={onDecrement}>-</Button>
            <Typography sx={{ px: 2, fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{value}</Typography>
            <Button sx={{ minWidth: '40px' }} onClick={onIncrement} disabled={incrementDisabled}>+</Button>
        </Box>
    </Box>
);

export const ModifierSelectionView = ({ item, sendToCatering }) => {
    const modCategory = item.ModifierCategories.find(cat => cat.ModifierCategoryMinimum !== null && cat.ModifierCategoryMaximum !== null);
    
    const [quantities, setQuantities] = useState(() => 
        modCategory.Modifiers.reduce((acc, mod) => ({ ...acc, [mod['Modifier ID']]: 0 }), {})
    );

    const totalQuantity = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
    const { ModifierCategoryMinimum, ModifierCategoryMaximum } = modCategory;

    const handleQuantityChange = (modifierId, change) => {
        if (change > 0 && totalQuantity >= ModifierCategoryMaximum) return;
        setQuantities(prev => ({ ...prev, [modifierId]: Math.max(0, prev[modifierId] + change) }));
    };
    
    const isSelectionValid = totalQuantity >= ModifierCategoryMinimum && totalQuantity <= ModifierCategoryMaximum;
    const countColor = totalQuantity > ModifierCategoryMaximum ? 'error.main' : 'text.secondary';

    const handleContinue = () => {
        sendToCatering({ type: 'CONFIRM_MODIFIERS', selectedModifiers: quantities });
    };

    return (
        <Box>
            <Box sx={{ height: 300, backgroundColor: 'grey.200', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                <img 
                    src={item['Item Category Image']?.[0] || `https://placehold.co/600x400/EEE/31343C?text=${encodeURIComponent(item['Item Name'])}`} 
                    alt={item['Item Name']} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
            </Box>
            <Typography variant="h2" component="h1" gutterBottom>{item['Item Name']}</Typography>
            <Typography variant="h6">{modCategory.ModifierCategoryName}</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {isSelectionValid && <CheckCircleIcon color="success" sx={{ mr: 1 }} />}
                    <Typography color={countColor} sx={{ fontWeight: 'bold' }}>
                        {totalQuantity} of {ModifierCategoryMaximum} Selected
                    </Typography>
                </Box>
                <Typography color="text.secondary" variant="body2">
                    Required
                </Typography>
            </Box>
            <Stack spacing={0} divider={<Divider />}>
                {modCategory.Modifiers.map(modifier => (
                    <QuantitySelector
                        key={modifier['Modifier ID']}
                        name={modifier['Modifier Name']}
                        value={quantities[modifier['Modifier ID']]}
                        onIncrement={() => handleQuantityChange(modifier['Modifier ID'], 1)}
                        onDecrement={() => handleQuantityChange(modifier['Modifier ID'], -1)}
                        incrementDisabled={totalQuantity >= ModifierCategoryMaximum}
                    />
                ))}
            </Stack>
            <Button variant="contained" fullWidth sx={{ mt: 3 }} disabled={!isSelectionValid} onClick={handleContinue}>
                Continue
            </Button>
        </Box>
    );
};

