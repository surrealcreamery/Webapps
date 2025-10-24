import React from 'react';
import {
    Box,
    Typography,
    Button,
    Divider,
    Card,
    CardContent,
    CardActions,
    FormControlLabel,
    Checkbox,
    CircularProgress
} from '@mui/material';
import QuantityInput from './quantityInput';

const StepPlanSummary = ({ send, plan, model, location, numberOfSubscriptions, currentFlowType, isGift }) => {
    
    const TAX_RATE = 0.06675;
    
    const renderActions = () => {
        // ✅ FIX: The logic for rendering the 'Change' buttons is added here.
        // It uses the currentFlowType prop to decide which options to show.
        console.log('[StepPlanSummary] renderActions called with currentFlowType:', currentFlowType);

        switch (currentFlowType) {
            case 'explicitUtmLocOnly':
                return (
                    <Button variant="text" sx={{ padding: 0 }} onClick={() => send({ type: 'CHANGE_MODEL' })}>
                        Change Plan
                    </Button>
                );
            case 'explicitUtmModelOnly':
                return (
                    <Button variant="text" sx={{ padding: 0 }} onClick={() => send({ type: 'CHANGE_LOCATION' })}>
                        Change Location
                    </Button>
                );
            case 'explicitUtmModelAndLoc':
                return (
                    <Button variant="text" sx={{ padding: 0 }} onClick={() => send({ type: 'CHANGE_PLAN_ONLY' })}>
                        Change Plan
                    </Button>
                );
            case 'changeModel':
            case 'changeLocation':
            case 'noUtmDefault':
            default:
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', width: '100%', alignItems: 'center' }}>
                        <Button 
                            variant="text" 
                            onClick={() => send({ type: 'CHANGE_LOCATION' })} 
                            sx={{ padding: 0, pr: 2, borderRight: '1px solid rgba(0, 0, 0, 0.12)', borderRadius: 0, lineHeight: 1 }}
                        >
                            Change Location
                        </Button>
                        <Button 
                            variant="text" 
                            onClick={() => send({ type: 'CHANGE_MODEL' })} 
                            sx={{ padding: 0, pl: 2 }}
                        >
                            Change Plan
                        </Button>
                    </Box>
                );
        }
    };

    return (
        <>
            <Typography variant="h1" gutterBottom>Plan Summary</Typography>
            
            {plan && model && location ? (
                <Card variant="outlined" sx={{ mt: 3 }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box>
                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{location.name}</Typography>
                                <Typography variant="body1" color="text.secondary">{plan.name}</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 2 }}>
                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>${plan.price}</Typography>
                                <Typography variant="body2" color="text.secondary">{plan.frequency}</Typography>
                            </Box>
                        </Box>
                    </CardContent>
                    <Divider />
                    <CardActions sx={{ p: 2 }}>
                        {renderActions()}
                    </CardActions>
                </Card>
            ) : (
                <Card variant="outlined" sx={{ mt: 3, p: 2, textAlign: 'center' }}>
                    <CircularProgress size={24} />
                    <Typography sx={{ mt: 1 }} color="text.secondary">Loading details...</Typography>
                </Card>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 1 }}>
                <Typography variant="body1">Number of Subscriptions</Typography>
                <QuantityInput value={numberOfSubscriptions} onChange={(newValue) => send({ type: 'SET_QUANTITY', value: newValue })} />
            </Box>

            <FormControlLabel
                control={
                    <Checkbox
                        checked={isGift}
                        onChange={() => send({ type: 'TOGGLE_IS_GIFT' })}
                    />
                }
                label="This is a gift"
                sx={{ display: 'flex', mt: 1 }}
            />
            
            <Divider sx={{ my: 2 }} />

            {plan && (
                <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2">Subtotal</Typography>
                        <Typography variant="body2">${(plan.price * numberOfSubscriptions).toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2">Taxes ({(TAX_RATE * 100).toFixed(3)}%)</Typography>
                        <Typography variant="body2">${(plan.price * numberOfSubscriptions * TAX_RATE).toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>${(plan.price * numberOfSubscriptions * (1 + TAX_RATE)).toFixed(2)}</Typography>
                    </Box>
                </>
            )}
            
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="grey-back" onClick={() => send({ type: 'BACK' })}>Back</Button>
                <Button variant="contained" onClick={() => send({ type: 'PROCEED_TO_CONTACT' })}>Continue</Button>
            </Box>
        </>
    );
};

export default StepPlanSummary;