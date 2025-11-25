import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    Button,
    Card,
    CardContent,
    Link,
    Stack,
    Chip
} from '@mui/material';
import { LIST_ORDERS_URL } from '@/constants/catering/cateringConstants';
import ReceiptIcon from '@mui/icons-material/Receipt';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

export const OrdersView = ({ accountId, sendToCatering }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchOrders = async () => {
            if (!accountId) {
                setError('No account ID available. Please log in again.');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                console.log('[OrdersView] Fetching orders for accountId:', accountId);

                const response = await fetch(LIST_ORDERS_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ accountId })
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch orders: ${response.statusText}`);
                }

                const data = await response.json();
                console.log('[OrdersView] Fetched orders:', data);
                console.log('[OrdersView] Orders is array?', Array.isArray(data));
                console.log('[OrdersView] Orders length:', data?.length);
                
                // Log first item if it exists
                if (data && data.length > 0) {
                    console.log('[OrdersView] First item:', data[0]);
                    console.log('[OrdersView] First item keys:', Object.keys(data[0]));
                }
                
                // Handle empty response or non-array response
                if (!data || !Array.isArray(data) || data.length === 0) {
                    setOrders([]);
                } else {
                    // Filter out status messages and keep only valid orders with 'Order ID'
                    const validOrders = data.filter(order => 
                        order && 
                        typeof order === 'object' && 
                        order['Order ID'] &&
                        !order['Status'] // Exclude status messages like {"Status":"No Orders Returned"}
                    );
                    console.log('[OrdersView] Valid orders after filtering:', validOrders.length);
                    setOrders(validOrders);
                }
            } catch (err) {
                console.error('[OrdersView] Error fetching orders:', err);
                setError(err.message || 'Failed to load orders');
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [accountId]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4, flexDirection: 'column', gap: 2 }}>
                <CircularProgress />
                <Typography>Loading your orders...</Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Box>
                <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                <Button 
                    variant="outlined" 
                    onClick={() => sendToCatering({ type: 'GO_BACK' })}
                >
                    Back
                </Button>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h1" gutterBottom>
                My Orders
            </Typography>

            {orders.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                    <ReceiptIcon sx={{ fontSize: 80, color: 'grey.400', mb: 3 }} />
                    <Typography variant="h5" gutterBottom>
                        No Orders Yet
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
                        You haven't placed any orders yet. Browse our catering menu to get started!
                    </Typography>
                    <Button 
                        variant="contained" 
                        onClick={() => sendToCatering({ type: 'GO_BACK' })}
                        sx={{
                            backgroundColor: 'black',
                            color: 'white',
                            px: 4,
                            py: 1.5,
                            '&:hover': { backgroundColor: '#333' }
                        }}
                    >
                        Browse Menu
                    </Button>
                </Box>
            ) : (
                <>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                        You have {orders.length} {orders.length === 1 ? 'order' : 'orders'}
                    </Typography>

                    <Stack spacing={2}>
                        {orders.map((order) => (
                            <Card 
                                key={order['Order ID']} 
                                sx={{ 
                                    '&:hover': { 
                                        boxShadow: 3,
                                        cursor: 'pointer' 
                                    } 
                                }}
                            >
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Box>
                                            <Typography variant="h6" gutterBottom>
                                                Order #{order['Square Order ID']?.slice(-8) || 'N/A'}
                                            </Typography>
                                            {order['Square Invoice ID'] && (
                                                <Chip 
                                                    label="Invoice Available" 
                                                    size="small" 
                                                    color="success" 
                                                    sx={{ mt: 0.5 }}
                                                />
                                            )}
                                        </Box>
                                        <ReceiptIcon sx={{ color: 'text.secondary' }} />
                                    </Box>

                                    {/* Order Details */}
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        Order ID: {order['Order ID']}
                                    </Typography>

                                    {/* Invoice Link */}
                                    {order['Square Invoice Public URL'] && (
                                        <Box sx={{ mt: 2 }}>
                                            <Link
                                                href={order['Square Invoice Public URL']}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                sx={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                    textDecoration: 'none',
                                                    '&:hover': {
                                                        textDecoration: 'underline'
                                                    }
                                                }}
                                            >
                                                <Typography variant="body2" color="primary">
                                                    View Invoice
                                                </Typography>
                                                <OpenInNewIcon sx={{ fontSize: 16 }} />
                                            </Link>
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>

                    <Button 
                        variant="outlined" 
                        onClick={() => sendToCatering({ type: 'GO_BACK' })} 
                        sx={{ mt: 3 }}
                        fullWidth
                    >
                        Back to Menu
                    </Button>
                </>
            )}
        </Box>
    );
};
