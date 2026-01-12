import React, { useState, useEffect } from 'react';
import { Box, Typography, Stack, Button, Divider, CircularProgress, ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, MenuItem, TextField, Modal, Paper, List, ListItemButton, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { GoogleAddressAutocomplete } from './GoogleAddressAutocomplete';

// Placeholder image
const PLACEHOLDER_IMAGE = 'https://placehold.co/80x80/e0e0e0/666666?text=No+Image';

const CartQuantitySelector = ({ value, onIncrement, onDecrement }) => (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', border: '1px solid', borderColor: 'grey.300', borderRadius: 1 }}>
        <Button sx={{ minWidth: '40px' }} onClick={onDecrement} disabled={value <= 1}>-</Button>
        <Typography sx={{ px: 2, fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{value}</Typography>
        <Button sx={{ minWidth: '40px' }} onClick={onIncrement}>+</Button>
    </Box>
);

const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: 500,
    bgcolor: 'background.paper',
    borderRadius: 2,
    boxShadow: 24,
    p: 4,
};

const states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export const CartView = ({ cart, sendToCatering, cateringState }) => {
    const { locations, fulfillmentDetails, isAuthenticated, contactInfo } = cateringState.context;
    const { type, locationId, address } = fulfillmentDetails;

    const [modalOpen, setModalOpen] = useState(false);
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [localFulfillmentType, setLocalFulfillmentType] = useState(type);
    const [localLocationId, setLocalLocationId] = useState(locationId || '');

    // Calculate total items in cart
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    useEffect(() => {
        setLocalFulfillmentType(type);
        setLocalLocationId(locationId || '');
    }, [type, locationId]);

    const handleQuantityChange = (cartItemId, change) => sendToCatering({ type: 'UPDATE_QUANTITY', cartItemId, change });
    const handleRemoveItem = (cartItemId) => sendToCatering({ type: 'REMOVE_ITEM', cartItemId });
    const handleAddMoreItems = () => sendToCatering({ type: 'GO_BACK' });

    const handleFulfillmentTypeChange = (event, newType) => {
        if (newType !== null) {
            setLocalFulfillmentType(newType);
            sendToCatering({ type: 'SET_FULFILLMENT_TYPE', fulfillmentType: newType });
            setIsManualEntry(false);
        }
    };

    const handleLocationChange = (locationId) => {
        setLocalLocationId(locationId);
        sendToCatering({ type: 'SELECT_PICKUP_LOCATION', locationId: locationId });
        setModalOpen(false);
    };

    const handleAddressChange = (event) => {
        const { name, value } = event.target;
        if (name === 'zip' && !/^\d*$/.test(value)) {
            return;
        }
        sendToCatering({ type: 'UPDATE_DELIVERY_ADDRESS', field: name, value: value });
    };

    const getApplicableDiscount = (cartItem) => {
        if (!cartItem?.item) return null;
        const { item, quantity } = cartItem;
        if (!item?.discounts || item.discounts.length === 0 || !isAuthenticated) {
            return null;
        }
        const sortedDiscounts = item.discounts ? [...item.discounts].sort((a, b) => b.minimumQuantity - a.minimumQuantity) : [];
        return sortedDiscounts.find(d => quantity >= d.minimumQuantity) || null;
    };

    // Calculate customization charges for a cart item
    const calculateCustomizationCharges = (cartItem) => {
        if (!cartItem?.item?.customizations || cartItem.item.customizations.length === 0) {
            return { total: 0, details: [] };
        }

        const customizations = cartItem.item.customizations;
        const jarCount = cartItem.item.jars?.length || 6;
        const details = [];
        let total = 0;

        customizations.forEach(customizationId => {
            if (customizationId === 'custom-logo-jars') {
                const charge = 1.25 * jarCount;
                total += charge;
                details.push({ label: 'Custom Logos on Jars', charge, perUnit: '$1.25/jar', count: jarCount });
            } else if (customizationId === 'custom-logo-boxes') {
                const charge = 3.00;
                total += charge;
                details.push({ label: 'Custom Logo on Box', charge });
            } else if (customizationId === 'custom-logo-trays') {
                const charge = 3.00;
                total += charge;
                details.push({ label: 'Custom Logo on Tray', charge });
            }
        });

        return { total, details };
    };

    const calculateLineItemTotal = (cartItem) => {
        if (!cartItem?.item) {
            console.error("Attempting to calculate total for cart item with missing item data:", cartItem);
            return 0;
        }
        let itemPrice = cartItem.item['Item Price'] || 0;
        const applicableDiscount = getApplicableDiscount(cartItem);
        if (applicableDiscount) {
            if (applicableDiscount.fixedAmount) itemPrice -= applicableDiscount.fixedAmount;
            else if (applicableDiscount.percentage) itemPrice *= (1 - applicableDiscount.percentage);
        }
        const modifiersPrice = Object.entries(cartItem.selectedModifiers || {}).reduce((modTotal, [modId, quantity]) => {
            let modifierPrice = 0;
            const fullItemData = cartItem.item;
            if (fullItemData?.ModifierCategories) {
                for (const cat of fullItemData.ModifierCategories) {
                    if (cat?.Modifiers) {
                        const foundMod = cat.Modifiers.find(mod => mod?.['Modifier ID'] === modId);
                        if (foundMod) { modifierPrice = foundMod['Modifier Price'] || 0; break; }
                    }
                }
            }
            return modTotal + (modifierPrice * (quantity || 0));
        }, 0);

        // Add customization charges
        const customizationCharges = calculateCustomizationCharges(cartItem);

        return ((itemPrice + modifiersPrice + customizationCharges.total) * (cartItem.quantity || 0));
    };

    const total = cart.reduce((acc, cartItem) => acc + calculateLineItemTotal(cartItem), 0).toFixed(2);

    const selectedLocation = locations.find(loc => loc?.['Location ID'] === localLocationId);

    const isPickupValid = type === 'pickup' && !!locationId;
    const isDeliveryValid = type === "delivery" &&
        !!address?.street &&
        !!address?.city &&
        !!address?.state &&
        !!address?.zip &&
        address.zip.length === 5;
    const isContinueDisabled = !(isPickupValid || isDeliveryValid);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            {/* Header - Matching Commerce Style */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pb: 2,
                borderBottom: 1,
                borderColor: 'divider'
            }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    Your Bag ({totalItems})
                </Typography>
            </Box>

            {cart.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', py: 6 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        Your bag is empty
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={handleAddMoreItems}
                        sx={{ mt: 2, color: 'black', borderColor: 'black' }}
                    >
                        Browse Menu
                    </Button>
                </Box>
            ) : (
                <Box sx={{ flex: 1 }}>
                    {/* Cart Items */}
                    <Stack spacing={2} divider={<Divider />} sx={{ py: 2 }}>
                        {cart.map((cartItem) => {
                            if (!cartItem?.item) {
                                return <Typography key={cartItem.id || Math.random()} color="error">Invalid item in cart.</Typography>;
                            }
                            const { item, quantity } = cartItem;
                            const lineItemTotal = calculateLineItemTotal(cartItem);
                            const applicableDiscount = getApplicableDiscount(cartItem);
                            let perItemPrice = item['Item Price'] || 0;
                            const originalPrice = item['Item Price'] || 0;
                            if (applicableDiscount) {
                                if (applicableDiscount.fixedAmount) perItemPrice -= applicableDiscount.fixedAmount;
                                else if (applicableDiscount.percentage) perItemPrice *= (1 - applicableDiscount.percentage);
                            }
                            const hasDiscount = applicableDiscount !== null;
                            const imageUrl = item['Item Image'] || PLACEHOLDER_IMAGE;

                            return (
                                <Box key={cartItem.id}>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        {/* Product Image */}
                                        <Box
                                            sx={{
                                                width: 80,
                                                height: 80,
                                                flexShrink: 0,
                                                borderRadius: 2,
                                                overflow: 'hidden',
                                                bgcolor: 'grey.100'
                                            }}
                                        >
                                            <img
                                                src={imageUrl}
                                                alt={item['Item Name'] || 'Product'}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover'
                                                }}
                                                onError={(e) => {
                                                    e.target.src = PLACEHOLDER_IMAGE;
                                                }}
                                            />
                                        </Box>

                                        {/* Product Details */}
                                        <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '1.6rem' }}>
                                                    {item['Item Name'] || 'Unknown Item'}
                                                </Typography>
                                                <Button
                                                    color="primary"
                                                    onClick={() => handleRemoveItem(cartItem.id)}
                                                    sx={{ padding: 0, minWidth: 'auto', ml: 1, fontSize: '1.6rem' }}
                                                >
                                                    Remove
                                                </Button>
                                            </Box>

                                            {/* Price */}
                                            <Typography variant="body1" sx={{ mt: 0.5, fontSize: '1.6rem' }}>
                                                ${perItemPrice.toFixed(2)}
                                                {hasDiscount && (
                                                    <Typography
                                                        component="span"
                                                        sx={{
                                                            ml: 1,
                                                            textDecoration: 'line-through',
                                                            color: 'text.disabled',
                                                            fontSize: '1.6rem'
                                                        }}
                                                    >
                                                        ${originalPrice.toFixed(2)}
                                                    </Typography>
                                                )}
                                            </Typography>

                                            {/* Discount Badge */}
                                            {hasDiscount && (
                                                <Typography
                                                    variant="body2"
                                                    sx={{ color: 'success.main', fontWeight: 600, display: 'block', mt: 0.5, fontSize: '1.6rem' }}
                                                >
                                                    Volume Discount (Min {applicableDiscount.minimumQuantity})
                                                </Typography>
                                            )}

                                            {/* Modifiers */}
                                            {Object.entries(cartItem.selectedModifiers || {})
                                                .filter(([modId, qty]) => qty > 0)
                                                .length > 0 && (
                                                    <Box sx={{ mt: 0.5 }}>
                                                        {Object.entries(cartItem.selectedModifiers || {})
                                                            .filter(([modId, qty]) => qty > 0)
                                                            .map(([modifierId, qty]) => {
                                                                let modifierName = `Modifier ID: ${modifierId}`;
                                                                if (item && item.ModifierCategories) {
                                                                    for (const cat of item.ModifierCategories) {
                                                                        if (cat?.Modifiers) {
                                                                            const foundMod = cat.Modifiers.find(mod => mod?.['Modifier ID'] === modifierId);
                                                                            if (foundMod) {
                                                                                modifierName = foundMod['Modifier Name'];
                                                                                break;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                return (
                                                                    <Typography
                                                                        key={modifierId}
                                                                        variant="body2"
                                                                        sx={{ color: 'text.secondary', fontSize: '1.6rem' }}
                                                                    >
                                                                        + {modifierName} {qty > 1 ? `(x${qty})` : ''}
                                                                    </Typography>
                                                                );
                                                            })}
                                                    </Box>
                                                )}

                                            {/* Customization Charges */}
                                            {(() => {
                                                const customizationInfo = calculateCustomizationCharges(cartItem);
                                                if (customizationInfo.details.length === 0) return null;
                                                return (
                                                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'grey.300' }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '1.4rem', mb: 0.5 }}>
                                                            Customizations:
                                                        </Typography>
                                                        {customizationInfo.details.map((detail, idx) => (
                                                            <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '1.4rem' }}>
                                                                    + {detail.label}
                                                                    {detail.perUnit && ` (${detail.count} × ${detail.perUnit})`}
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '1.4rem' }}>
                                                                    +${detail.charge.toFixed(2)}
                                                                </Typography>
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                );
                                            })()}

                                            {/* Quantity and Total */}
                                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <CartQuantitySelector
                                                    value={quantity}
                                                    onIncrement={() => handleQuantityChange(cartItem.id, 1)}
                                                    onDecrement={() => handleQuantityChange(cartItem.id, -1)}
                                                />
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: hasDiscount ? 'success.main' : 'inherit' }}>
                                                        ${lineItemTotal.toFixed(2)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Stack>

                    {/* Continue Shopping Button */}
                    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                        <Button
                            variant="outlined"
                            fullWidth
                            onClick={handleAddMoreItems}
                            sx={{ color: 'black', borderColor: 'black' }}
                        >
                            Continue Shopping
                        </Button>
                    </Box>

                    {/* Summary */}
                    <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                        <Stack spacing={1.5}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body1" color="text.secondary">Subtotal</Typography>
                                <Typography variant="body1" color="text.secondary">${total}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>${total}</Typography>
                            </Box>
                        </Stack>
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* Fulfillment Section */}
                    <Box sx={{ my: 3 }}>
                        <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Fulfillment
                        </Typography>
                        <ToggleButtonGroup
                            value={localFulfillmentType}
                            exclusive
                            onChange={handleFulfillmentTypeChange}
                            fullWidth
                            sx={{ mb: 2 }}
                        >
                            <ToggleButton value="pickup">Pickup</ToggleButton>
                            <ToggleButton value="delivery">Delivery</ToggleButton>
                        </ToggleButtonGroup>

                        {localFulfillmentType === 'pickup' ? (
                            <FormControl fullWidth variant="outlined" size="small">
                                <InputLabel shrink id="pickup-location-label" sx={{ backgroundColor: 'white', pr: 1, ml: -0.5 }}>
                                    Pickup Location
                                </InputLabel>
                                <Button
                                    fullWidth
                                    variant="outlined"
                                    onClick={() => setModalOpen(true)}
                                    endIcon={<ArrowDropDownIcon sx={{ color: 'action.active' }} />}
                                    sx={{
                                        borderColor: 'rgba(0, 0, 0, 0.23)',
                                        color: 'black',
                                        textTransform: 'none',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        py: '8.5px',
                                        px: '14px',
                                        '&:hover': {
                                            borderColor: 'black',
                                            backgroundColor: 'rgba(0,0,0,0.04)'
                                        }
                                    }}
                                >
                                    {selectedLocation ? (
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                                                {selectedLocation['Location Name']}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {selectedLocation['Location Address'] ? selectedLocation['Location Address'].replace('\n', ', ') : ''}
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ py: 1.5 }}>Select a location</Typography>
                                    )}
                                </Button>
                            </FormControl>
                        ) : (
                            <Stack spacing={2}>
                                {isManualEntry ? (
                                    <>
                                        <TextField fullWidth label="Street Address" name="street" value={address?.street || ''} onChange={handleAddressChange} size="small" />
                                        <TextField fullWidth label="Apt or Suite (Optional)" name="aptSuite" value={address?.aptSuite || ''} onChange={handleAddressChange} size="small" />
                                        <TextField fullWidth label="City" name="city" value={address?.city || ''} onChange={handleAddressChange} size="small" />
                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel id="state-select-label">State</InputLabel>
                                                <Select labelId="state-select-label" name="state" value={address?.state || ''} label="State" onChange={handleAddressChange}>
                                                    {states.map(stateAbbr => (<MenuItem key={stateAbbr} value={stateAbbr}>{stateAbbr}</MenuItem>))}
                                                </Select>
                                            </FormControl>
                                            <TextField fullWidth label="Zip Code" name="zip" value={address?.zip || ''} onChange={handleAddressChange} inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 5 }} size="small" />
                                        </Box>
                                        <Button variant="text" size="small" onClick={() => setIsManualEntry(false)}>Use Address Search</Button>
                                    </>
                                ) : (
                                    <>
                                        <GoogleAddressAutocomplete value={address?.fullAddressText || ''} sendToCatering={sendToCatering} onAddressSelected={(success) => { if (!success) setIsManualEntry(true); }} />
                                        {!!address?.street && !isManualEntry && (
                                            <TextField fullWidth label="Apt or Suite (Optional)" name="aptSuite" value={address?.aptSuite || ''} onChange={handleAddressChange} size="small" />
                                        )}
                                    </>
                                )}
                            </Stack>
                        )}
                    </Box>

                    {/* Checkout Footer */}
                    <Box sx={{
                        mt: 3,
                        pt: 2,
                        borderTop: 1,
                        borderColor: 'divider'
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <Box>
                                <Typography sx={{ fontWeight: 'bold', fontSize: '1.8rem' }}>
                                    ${total}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.6rem' }}>
                                    Taxes calculated at checkout
                                </Typography>
                            </Box>
                            <Button
                                variant="contained"
                                disabled={isContinueDisabled}
                                onClick={() => sendToCatering({ type: 'CONTINUE_TO_DATE' })}
                            >
                                Continue
                            </Button>
                        </Box>
                    </Box>
                </Box>
            )}

            {/* Location Selection Modal */}
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} aria-labelledby="location-select-modal-title">
                <Paper sx={modalStyle}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography id="location-select-modal-title" variant="h6" component="h2">
                            Select a Pickup Location
                        </Typography>
                        <IconButton onClick={() => setModalOpen(false)}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <List sx={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {locations.map(location => {
                            const addressText = location?.['Location Address'] ? location['Location Address'].replace('\n', ', ') : '';
                            return (
                                <ListItemButton
                                    key={location?.['Location ID']}
                                    onClick={() => handleLocationChange(location?.['Location ID'])}
                                    selected={localLocationId === location?.['Location ID']}
                                >
                                    <Box>
                                        <Typography sx={{ fontWeight: 'bold' }}>{location?.['Location Name']}</Typography>
                                        <Typography variant="body2" color="text.secondary">{addressText}</Typography>
                                    </Box>
                                </ListItemButton>
                            );
                        })}
                    </List>
                </Paper>
            </Modal>
        </Box>
    );
};
