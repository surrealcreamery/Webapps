import React, { useState, useEffect } from 'react';
import { Box, Typography, Stack, Button, Divider, CircularProgress, ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, MenuItem, TextField, Modal, Paper, List, ListItemButton, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { LocalizationProvider, DateCalendar, PickersDay } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { isBefore, startOfToday, isToday, addDays, format } from 'date-fns';
import { PROCESS_INVOICE_URL } from '@/constants/catering/cateringConstants';
import { GoogleAddressAutocomplete } from './GoogleAddressAutocomplete';

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

// Custom day styling for calendar
const CustomDay = (props) => {
    const { day, outsideCurrentMonth, disabled, selected, today, ...other } = props;
    const isFutureWeekday = !disabled && !outsideCurrentMonth && !selected && !isBefore(day, startOfToday());

    return (
        <PickersDay
            {...other}
            outsideCurrentMonth={outsideCurrentMonth}
            day={day}
            disabled={disabled}
            selected={selected}
            sx={{
                ...(isFutureWeekday && { 
                    borderRadius: '50%', 
                    backgroundColor: '#F1F4FF', 
                    color: '#3055DD', 
                    fontWeight: 'bold', 
                    '&:hover': { backgroundColor: '#E4E9FF' } 
                }),
                ...(today && { border: '1px solid transparent !important' }),
                ...(selected && { 
                    borderRadius: '50%', 
                    backgroundColor: '#3055DD', 
                    color: 'white', 
                    fontWeight: 'bold', 
                    '&:hover': { backgroundColor: '#2545b2' } 
                }),
            }}
        />
    );
};

export const CartView = ({ cart, sendToCatering, cateringState }) => {
    const { locations, fulfillmentDetails, isAuthenticated, contactInfo } = cateringState.context;
    const { type, locationId, address } = fulfillmentDetails;

    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [localFulfillmentType, setLocalFulfillmentType] = useState(type);
    const [localLocationId, setLocalLocationId] = useState(locationId || '');

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
            sendToCatering({ type: 'SET_FULFILLMENT_TYPE', 'type': newType });
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
        return ((itemPrice + modifiersPrice) * (cartItem.quantity || 0));
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
                             if (!cartItem?.item) {
                                 return <Typography key={cartItem.id || Math.random()} color="error">Invalid item in cart.</Typography>;
                             }
                            const { item, quantity } = cartItem;
                            const lineItemTotal = calculateLineItemTotal(cartItem);
                            const applicableDiscount = getApplicableDiscount(cartItem);
                            let perItemPrice = item['Item Price'] || 0;
                            if(applicableDiscount) {
                                if(applicableDiscount.fixedAmount) perItemPrice -= applicableDiscount.fixedAmount;
                                else if (applicableDiscount.percentage) perItemPrice *= (1 - applicableDiscount.percentage);
                            }

                            return (
                                <Box key={cartItem.id} sx={{ py: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Typography variant="body1" component="div">{item['Item Name'] || 'Unknown Item'}</Typography>
                                        <Button color="primary" onClick={() => handleRemoveItem(cartItem.id)} sx={{ padding: 0, minWidth: 'auto' }}>Remove</Button>
                                    </Box>
                                     <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                        {applicableDiscount ? (
                                            <>
                                                <Typography variant="body1" component="span" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                                                    ${(item['Item Price'] || 0).toFixed(2)}
                                                </Typography>
                                                <Typography variant="body1" component="div">${perItemPrice.toFixed(2)}</Typography>
                                                <Typography variant="body1" component="span" color="text.primary">
                                                    (Min {applicableDiscount.minimumQuantity})
                                                </Typography>
                                            </>
                                        ) : (
                                            <Typography variant="body1" component="div">${(item['Item Price'] || 0).toFixed(2)}</Typography>
                                        )}
                                    </Box>
                                    <Box sx={{ pl: 1, mt: 1, color: 'text.secondary' }}>
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
                                            return <Typography key={modifierId} variant="body2">{modifierName} (x{qty})</Typography>;
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

                    <Button variant="outlined" fullWidth sx={{ mt: 3, mb: 2, color: 'black', borderColor: 'black' }} onClick={handleAddMoreItems}>Add More Items</Button>

                    <Divider sx={{ my: 3 }} />
                    <Stack spacing={1.5}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body1" color="text.secondary">Subtotal</Typography><Typography variant="body1" color="text.secondary">${total}</Typography></Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body1" color="text.secondary">Taxes & Fees</Typography><Typography variant="body1" color="text.secondary">$0.00</Typography></Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}><Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total</Typography><Typography variant="body1" sx={{ fontWeight: 'bold' }}>${total}</Typography></Box>
                    </Stack>

                    <Divider sx={{ my: 3 }} />

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
                             <FormControl fullWidth variant="outlined" size="small">
                                 <InputLabel shrink id="pickup-location-label" sx={{backgroundColor: 'white', pr: 1, ml: -0.5}}>
                                     Pickup Location
                                 </InputLabel>
                                 <Button fullWidth variant="outlined" onClick={() => setModalOpen(true)} endIcon={<ArrowDropDownIcon sx={{ color: 'action.active' }} />} sx={{ borderColor: 'rgba(0, 0, 0, 0.23)', color: 'black', textTransform: 'none', justifyContent: 'space-between', alignItems: 'center', py: '8.5px', px: '14px', '&:hover': { borderColor: 'black', backgroundColor: 'rgba(0,0,0,0.04)'}}}>
                                     {selectedLocation ? (
                                         <Box sx={{ textAlign: 'left' }}>
                                             <Typography sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>{selectedLocation['Location Name']}</Typography>
                                             <Typography variant="body2" color="text.secondary">{selectedLocation['Location Address'] ? selectedLocation['Location Address'].replace('\n', ', ') : ''}</Typography>
                                         </Box>
                                     ) : (
                                         <Typography color="text.secondary" sx={{py: 1.5}}>Select a location</Typography>
                                     )}
                                 </Button>
                             </FormControl>
                        ) : (
                            <Stack spacing={2}>
                                {isManualEntry ? (
                                    <>
                                        <TextField fullWidth label="Street Address" name="street" value={address?.street || ''} onChange={handleAddressChange} size="small"/>
                                        <TextField fullWidth label="Apt or Suite (Optional)" name="aptSuite" value={address?.aptSuite || ''} onChange={handleAddressChange} size="small"/>
                                        <TextField fullWidth label="City" name="city" value={address?.city || ''} onChange={handleAddressChange} size="small"/>
                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel id="state-select-label">State</InputLabel>
                                                <Select labelId="state-select-label" name="state" value={address?.state || ''} label="State" onChange={handleAddressChange}>
                                                    {states.map(stateAbbr => (<MenuItem key={stateAbbr} value={stateAbbr}>{stateAbbr}</MenuItem>))}
                                                </Select>
                                            </FormControl>
                                            <TextField fullWidth label="Zip Code" name="zip" value={address?.zip || ''} onChange={handleAddressChange} inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 5 }} size="small"/>
                                        </Box>
                                        <Button variant="text" size="small" onClick={() => setIsManualEntry(false)}>Use Address Search</Button>
                                    </>
                                ) : (
                                    <>
                                        <GoogleAddressAutocomplete value={address?.fullAddressText || ''} sendToCatering={sendToCatering} onAddressSelected={(success) => { if (!success) setIsManualEntry(true); }}/>
                                        {!!address?.street && !isManualEntry && (
                                            <TextField fullWidth label="Apt or Suite (Optional)" name="aptSuite" value={address?.aptSuite || ''} onChange={handleAddressChange} size="small"/>
                                        )}
                                    </>
                                )}
                            </Stack>
                        )}
                    </Box>
                    <Divider sx={{ my: 3 }} />

                    <Button
                        variant="contained"
                        fullWidth
                        sx={{ mt: 3 }}
                        disabled={isContinueDisabled}
                        onClick={() => sendToCatering({ type: 'CONTINUE_TO_DATE' })}
                    >
                        Continue
                    </Button>
                </Box>
            )}

            <Modal open={modalOpen} onClose={() => setModalOpen(false)} aria-labelledby="location-select-modal-title">
                <Paper sx={modalStyle}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography id="location-select-modal-title" variant="h6" component="h2">Select a Pickup Location</Typography>
                        <IconButton onClick={() => setModalOpen(false)}><CloseIcon /></IconButton>
                    </Box>
                    <List sx={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {locations.map(location => {
                            const addressText = location?.['Location Address'] ? location['Location Address'].replace('\n', ', ') : '';
                            return (
                                <ListItemButton key={location?.['Location ID']} onClick={() => handleLocationChange(location?.['Location ID'])} selected={localLocationId === location?.['Location ID']}>
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
