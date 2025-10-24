import React, { useCallback, useState } from 'react';
import { Box, Typography, Card, CardContent, Divider, CardActions, Button, IconButton } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const IncludedItemsList = () => {
    const includedItems = [
        'Any topping of your choice with:',
        'Iced Milk Teas (Earl Grey, Thai Milk, or Taro)',
        'Iced Coffee (Vietnamese Iced Coffee)',
        'Iced Fruit Black or Green Teas'
    ];

    return (
        <Box>
            {includedItems.map((item, index) => (
                <React.Fragment key={index}>
                    {index === 0 ? (<Typography variant="body1" sx={{ py: 1.5 }}><strong>{item}</strong></Typography>)
                        : (<Typography variant="body1" sx={{ py: 1.5, pl: 2 }}>{item}</Typography>)}
                    {index > 0 && index < includedItems.length - 1 && <Divider />}
                </React.Fragment>
            ))}
        </Box>
    );
};


const StepModelLocationSelection = ({
    send,
    modelId,
    locationId,
    availableModels,
    availableLocations,
    preselectedLocation,
    plans,
    currentFlowType
}) => {
    const [userHasSelectedModel, setUserHasSelectedModel] = useState(false);
    
    const drinkCategories = [
        'Iced Milk Teas',
        'Iced Coffee',
        'Iced Fruit Black or Green Teas'
    ];
    
    const getPriceForModel = useCallback((modelIdToFind) => {
        if (!plans || plans.length === 0) return null;
        if (locationId) {
            const specificPlan = plans.find(p => p.modelId === modelIdToFind && (p.locationIds || []).includes(locationId));
            if (specificPlan) return { text: `$${specificPlan.price}` };
        }
        const plansForModel = plans.filter(p => p.modelId === modelIdToFind);
        if (plansForModel.length === 0) return null;
        const prices = plansForModel.map(p => p.price);
        const minPrice = Math.min(...prices);
        return { text: `Starting at $${minPrice}` };
    }, [plans, locationId]);

    const handleModelSelect = (selectedModelId) => {
        send({ type: 'SELECT_MODEL', value: selectedModelId });
        setUserHasSelectedModel(true);
    };

    const renderModelList = () => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
            {availableModels.map((model) => {
                const priceInfo = getPriceForModel(model.id);
                return (
                    <Button
                        key={model.id}
                        variant="contained"
                        fullWidth
                        onClick={() => handleModelSelect(model.id)}
                        sx={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            py: 2, px: 2,
                            backgroundColor: 'black', color: 'white',
                            '&:hover': { backgroundColor: '#333' },
                        }}
                    >
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{model.name}</Typography>
                        {priceInfo && (<Typography variant="body2" color="rgba(255,255,255,0.7)">{priceInfo.text}</Typography>)}
                    </Button>
                );
            })}
        </Box>
    );

    const renderLocationList = () => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
            {availableLocations.map((location) => (
                <Button
                    key={location.id}
                    variant="contained"
                    fullWidth
                    onClick={() => send({ type: 'SELECT_LOCATION', value: location.id })}
                    sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        py: 2, px: 2,
                        backgroundColor: 'black', color: 'white',
                        '&:hover': { backgroundColor: '#333' },
                    }}
                >
                    <Typography variant="body1" sx={{ flexGrow: 1, textAlign: 'left', fontWeight: 'bold' }}>{location.name}</Typography>
                    {location.id === locationId && <CheckCircleIcon />}
                </Button>
            ))}
        </Box>
    );

    const selectedModel = modelId ? availableModels.find(m => m.id === modelId) : null;
    const isChangeFlow = currentFlowType === 'changeLocation' || currentFlowType === 'changeModel';
    const showOfferSection = !userHasSelectedModel && !isChangeFlow;

    return (
        <>
            {/* The model summary that was at the top of the page is removed from here */}

            {showOfferSection && (
                 <Box>
                    <Typography variant="h1" sx={{ mb: 2 }}>$1 Medium Bubble Tea Once a Day, Everyday.</Typography>
                    <Divider sx={{ mt: 2 }}/>
                    <Box sx={{ textAlign: 'left', my: 1 }}>
                        {drinkCategories.map((category) => (
                            <Box key={category} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                                <Typography variant="body1">{category}</Typography>
                                <IconButton aria-label={`More info about ${category}`}>
                                    <InfoOutlinedIcon />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>
                    <Divider />
                    <Box sx={{ pt: 2 }}>
                        <Button variant="grey-back" fullWidth>View All Drinks</Button>
                    </Box>
                 </Box>
            )}
            
            {!modelId && (
                <Box sx={{ mt: 3 }}>
                    {renderModelList()}
                    {isChangeFlow && (
                        <Box sx={{ mt: 2 }}>
                            <Button variant="text" size="small" className="no-padding" onClick={() => send({ type: 'BACK_TO_SUMMARY' })}>Back to Summary</Button>
                        </Box>
                    )}
                </Box>
            )}

            {modelId && !locationId && (
                <Box sx={{ mt: 3 }}>
                    {/* NEW: Model summary is now here, above the location list */}
                    {selectedModel && (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="h3">{selectedModel.name}</Typography>
                            <Typography variant="h3" color="text.secondary">{getPriceForModel(selectedModel.id)?.text}</Typography>
                        </Box>
                    )}
                    <Typography variant="h3" gutterBottom>Select a Location</Typography>
                    {renderLocationList()}
                </Box>
            )}

            {modelId && locationId && (
                <Box sx={{ mt: 4 }}>
                    <Button fullWidth variant="contained" onClick={() => send({ type: 'SELECT_LOCATION', value: locationId })}>
                        Continue
                    </Button>
                </Box>
            )}
        </>
    );
};

export default StepModelLocationSelection;