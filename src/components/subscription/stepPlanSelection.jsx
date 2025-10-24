import React, { useMemo } from 'react';
import {
    Box,
    Typography,
    CardContent,
    Button,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckIcon from '@mui/icons-material/Check';
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

const StepPlanSelection = ({ send, planId, availablePlans, currentFlowType, onViewAllDrinks }) => {

    // --- LOG 1: Log all incoming props when the component renders. ---
    // This helps verify that `availablePlans` is being passed correctly from the parent.
    console.log('[StepPlanSelection] Received props:', { planId, availablePlans, currentFlowType });

    const showOfferSection =
        currentFlowType === 'explicitUtmModelAndLoc' ||
        currentFlowType === 'explicitUtmPlan';

    const showBackButton = currentFlowType !== 'explicitUtmModelAndLoc';

    const { basePlans, upgradePlans } = useMemo(() => {
        // --- LOG 2: Log the data being processed by useMemo. ---
        // This confirms the `useMemo` hook is receiving the plans.
        console.log('[useMemo] Processing availablePlans:', availablePlans);

        if (!availablePlans || !Array.isArray(availablePlans)) {
            console.error('[useMemo] ERROR: availablePlans is null, undefined, or not an array. Cannot filter plans.');
            return { basePlans: [], upgradePlans: [] };
        }
        
        const base = availablePlans
            .filter(p => p['Plan Type'] === 'Base')
            .sort((a, b) => a.price - b.price);
            
        const upgrade = availablePlans
            .filter(p => p['Plan Type'] === 'Upgrade')
            .sort((a, b) => a.price - b.price);

        // --- LOG 3: Log the result of the filtering and sorting logic. ---
        // This helps debug if the filtering on 'Plan Type' is working as expected.
        console.log('[useMemo] Calculated plans:', { basePlans: base, upgradePlans: upgrade });

        return { basePlans: base, upgradePlans: upgrade };
    }, [availablePlans]);

    const cheapestBasePlan = basePlans[0];

    const PlanButton = ({ plan, priceDifference }) => {
        // --- LOG 4: Log the specific plan object being rendered by this button. ---
        // This is useful to inspect the properties of each plan, including the 'benefits' array.
        console.log(`[PlanButton] Rendering plan: "${plan?.name}"`, plan);
        
        return (
            <Button
                key={plan.id}
                onClick={() => send({ type: 'SELECT_PLAN', value: plan.id })}
                variant="outlined"
                fullWidth
                sx={{
                    my: 1, p: 0, textTransform: 'none', textAlign: 'left',
                    display: 'block', color: 'text.primary', boxShadow: 'none',
                    borderStyle: 'solid',
                    borderWidth: plan.id === planId ? '2px' : '1px',
                    borderColor: plan.id === planId ? 'primary.main' : 'black',
                    '&:hover': {
                        backgroundColor: 'action.hover',
                        borderColor: plan.id === planId ? 'primary.main' : 'black',
                    }
                }}
            >
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                            <Typography variant="h3">{plan.name}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {plan.description || 'No description available.'}
                            </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 2 }}>
                            {priceDifference != null ? (
                                <>
                                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                        {`+ $${priceDifference.toFixed(2)}`}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">{plan.frequency}</Typography>
                                </>
                            ) : (
                                <>
                                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                        {`$${plan.price}`}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">{plan.frequency}</Typography>
                                </>
                            )}
                        </Box>
                    </Box>
                    
                    {plan.benefits && plan.benefits.length > 0 && (
                        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                            <List dense disablePadding>
                                {plan.benefits.map((benefit, index) => (
                                    <ListItem key={index} disableGutters sx={{ py: 0 }}>
                                        <ListItemIcon sx={{ minWidth: 28 }}>
                                            <CheckIcon fontSize="small" color="primary" />
                                        </ListItemIcon>
                                        <ListItemText 
                                            primary={benefit} 
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    )}
                </CardContent>
            </Button>
        );
    };

    return (
        <>
            {showOfferSection && <OfferDetails onViewAllDrinks={onViewAllDrinks} />}
            <Box sx={{ mt: 3 }}>
                <Typography variant={showOfferSection ? "h2" : "h1"} gutterBottom>
                    Select a Plan
                </Typography>
                
                <Box sx={{ mt: 3 }}>
                    {basePlans.length > 0 ? (
                        basePlans.map(p => <PlanButton key={p.id} plan={p} />)
                    ) : (
                        <Typography color="text.secondary">No base plans available.</Typography>
                    )}
                </Box>

                {upgradePlans.length > 0 && (
                    <Box sx={{ mt: 4 }}>
                        <Typography variant="h2" sx={{ mb: 1 }}>
                            Upgrade Your Plan
                        </Typography>
                        
                        {upgradePlans.map(p => {
                            let difference = null;
                            if (cheapestBasePlan && p.price > cheapestBasePlan.price) {
                                difference = p.price - cheapestBasePlan.price;
                            }
                            return <PlanButton key={p.id} plan={p} priceDifference={difference} />;
                        })}
                    </Box>
                )}
                
                <Box sx={{ mt: 4, display: 'flex' }}>
                    {showBackButton && (
                        <Button variant="grey-back" onClick={() => send({ type: 'BACK' })}>
                            Back
                        </Button>
                    )}
                </Box>
            </Box>
        </>
    );
};

export default StepPlanSelection;