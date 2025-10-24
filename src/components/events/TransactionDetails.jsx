import React, { useMemo } from 'react';
import { Box, Typography, Button, Container, List, ListItem, Divider, Breadcrumbs, Link as MuiLink, Paper, ListItemText } from '@mui/material';
import { format, startOfDay, isValid } from 'date-fns';

const formatDateSafe = (dateValue, formatString) => {
  const date = new Date(dateValue);
  if (!isValid(date)) return 'Invalid Date';
  return format(date, formatString);
};

export const TransactionDetails = ({ event, onBack, onGoHome, onViewPayouts }) => {
    const transactions = event['Transaction Details'] || [];
    const grandTotal = event['Fundraiser Tally'] || 0;
    const eventName = event['Event Name']?.[0] || 'Event Details';
    const amountDonated = grandTotal * 0.10;

    const groupedTransactions = useMemo(() => {
        if (!transactions) return [];

        const groups = transactions.reduce((acc, txn) => {
            // ✅ ADDED LOG: This will show us the exact timestamp value being processed.
            console.log("Processing timestamp:", txn.timestamp);
            
            const transactionDate = new Date(txn.timestamp);

            if (!isValid(transactionDate)) {
                console.warn('Skipping transaction with invalid timestamp:', txn);
                return acc;
            }

            const dateKey = startOfDay(transactionDate).toISOString();
            if (!acc[dateKey]) {
                acc[dateKey] = { date: transactionDate, transactions: [], total: 0 };
            }
            acc[dateKey].transactions.push(txn);
            acc[dateKey].total += txn.amount;
            return acc;
        }, {});
        return Object.values(groups).sort((a, b) => b.date - a.date);
    }, [transactions]);

    return (
        <Container maxWidth="sm" sx={{ pt: 0, pb: 4 }}>
            <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
                <MuiLink underline="hover" color="inherit" href="#" onClick={onGoHome} sx={{cursor: 'pointer'}}>Home</MuiLink>
                <MuiLink underline="hover" color="inherit" href="#" onClick={onBack} sx={{cursor: 'pointer'}}>My Events</MuiLink>
                <Typography color="text.primary">Details</Typography>
            </Breadcrumbs>
            
            <Typography variant="h1" component="h1">
                {eventName}
            </Typography>

            <Box sx={{ p: 2, backgroundColor: 'grey.100', my: '20px', borderRadius: 2 }}>
                <Box sx={{ display: 'flex' }}>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                        <Typography variant="h3" component="p" sx={{ fontWeight: 'bold', fontSize: '4rem', lineHeight: 1.1 }}>
                            ${grandTotal.toFixed(2)}
                        </Typography>
                        <Typography variant="h6" component="p" color="text.secondary">Total Sales</Typography>
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                        <Typography variant="h3" component="p" color="primary" sx={{ fontWeight: 'bold', fontSize: '4rem', lineHeight: 1.1 }}>
                            ${amountDonated.toFixed(2)}
                        </Typography>
                        <Typography variant="h6" component="p" color="text.secondary">Donation Amount</Typography>
                    </Box>
                </Box>
            </Box>

            {amountDonated > 0 && (
                <Button variant="contained" fullWidth sx={{ mb: 4 }} onClick={onViewPayouts}>
                    View Payouts
                </Button>
            )}
            
            <Box>
                <Typography variant="h2" component="h2" sx={{ mb: 2 }}>
                    Transaction History
                </Typography>
                {groupedTransactions.length > 0 ? groupedTransactions.map((group) => (
                    <Box key={group.date.toISOString()} sx={{ mb: 3 }}>
                        <List disablePadding>
                            <ListItem sx={{ display: 'flex', justifyContent: 'space-between', py: 2 }}>
                                <Typography sx={{ fontWeight: 'bold' }}>
                                    {formatDateSafe(group.date, 'EEE, MMM d, yyyy')}
                                </Typography>
                                <Typography sx={{ fontWeight: 'bold' }}>
                                    ${group.total.toFixed(2)}
                                </Typography>
                            </ListItem>
                            <Divider />

                            {group.transactions.map((txn, index, arr) => (
                                <React.Fragment key={txn.id}>
                                    <ListItem sx={{ display: 'flex', justifyContent: 'space-between', py: 1.5 }}>
                                        <Typography color="text.secondary">
                                            {formatDateSafe(txn.timestamp, "MMM d, yyyy 'at' h:mm a")}
                                        </Typography>
                                        <Typography sx={{ fontWeight: 'bold' }}>
                                            ${txn.amount.toFixed(2)}
                                        </Typography>
                                    </ListItem>
                                    {index < arr.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                    </Box>
                )) : (
                    <Paper variant="outlined">
                        <List>
                            <ListItem>
                                <ListItemText secondary="No transactions have been recorded for this event yet." />
                            </ListItem>
                        </List>
                    </Paper>
                )}
            </Box>
        </Container>
    );
};

