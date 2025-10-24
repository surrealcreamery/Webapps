import React from 'react';
import { Box, Typography, Divider, Button, IconButton } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import HeroImage from '@/assets/images/Surreal Creamery/Hero.png';

// A sub-component for displaying the main offer details.
const OfferDetails = ({ onViewAllDrinks }) => {
    const drinkCategories = [
        { name: 'Iced Milk Teas', id: 'iced-milk-teas' },
        { name: 'Iced Coffee', id: 'iced-coffee' },
        { name: 'Iced Fruit Black or Green Teas', id: 'iced-fruit-teas' }
    ];
    return (
        <Box>
            <Box component="img" 
                src={HeroImage}
                alt="A collection of colorful Bubble Teas"
                sx={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: 2,
                    mb: 2,
                }}
            />
            <Typography variant="h1" sx={{ mb: 2 }}>$1 Medium Bubble Tea Once a Day, Everyday.</Typography>
            <Box sx={{ textAlign: 'left', my: 1 }}>
                {drinkCategories.map((category) => (
                    <Box key={category.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                        <Typography variant="body1">{category.name}</Typography>
                        <IconButton 
                            aria-label={`More info about ${category.name}`} 
                            onClick={() => onViewAllDrinks(category.id)}
                            sx={{ p: 1 }}
                        >
                            <InfoOutlinedIcon sx={{ fontSize: '2.4rem' }} />
                        </IconButton>
                    </Box>
                ))}
            </Box>
            <Box sx={{ pt: 2 }}>
                <Button variant="grey-back" fullWidth onClick={() => onViewAllDrinks()}>View All Drinks</Button>
            </Box>
            <Divider sx={{ mt: 3 }} />
        </Box>
    );
};

const StepModelSelection = ({ send, modelId, availableModels, getPriceForModel, currentFlowType, onViewAllDrinks }) => {
    const isChangeFlow = currentFlowType === 'changeModel';
    const showOfferSection = currentFlowType === 'noUtmDefault' || currentFlowType === 'explicitUtmLocOnly';

    const renderModelList = () => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
            {availableModels.map((model) => {
                const priceInfo = getPriceForModel(model.id);
                const description = model.description || model['Pricing Model Description']; // Use the correct field name
                return (
                    <Button
                        key={model.id}
                        variant="outlined"
                        fullWidth
                        onClick={() => send({ type: 'SELECT_MODEL', value: model.id })}
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start', // Changed from 'center' to allow vertical stacking
                            py: 2, px: 2, 
                            textTransform: 'none',
                            textAlign: 'left',
                            color: 'text.primary',
                            boxShadow: 'none',
                            borderStyle: 'solid',
                            borderWidth: model.id === modelId ? '2px' : '1px',
                            borderColor: model.id === modelId ? 'primary.main' : 'black',
                            '&:hover': { 
                                backgroundColor: 'action.hover',
                                borderColor: model.id === modelId ? 'primary.main' : 'black',
                             },
                        }}
                    >
                        <Box>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{model.name}</Typography>
                            {description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {description}
                                </Typography>
                            )}
                        </Box>
                        {priceInfo && (<Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, ml: 2, mt: '2px' }}>{priceInfo.text}</Typography>)}
                    </Button>
                );
            })}
        </Box>
    );

    return (
        <>
            {showOfferSection && <OfferDetails onViewAllDrinks={onViewAllDrinks} />}
            <Box sx={{ mt: 3 }}>
                <Typography variant={showOfferSection ? "h2" : "h1"} gutterBottom>Select a Plan</Typography>
                {renderModelList()}
                {isChangeFlow && (
                    <Box sx={{ mt: 4, display: 'flex' }}>
                        <Button variant="grey-back" onClick={() => send({ type: 'BACK' })}>
                            Back
                        </Button>
                    </Box>
                )}
            </Box>
        </>
    );
};

export default StepModelSelection;
