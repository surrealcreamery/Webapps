import React, { useState, useEffect } from 'react';
import { Box, Typography, Stack, Button, Divider, CircularProgress, ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, MenuItem, TextField, Modal, Paper, List, ListItemButton, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { PROCESS_INVOICE_URL } from '@/constants/catering/cateringConstants';

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

export const CartView = ({ cart, sendToCatering, cateringState }) => {
    const { locations, fulfillmentDetails } = cateringState.context;
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [modalOpen, setModalOpen] = useState(false); // State for location modal

    const [localFulfillmentType, setLocalFulfillmentType] = useState(fulfillmentDetails.type);
    const [localLocationId, setLocalLocationId] = useState(fulfillmentDetails.locationId || '');

    useEffect(() => {
        setLocalFulfillmentType(fulfillmentDetails.type);
        setLocalLocationId(fulfillmentDetails.locationId || '');
    }, [fulfillmentDetails.type, fulfillmentDetails.locationId]);


    const handleQuantityChange = (cartItemId, change) => sendToCatering({ type: 'UPDATE_QUANTITY', cartItemId, change });
    const handleRemoveItem = (cartItemId) => sendToCatering({ type: 'REMOVE_ITEM', cartItemId });
    const handleAddMoreItems = () => sendToCatering({ type: 'GO_BACK' });
    
    // --- Fulfillment Handlers ---
    const handleFulfillmentTypeChange = (event, newType) => {
        if (newType !== null) {
            setLocalFulfillmentType(newType); 
            sendToCatering({ type: 'SET_FULFILLMENT_TYPE', 'type': newType });
        }
    };

    const handleLocationChange = (locationId) => {
        setLocalLocationId(locationId); // Update local state immediately
        sendToCatering({ type: 'SELECT_PICKUP_LOCATION', locationId: locationId });
        setModalOpen(false); // Close modal on selection
    };

    const handleAddressChange = (event) => {
        sendToCatering({ type: 'UPDATE_DELIVERY_ADDRESS', address: event.target.value });
    };

    // ... (discount and total calculation logic remains the same) ...
    const getApplicableDiscount = (cartItem) => {
        const { item, quantity } = cartItem;
        if (!item.discounts || item.discounts.length === 0) {
            return null;
        }
        const sortedDiscounts = [...item.discounts].sort((a, b) => b.minimumQuantity - a.minimumQuantity);
        return sortedDiscounts.find(d => quantity >= d.minimumQuantity) || null;
    };

    const calculateLineItemTotal = (cartItem) => {
        let itemPrice = cartItem.item['Item Price'] || 0;
        
        const applicableDiscount = getApplicableDiscount(cartItem);
        if (applicableDiscount) {
            if (applicableDiscount.fixedAmount) {
                itemPrice -= applicableDiscount.fixedAmount;
            } else if (applicableDiscount.percentage) {
                itemPrice *= (1 - applicableDiscount.percentage);
            }
        }

        const modifiersPrice = Object.entries(cartItem.selectedModifiers).reduce((modTotal, [modId, quantity]) => {
            let modifierPrice = 0;
            for (const cat of cartItem.item.ModifierCategories) {
                const foundMod = cat.Modifiers.find(mod => mod['Modifier ID'] === modId);
                if (foundMod) {
                    modifierPrice = foundMod['Modifier Price'] || 0;
                    break;
                }
            }
            return modTotal + (modifierPrice * quantity);
        }, 0);

        return ((itemPrice + modifiersPrice) * cartItem.quantity);
    };

    const total = cart.reduce((acc, cartItem) => acc + calculateLineItemTotal(cartItem), 0).toFixed(2);
    
    const handleGenerateInvoice = async () => {
        setIsGeneratingInvoice(true);
        const invoiceSummary = {
            lineItems: cart.map(cartItem => {
                const applicableDiscount = getApplicableDiscount(cartItem);
                let perItemPrice = cartItem.item['Item Price'];
                let discountDetails = null;

                if(applicableDiscount) {
                    if(applicableDiscount.fixedAmount) {
                        perItemPrice -= applicableDiscount.fixedAmount;
                        discountDetails = `$${applicableDiscount.fixedAmount} off per item (min ${applicableDiscount.minimumQuantity})`;
                    } else if (applicableDiscount.percentage) {
                        perItemPrice *= (1 - applicableDiscount.percentage);
                        discountDetails = `${applicableDiscount.percentage * 100}% off per item (min ${applicableDiscount.minimumQuantity})`;
                    }
                }

                return {
                    itemName: cartItem.item['Item Name'],
                    quantity: cartItem.quantity,
                    originalPerItemPrice: cartItem.item['Item Price'].toFixed(2),
                    finalPerItemPrice: perItemPrice.toFixed(2),
                    discountApplied: discountDetails,
                    selectedModifiers: cartItem.selectedModifiers,
                    lineItemTotal: calculateLineItemTotal(cartItem).toFixed(2)
                };
            }),
            subtotal: total,
            taxes: "0.00",
            total: total
        };

        console.log("--- SENDING INVOICE SUMMARY ---");
        console.log(JSON.stringify(invoiceSummary, null, 2));
        
        try {
            const response = await fetch(PROCESS_INVOICE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(invoiceSummary)
            });

            if (!response.ok) {
                throw new Error('Invoice generation failed.');
            }

            const result = await response.json();
            console.log("Invoice generation successful:", result);
            alert("Invoice has been successfully generated!");

        } catch (error) {
            console.error("Error generating invoice:", error);
            alert("There was an error generating the invoice. Please try again.");
        } finally {
            setIsGeneratingInvoice(false);
        }
    };

    const selectedLocation = locations.find(loc => loc['Location ID'] === localLocationId);

    return (
        <Box>
             <Typography variant="h2" component="h1" gutterBottom align="left" sx={{ fontWeight: 'bold' }}>Order Summary</Typography>
            {cart.length === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography>Your cart is empty.</Typography>
                    <Button variant="outlined" sx={{ mt: 2, color: 'black', borderColor: 'black' }} onClick={handleAddMoreItems}>Add Items</Button>
                </Box>
            ) : (
                <Box>
                    <Stack spacing={2} divider={<Divider />}>
                        {cart.map((cartItem) => {
                            const { item, quantity } = cartItem;
                            const lineItemTotal = calculateLineItemTotal(cartItem);
                            const applicableDiscount = getApplicableDiscount(cartItem);
                            
                            let perItemPrice = item['Item Price'];
                            if(applicableDiscount) {
                                if(applicableDiscount.fixedAmount) {
                                    perItemPrice -= applicableDiscount.fixedAmount;
                                } else if (applicableDiscount.percentage) {
                                    perItemPrice *= (1 - applicableDiscount.percentage);
                                }
                            }

                            return (
                                <Box key={cartItem.id} sx={{ py: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Typography variant="body1" component="div">{item['Item Name']}</Typography>
                                        <Button color="primary" onClick={() => handleRemoveItem(cartItem.id)} sx={{ padding: 0, minWidth: 'auto' }}>Remove</Button>
                                    </Box>
                                     <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                        {applicableDiscount ? (
                                            <>
                                                <Typography variant="body1" component="span" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                                                    ${item['Item Price'].toFixed(2)}
                                                </Typography>
                                                <Typography variant="body1" component="div">${perItemPrice.toFixed(2)}</Typography>
                                                <Typography variant="body1" component="span" color="text.primary">
                                                    (Discount for {applicableDiscount.minimumQuantity} Units)
                                                </Typography>
                                            </>
                                        ) : (
                                            <Typography variant="body1" component="div">${item['Item Price'].toFixed(2)}</Typography>
                                        )}
                                    </Box>
                                    <Box sx={{ pl: 1, mt: 1, color: 'text.secondary' }}>
                                        {Object.entries(cartItem.selectedModifiers).map(([modifierId, quantity]) => {
                                            if (quantity > 0) {
                                                let modifierName = '';
                                                for (const cat of item.ModifierCategories) {
                                                    const foundMod = cat.Modifiers.find(mod => mod['Modifier ID'] === modifierId);
                                                    if (foundMod) {
                                                        modifierName = foundMod['Modifier Name'];
                                                        break;
                                                    }
                                                }
                                                return <Typography key={modifierId} variant="body2">{modifierName} (x{quantity})</Typography>;
                                            }
                                            return null;
                                        })}
                                    </Box>
                                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <CartQuantitySelector value={quantity} onIncrement={() => handleQuantityChange(cartItem.id, 1)} onDecrement={() => handleQuantityChange(cartItem.id, -1)} />
                                        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                                            ${lineItemTotal.toFixed(2)}
                                        </Typography>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Stack>
                    
                    {/* ✅ MOVED: Total Summary now here */}
                    <Divider sx={{ my: 3 }} />
                    <Stack spacing={1.5}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body1" color="text.secondary">Subtotal</Typography><Typography variant="body1" color="text.secondary">${total}</Typography></Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body1" color="text.secondary">Taxes & Fees</Typography><Typography variant="body1" color="text.secondary">$0.00</Typography></Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}><Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total</Typography><Typography variant="body1" sx={{ fontWeight: 'bold' }}>${total}</Typography></Box>
                    </Stack>

                    <Button variant="outlined" fullWidth sx={{ mt: 3, color: 'black', borderColor: 'black' }} onClick={handleAddMoreItems}>Add More Items</Button>
                    <Divider sx={{ my: 3 }} />
                    
                    {/* Fulfillment Section */}
                    <Box sx={{ my: 3 }}>
                        <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>Fulfillment</Typography>
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
                            // ✅ FIX: Use a FormControl and InputLabel to properly style the button
                            <FormControl fullWidth variant="outlined" size="small">
                                <InputLabel shrink id="pickup-location-label" sx={{backgroundColor: 'white', pr: 1, ml: -0.5}}>
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
                                        py: '8.5px', // Match dense TextField
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
                                                {selectedLocation['Location Address'].replace('\n', ', ')}
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Typography color="text.secondary" sx={{py: 1.5}}>Select a location</Typography>
                                    )}
                                </Button>
                            </FormControl>
                        ) : (
                            <TextField
                                fullWidth
                                label="Delivery Address"
                                value={fulfillmentDetails.address || ''} 
                                onChange={handleAddressChange}
                                placeholder="Enter your delivery address"
                                multiline
                                rows={3}
                            />
                        )}
                    </Box>
                    <Divider sx={{ my: 3 }} />
                    {/* END: Fulfillment Section */}

                    <Button variant="contained" fullWidth sx={{ mt: 3 }}>
                        Proceed to Checkout
                    </Button>
                    <Button 
                        variant="text" 
                        fullWidth 
                        sx={{ mt: 1.5 }}
                        onClick={handleGenerateInvoice}
                        disabled={isGeneratingInvoice}
                    >
                        {isGeneratingInvoice ? <CircularProgress size={24} /> : 'Generate Invoice'}
                    </Button>
                </Box>
            )}

            {/* Location Selection Modal */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                aria-labelledby="location-select-modal-title"
            >
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
                            const address = location['Location Address'] ? location['Location Address'].replace('\n', ', ') : '';
                            return (
                                <ListItemButton
                                    key={location['Location ID']}
                                    onClick={() => handleLocationChange(location['Location ID'])}
                                    selected={localLocationId === location['Location ID']}
                                >
                                    <Box>
                                        <Typography sx={{ fontWeight: 'bold' }}>{location['Location Name']}</Typography>
                                        <Typography variant="body2" color="text.secondary">{address}</Typography>
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

