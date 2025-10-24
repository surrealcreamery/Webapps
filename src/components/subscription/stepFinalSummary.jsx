// /src/components/subscription/stepFinalSummary.jsx

import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Divider, Button, CircularProgress } from '@mui/material';
import CardBrandIcon from './cardBrandIcon.jsx';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

const StepFinalSummary = ({ plan, savedCards, selectedSavedCardId, onNavigate }) => {
    const [isButtonLoading, setIsButtonLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsButtonLoading(false);
        }, 5000); // 5 seconds
        return () => clearTimeout(timer);
    }, []);

    const billedCard = savedCards.find(card => card.id === selectedSavedCardId);

    const renewalDate = new Date();
    if (plan && plan.frequency && plan.frequency.toLowerCase().includes('year')) {
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    } else {
        renewalDate.setMonth(renewalDate.getMonth() + 1);
    }
    
    const formattedRenewalDate = renewalDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    
    const formatCardBrand = (brand = '') => {
        if (!brand) return 'Card';
        return brand
            .toLowerCase()
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // ✨ FIX: Helper function to format the plan frequency for display.
    const formatFrequency = (freq = '') => {
        if (freq.toLowerCase().includes('month')) return '/mo';
        if (freq.toLowerCase().includes('year')) return '/yr';
        return `/${freq}`;
    };

    return (
        <>
            <Typography variant="h1" gutterBottom align="center">Thank You! ✅</Typography>
            <Typography align="center" sx={{ mb: 4 }}>Your subscription is complete.</Typography>

            <Card variant="outlined">
                <CardContent sx={{ p: 2 }}>
                    <Typography variant="h2" gutterBottom>
                        Subscription Details
                    </Typography>
                    
                    {/* ✨ FIX: Added section to display the selected plan's name and price/frequency. */}
                    {plan && (
                         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                            <Typography variant="body1" color="text.secondary">Your Plan</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                {`${plan.name} ($${plan.price}${formatFrequency(plan.frequency)})`}
                            </Typography>
                        </Box>
                    )}

                    {/* Billed Card Section */}
                    {billedCard && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                            <Typography variant="body1" color="text.secondary">Billed to</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CardBrandIcon brand={billedCard.card_brand} />
                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                    {formatCardBrand(billedCard.card_brand)} ending in {billedCard.last_4}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    <Divider sx={{ my: 2 }} />

                    {/* Renewal Date Section */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body1" color="text.secondary">
                            First renewal on
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {formattedRenewalDate}
                        </Typography>
                    </Box>
                </CardContent>
            </Card>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                <Button
                    variant="contained"
                    onClick={() => onNavigate('/redeem')}
                    disabled={isButtonLoading}
                    endIcon={!isButtonLoading && <ArrowForwardIcon />}
                    sx={{ minWidth: 200, minHeight: 48 }}
                >
                    {isButtonLoading ? (
                        <CircularProgress size={24} color="inherit" />
                    ) : (
                        'View Redeem Page'
                    )}
                </Button>
            </Box>
        </>
    );
};

export default StepFinalSummary;