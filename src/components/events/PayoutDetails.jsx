import React, { useState, useMemo } from 'react';
import { Box, Typography, Button, Container, Paper, List, ListItem, ListItemText, Divider, Breadcrumbs, Link as MuiLink, TextField, CircularProgress } from '@mui/material';

// A sub-component for the payee form
const EditPayeeForm = ({ initialData = {}, onSubmit, onCancel, isSubmitting }) => {
    const [payeeName, setPayeeName] = useState(initialData.name || '');
    const [address, setAddress] = useState(initialData.address || '');

    const handleSubmit = () => {
        onSubmit({ name: payeeName, address });
    };

    return (
        <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
            <Typography variant="h2" component="h2" sx={{ mb: 2 }}>
                Edit Payee Information
            </Typography>
            <TextField
                fullWidth
                margin="dense"
                label="Payee Name (Individual or Organization)"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
            />
            <TextField
                fullWidth
                margin="dense"
                label="Mailing Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
            />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <CircularProgress size={24} /> : 'Save'}
                </Button>
            </Box>
        </Paper>
    );
};


export const PayoutDetails = ({ event, onBack, onBackToDashboard, onGoHome, send, context }) => {
    console.log("--- PayoutDetails Diagnostics ---");
    console.log("1. Raw event prop received:", event);

    const isEditing = context.matches('payoutDetails.editingPayee');
    const isSubmitting = context.matches('payoutDetails.submittingPayee');
    
    // Logic to derive payeeInfo from either the nested object or the raw fields
    const payeeInfo = useMemo(() => {
        if (event?.payeeInfo) {
            return event.payeeInfo;
        }
        if (event?.['Payee Information'] || event?.['Payee Mailing Address']) {
            return {
                name: event['Payee Information'],
                address: event['Payee Mailing Address']
            };
        }
        return null;
    }, [event]);

    console.log("2. Derived payeeInfo object:", payeeInfo);

    const handleEditClick = () => {
        console.log("Attempting to send EDIT_PAYEE event...");
        send({ type: 'EDIT_PAYEE' });
    };

    if (isEditing || isSubmitting) {
        return (
            <Container maxWidth="sm" sx={{ pt: 0, pb: 4 }}>
                 <EditPayeeForm 
                    initialData={payeeInfo || {}}
                    isSubmitting={isSubmitting}
                    onSubmit={(data) => send({ type: 'SUBMIT_PAYEE', data })}
                    onCancel={() => send({ type: 'CANCEL_EDIT_PAYEE' })}
                 />
            </Container>
        );
    }

    return (
        <Container maxWidth="sm" sx={{ pt: 0, pb: 4 }}>
            <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
                <MuiLink underline="hover" color="inherit" href="#" onClick={onGoHome} sx={{cursor: 'pointer'}}>
                    Home
                </MuiLink>
                <MuiLink underline="hover" color="inherit" href="#" onClick={onBackToDashboard} sx={{cursor: 'pointer'}}>
                    My Events
                </MuiLink>
                <MuiLink underline="hover" color="inherit" href="#" onClick={onBack} sx={{cursor: 'pointer'}}>
                    Details
                </MuiLink>
                <Typography color="text.primary">Payouts</Typography>
            </Breadcrumbs>
            
            <Typography variant="h1" component="h1" sx={{ mb: 6 }}>
                Payout Information
            </Typography>

            {/* Payee Info Section - Border Removed */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h2" component="h2" sx={{ mb: 2 }}>
                    Payee
                </Typography>
                {payeeInfo ? (
                    <>
                        <Typography sx={{ fontWeight: 'bold' }}>{payeeInfo.name}</Typography>
                        <Typography color="text.secondary">{payeeInfo.address}</Typography>
                        <Button variant="contained" sx={{ mt: 2 }} onClick={handleEditClick}>
                            Edit Payee
                        </Button>
                    </>
                ) : (
                    <>
                        <Typography color="text.secondary">No payee information on file.</Typography>
                        <Button variant="contained" sx={{ mt: 2 }} onClick={handleEditClick}>
                            Add Payee
                        </Button>
                    </>
                )}
            </Box>

            {/* Payment Status Section - Replaces Payout History */}
            <Box>
                <Typography variant="h2" component="h2" sx={{ mb: 2 }}>
                    Payment Status
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold', color: event['Payment Status'] === 'Check Sent' ? 'success.main' : 'text.primary' }}>
                    {event['Payment Status'] || 'Not available'}
                </Typography>
            </Box>
        </Container>
    );
};

