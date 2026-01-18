import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Chip,
  Divider,
  CircularProgress,
  IconButton,
  Drawer,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { ORDERS_API_URL, authFetch } from '@/constants/admin/adminConstants';

// Iconify wrapper for consistent sizing
const Iconify = ({ icon, width = 20, sx, ...other }) => (
  <Icon icon={icon} width={width} style={sx} {...other} />
);

// Helper to generate date range array
const getDateRange = (startDate, endDate) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export default function OrdersReport({ onGoBack }) {
  // State for filters
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [deliveryType, setDeliveryType] = useState('all');
  const [selectedLocations, setSelectedLocations] = useState(['all']);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Fetch orders for date range
  const fetchOrdersForRange = async (start, end) => {
    const dates = getDateRange(start, end);
    const allOrders = [];

    // Fetch each date (could be optimized with API support for date ranges)
    for (const date of dates) {
      try {
        const url = `${ORDERS_API_URL}?date=${date}`;
        const response = await authFetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.orders) {
            allOrders.push(...data.orders);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch orders for ${date}:`, error);
      }
    }

    // Remove duplicates by orderId
    const uniqueOrders = Array.from(
      new Map(allOrders.map(order => [order.orderId, order])).values()
    );

    return uniqueOrders;
  };

  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders-report', startDate, endDate],
    queryFn: () => fetchOrdersForRange(startDate, endDate),
    staleTime: 30000,
  });

  // Helper function to get location from order
  const getOrderLocation = useCallback((order) => {
    if (order.locationName && order.locationName !== 'Unknown') return order.locationName;
    return 'Unknown';
  }, []);

  // Get unique locations from orders
  const availableLocations = useMemo(() => {
    const locations = new Set();
    orders.forEach(order => {
      const loc = getOrderLocation(order);
      if (loc) locations.add(loc);
    });
    return Array.from(locations).sort();
  }, [orders, getOrderLocation]);

  // Separate success orders from error orders
  const { successOrders } = useMemo(() => {
    const success = orders.filter(order => order.recordType === 'success');
    return { successOrders: success };
  }, [orders]);

  // Filter orders based on delivery type and location
  const filteredOrders = useMemo(() => {
    return successOrders.filter(order => {
      // Filter by delivery type
      let orderDeliveryType = order.deliveryType;
      if (!orderDeliveryType) {
        const method = order.shippingMethod?.toLowerCase() || '';
        if (method.includes('pickup') || method.includes('pick up')) {
          orderDeliveryType = 'pickup';
        } else if (method.includes('local') || method.includes('delivery')) {
          orderDeliveryType = 'local';
        } else {
          orderDeliveryType = 'shipping';
        }
      }

      if (deliveryType === 'pickup' && orderDeliveryType !== 'pickup') return false;
      if (deliveryType === 'local' && orderDeliveryType !== 'local') return false;
      if (deliveryType === 'shipping' && orderDeliveryType !== 'shipping') return false;

      // Filter by location
      if (!selectedLocations.includes('all')) {
        const orderLocation = getOrderLocation(order);
        if (!selectedLocations.includes(orderLocation)) return false;
      }

      return true;
    });
  }, [successOrders, deliveryType, selectedLocations, getOrderLocation]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        acc.gross += order.grossAmount || order.totalPrice || 0;
        acc.fees += order.transactionFee || 0;
        acc.net += order.netAmount || (order.totalPrice - (order.transactionFee || 0)) || 0;
        acc.shipping += order.shippingPrice || 0;
        return acc;
      },
      { gross: 0, fees: 0, net: 0, shipping: 0 }
    );
  }, [filteredOrders]);

  const handleRefresh = () => {
    refetch();
  };

  const handleLocationChange = (event) => {
    const value = event.target.value;
    const wasAllSelected = selectedLocations.includes('all');
    const nowHasAll = value.includes('all');

    // If "All" was just clicked (wasn't selected before, now is)
    if (!wasAllSelected && nowHasAll) {
      setSelectedLocations(['all']);
    }
    // If a specific location was clicked while "All" was selected
    else if (wasAllSelected && value.length > 1) {
      setSelectedLocations(value.filter(v => v !== 'all'));
    }
    // If nothing selected, default to all
    else if (value.length === 0) {
      setSelectedLocations(['all']);
    }
    // Otherwise just use the value (specific locations)
    else {
      setSelectedLocations(value.filter(v => v !== 'all'));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        bgcolor: 'background.paper',
      }}>
        {/* Row 1: Title and Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={onGoBack} size="small">
              <Iconify icon="solar:arrow-left-bold" />
            </IconButton>
            <Iconify icon="solar:bag-check-bold" width={28} sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight="bold">
              Shopify Orders
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={handleRefresh} disabled={isLoading} size="small">
              <Iconify icon="solar:refresh-bold" />
            </IconButton>
          </Box>
        </Box>

        {/* Row 2: Filters */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {/* Delivery Type Toggle */}
          <ToggleButtonGroup
            value={deliveryType}
            exclusive
            onChange={(e, val) => val && setDeliveryType(val)}
            size="small"
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="pickup">Pickup</ToggleButton>
            <ToggleButton value="local">Local Delivery</ToggleButton>
            <ToggleButton value="shipping">Shipping</ToggleButton>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          {/* Location Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Location</InputLabel>
            <Select
              multiple
              value={selectedLocations}
              onChange={handleLocationChange}
              input={<OutlinedInput label="Location" />}
              renderValue={(selected) =>
                selected.includes('all') ? 'All Locations' : selected.join(', ')
              }
              MenuProps={{
                PaperProps: { style: { maxHeight: 300 } },
                disablePortal: true,
              }}
            >
              <MenuItem value="all">
                <Checkbox checked={selectedLocations.includes('all')} />
                <ListItemText primary="All Locations" />
              </MenuItem>
              {availableLocations.map((location) => (
                <MenuItem key={location} value={location}>
                  <Checkbox checked={selectedLocations.includes(location)} />
                  <ListItemText primary={location} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider orientation="vertical" flexItem />

          {/* Date Range */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              type="date"
              label="From"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              size="small"
              sx={{ width: 150 }}
              InputLabelProps={{ shrink: true }}
            />
            <Typography variant="body2" color="text.secondary">to</Typography>
            <TextField
              type="date"
              label="To"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              size="small"
              sx={{ width: 150 }}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Totals */}
          <Box sx={{ display: 'flex', gap: 2, ml: 'auto' }}>
            <Typography variant="body2" color="text.secondary">
              Orders: <strong>{filteredOrders.length}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gross: <strong>${totals.gross.toFixed(2)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Fees: <strong>${totals.fees.toFixed(2)}</strong>
            </Typography>
            <Typography variant="body2" color="success.main">
              Net: <strong>${totals.net.toFixed(2)}</strong>
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Orders List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : isError ? (
          <Typography color="error" sx={{ textAlign: 'center', py: 4 }}>
            Failed to load orders. Check console for details.
          </Typography>
        ) : filteredOrders.length === 0 ? (
          <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            No {deliveryType === 'pickup' ? 'pickup' : deliveryType === 'local' ? 'local delivery' : deliveryType === 'shipping' ? 'shipping' : ''} orders found
            {startDate === endDate ? ` for ${startDate}` : ` from ${startDate} to ${endDate}`}
          </Typography>
        ) : (
          <Stack spacing={2}>
            {filteredOrders.map((order) => (
              <Card
                key={order.orderId}
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
                }}
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          #{order.orderNumber || order.orderName}
                        </Typography>
                        <Chip
                          label={order.deliveryType === 'pickup' ? 'Pickup' : order.deliveryType === 'local' ? 'Local' : 'Shipping'}
                          size="small"
                          color={order.deliveryType === 'pickup' ? 'success' : order.deliveryType === 'local' ? 'info' : 'default'}
                          sx={{ height: 20 }}
                        />
                        <Chip
                          label={getOrderLocation(order)}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20 }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {order.customerName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.date} {order.createdAt && new Date(order.createdAt).toLocaleTimeString()}
                      </Typography>
                    </Box>

                    {/* Right side - Financials */}
                    <Box sx={{ textAlign: 'right', minWidth: 140 }}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        ${(order.subtotalPrice || 0).toFixed(2)} items
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        +${(order.shippingPrice || 0).toFixed(2)} shipping
                      </Typography>
                      <Typography variant="caption" color="error" display="block">
                        -${(order.transactionFee || 0).toFixed(2)} Shopify fees
                      </Typography>
                      <Typography variant="body2" color="success.main" fontWeight="bold">
                        ${(order.netAmount || (order.totalPrice - (order.transactionFee || 0))).toFixed(2)} net payout
                      </Typography>
                      {order.shipdayDeliveryFee > 0 && (
                        <Typography variant="caption" color="warning.main" display="block">
                          -${(order.shipdayDeliveryFee || 0).toFixed(2)} delivery
                        </Typography>
                      )}
                      {order.shipdayServiceFee > 0 && (
                        <Typography variant="caption" color="warning.main" display="block">
                          -${(order.shipdayServiceFee || 0).toFixed(2)} Shipday fee
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      {/* Order Detail Drawer */}
      <Drawer
        anchor="right"
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 400 } } }}
      >
        {selectedOrder && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Order #{selectedOrder.orderNumber}</Typography>
              <IconButton onClick={() => setSelectedOrder(null)}>
                <Iconify icon="solar:close-circle-bold" />
              </IconButton>
            </Box>

            <Stack spacing={3}>
              {/* Customer Info */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Customer
                </Typography>
                <Typography variant="body1" fontWeight="medium">{selectedOrder.customerName}</Typography>
                {selectedOrder.customerEmail && (
                  <Typography variant="body2" color="text.secondary">{selectedOrder.customerEmail}</Typography>
                )}
                {selectedOrder.customerPhone && (
                  <Typography variant="body2" color="text.secondary">{selectedOrder.customerPhone}</Typography>
                )}
              </Box>

              <Divider />

              {/* Order Details */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Order Details
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Order Type</Typography>
                    <Chip
                      label={selectedOrder.deliveryType === 'pickup' ? 'Pickup' : selectedOrder.deliveryType === 'local' ? 'Local Delivery' : 'Shipping'}
                      size="small"
                      color={selectedOrder.deliveryType === 'pickup' ? 'success' : selectedOrder.deliveryType === 'local' ? 'info' : 'default'}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Location</Typography>
                    <Typography variant="body2">{getOrderLocation(selectedOrder)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Date</Typography>
                    <Typography variant="body2">{selectedOrder.date}</Typography>
                  </Box>
                  {selectedOrder.shippingMethod && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Shipping Method</Typography>
                      <Typography variant="body2">{selectedOrder.shippingMethod}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              <Divider />

              {/* Line Items */}
              {selectedOrder.lineItems && selectedOrder.lineItems.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Items
                  </Typography>
                  <Stack spacing={1}>
                    {selectedOrder.lineItems.map((item, idx) => (
                      <Box key={idx}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">
                            {item.quantity}x {item.name}
                          </Typography>
                          <Typography variant="body2">${parseFloat(item.price).toFixed(2)}</Typography>
                        </Box>
                        {item.variant && (
                          <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                            {item.variant}
                          </Typography>
                        )}
                        {item.properties && item.properties.length > 0 && (
                          <Box sx={{ pl: 2 }}>
                            {item.properties.map((prop, pIdx) => (
                              <Typography key={pIdx} variant="caption" color="text.secondary" display="block">
                                {prop.name}: {prop.value}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              <Divider />

              {/* Address */}
              {selectedOrder.shippingAddress && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {selectedOrder.deliveryType === 'shipping' ? 'Shipping' : 'Delivery'} Address
                  </Typography>
                  <Typography variant="body2">
                    {selectedOrder.shippingAddress.address1}
                    {selectedOrder.shippingAddress.address2 && `, ${selectedOrder.shippingAddress.address2}`}
                  </Typography>
                  <Typography variant="body2">
                    {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.province_code} {selectedOrder.shippingAddress.zip}
                  </Typography>
                </Box>
              )}

              <Divider />

              {/* Financials */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Financials
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Subtotal</Typography>
                    <Typography variant="body2">${(selectedOrder.subtotalPrice || 0).toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Shipping</Typography>
                    <Typography variant="body2">${(selectedOrder.shippingPrice || 0).toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Gross</Typography>
                    <Typography variant="body2">${(selectedOrder.grossAmount || selectedOrder.totalPrice || 0).toFixed(2)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="error">Fees</Typography>
                    <Typography variant="body2" color="error">-${(selectedOrder.transactionFee || 0).toFixed(2)}</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body1" fontWeight="bold">Net</Typography>
                    <Typography variant="body1" fontWeight="bold" color="success.main">
                      ${(selectedOrder.netAmount || (selectedOrder.totalPrice - (selectedOrder.transactionFee || 0))).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Stack>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
