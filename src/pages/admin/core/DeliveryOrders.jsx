import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  TextField,
  Stack,
  Divider,
  Dialog,
  DialogContent,
  AppBar,
  Toolbar,
  Link,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Button,
  Snackbar,
  Alert,
} from '@mui/material';
import { Icon } from '@iconify/react';

// Iconify wrapper for consistent sizing
const Iconify = ({ icon, width = 20, sx, ...other }) => (
  <Box component={Icon} icon={icon} sx={{ width, height: width, flexShrink: 0, ...sx }} {...other} />
);
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ORDERS_API_URL, SHIPDAY_API_URL } from '@/constants/admin/adminConstants';

// Heal orders API call
const healOrdersApi = async (orderIds) => {
  console.log('[Heal] Sending request to:', ORDERS_API_URL);
  console.log('[Heal] Order IDs:', orderIds);

  const response = await fetch(ORDERS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'heal', orderIds }),
  });

  console.log('[Heal] Response status:', response.status);
  const data = await response.json();
  console.log('[Heal] Response data:', data);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to heal orders');
  }
  return data;
};

// Get delivery estimates from Shipday
const getEstimatesApi = async (shipdayOrderId) => {
  console.log('[Estimate] Fetching estimates for:', shipdayOrderId);

  const response = await fetch(SHIPDAY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'estimate', shipdayOrderId }),
  });

  const data = await response.json();
  console.log('[Estimate] Response:', data);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to get estimates');
  }
  return data;
};

// Dispatch order via Shipday
const dispatchOrderApi = async (shipdayOrderId, carrierId) => {
  console.log('[Dispatch] Assigning carrier:', carrierId, 'to order:', shipdayOrderId);

  const response = await fetch(SHIPDAY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'dispatch', shipdayOrderId, carrierId }),
  });

  const data = await response.json();
  console.log('[Dispatch] Response:', data);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to dispatch order');
  }
  return data;
};

const fetchOrders = async (date) => {
  const url = date ? `${ORDERS_API_URL}?date=${date}` : ORDERS_API_URL;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch orders');
  const data = await response.json();
  return data.orders || [];
};

const StatusChip = ({ status }) => {
  const color = {
    DISPATCHED: 'success',
    SQUARE_ONLY: 'warning',
    FAILED: 'error',
  }[status] || 'default';

  return <Chip label={status} color={color} size="small" />;
};

const formatCurrency = (amount) => {
  if (amount == null) return '—';
  return `$${parseFloat(amount).toFixed(2)}`;
};

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function DeliveryOrders() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deliveryType, setDeliveryType] = useState('all'); // 'all', 'local', 'shipping'
  const [selectedLocations, setSelectedLocations] = useState(['all']);
  const [locationSelectOpen, setLocationSelectOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [dispatchOrder, setDispatchOrder] = useState(null);
  const [estimates, setEstimates] = useState([]);
  const [estimatesLoading, setEstimatesLoading] = useState(false);

  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'delivery-orders', selectedDate],
    queryFn: () => fetchOrders(selectedDate),
    staleTime: 30000,
  });

  // Play notification sound/speech
  const playNotificationSound = useCallback((deliveryType) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // "Darling hold my HAND" melody: G4 - A4 - C5 - D5 - E5 (held)
      // Tempo: 123 BPM, eighth notes (~0.244s each)
      const eighthNote = 60 / 123 / 2; // ~0.244s
      const notes = [
        { freq: 392.00, time: 0, duration: eighthNote },                    // G4 - "Dar-"
        { freq: 440.00, time: eighthNote, duration: eighthNote },           // A4 - "-ling"
        { freq: 523.25, time: eighthNote * 2, duration: eighthNote },       // C5 - "hold"
        { freq: 587.33, time: eighthNote * 3, duration: eighthNote },       // D5 - "my"
        { freq: 659.25, time: eighthNote * 4, duration: eighthNote * 4 },   // E5 - "HAND" (held)
      ];

      notes.forEach(({ freq, time, duration }) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sine';

        const startTime = audioContext.currentTime + time;
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      });

      // Speak the message after the melody finishes (~1.5s)
      setTimeout(() => {
        let message;
        if (deliveryType === 'pickup') {
          message = 'New order for pickup';
        } else if (deliveryType === 'local') {
          message = 'New order for local delivery';
        } else {
          message = 'New order to be shipped';
        }
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
      }, 1500);

    } catch (error) {
      console.log('[Notification] Sound failed:', error);
    }
  }, []);

  // Heal orders mutation
  const healMutation = useMutation({
    mutationFn: healOrdersApi,
    onSuccess: (data) => {
      setSnackbar({
        open: true,
        message: `Healed ${data.healed} order(s)${data.failed > 0 ? `, ${data.failed} failed` : ''}`,
        severity: data.failed > 0 ? 'warning' : 'success',
      });
      refetch(); // Refresh the orders list
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: `Failed to heal orders: ${error.message}`,
        severity: 'error',
      });
    },
  });

  const handleHealAll = useCallback(() => {
    const orderIds = orders.map(o => o.orderId).filter(Boolean);
    if (orderIds.length === 0) {
      setSnackbar({ open: true, message: 'No orders to heal', severity: 'info' });
      return;
    }
    healMutation.mutate(orderIds);
  }, [orders, healMutation]);

  const handleHealOrder = useCallback((orderId) => {
    healMutation.mutate([orderId]);
  }, [healMutation]);

  // Dispatch mutation
  const dispatchMutation = useMutation({
    mutationFn: ({ shipdayOrderId, carrierId }) => dispatchOrderApi(shipdayOrderId, carrierId),
    onSuccess: (data) => {
      setSnackbar({
        open: true,
        message: 'Order dispatched successfully!',
        severity: 'success',
      });
      setDispatchDialogOpen(false);
      setDispatchOrder(null);
      setEstimates([]);
      refetch();
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: `Failed to dispatch: ${error.message}`,
        severity: 'error',
      });
    },
  });

  const handleDispatchClick = useCallback(async (order) => {
    if (!order.shipdayOrderId) {
      setSnackbar({
        open: true,
        message: 'No Shipday order ID - order may not have been sent to Shipday',
        severity: 'warning',
      });
      return;
    }

    setDispatchOrder(order);
    setDispatchDialogOpen(true);
    setEstimatesLoading(true);
    setEstimates([]);

    try {
      const result = await getEstimatesApi(order.shipdayOrderId);
      setEstimates(result.estimates || []);
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to get estimates: ${error.message}`,
        severity: 'error',
      });
    } finally {
      setEstimatesLoading(false);
    }
  }, []);

  const handleSelectCarrier = useCallback((carrierId) => {
    if (dispatchOrder?.shipdayOrderId && carrierId) {
      dispatchMutation.mutate({
        shipdayOrderId: dispatchOrder.shipdayOrderId,
        carrierId,
      });
    }
  }, [dispatchOrder, dispatchMutation]);

  // Helper to get location from order - tries multiple field names
  const getOrderLocation = useCallback((order) => {
    return order.locationName || order.location || order['Location Name'] || order.fulfillmentLocation || '';
  }, []);

  // Extract unique locations from actual orders data
  const locations = useMemo(() => {
    const uniqueLocations = new Set();
    orders.forEach(order => {
      const loc = getOrderLocation(order);
      if (loc) uniqueLocations.add(loc);
    });
    return Array.from(uniqueLocations).sort();
  }, [orders, getOrderLocation]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleOrderClick = useCallback((order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailOpen(false);
    setSelectedOrder(null);
  }, []);

  const handleLocationChange = useCallback((event) => {
    const value = event.target.value;
    // Handle "all" selection logic
    if (value.includes('all') && !selectedLocations.includes('all')) {
      setSelectedLocations(['all']);
    } else if (selectedLocations.includes('all') && value.length > 1) {
      setSelectedLocations(value.filter(v => v !== 'all'));
    } else if (value.length === 0) {
      setSelectedLocations(['all']);
    } else {
      setSelectedLocations(value);
    }
  }, [selectedLocations]);

  // Separate success orders from error/needs-healing orders
  const { successOrders, errorOrders, needsHealingOrders } = useMemo(() => {
    const success = [];
    const errors = [];
    const needsHealing = [];

    orders.forEach(order => {
      if (order.recordType === 'error') {
        errors.push(order);
      } else if (order.recordType === 'success') {
        // Check if success order needs healing (missing important data)
        const needsHeal = !order.locationName ||
          order.locationName === 'Unknown' ||
          !order.deliveryType ||
          !order.lineItems?.length;
        if (needsHeal) {
          needsHealing.push(order);
        }
        success.push(order);
      }
    });

    return { successOrders: success, errorOrders: errors, needsHealingOrders: needsHealing };
  }, [orders]);

  // Filter orders based on delivery type and location
  const filteredOrders = useMemo(() => {
    return successOrders.filter(order => {
      // Filter by delivery type - use the deliveryType field from backend
      // Fallback to detecting from shippingMethod for older orders
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

      // Filter by location - use the same helper function
      if (!selectedLocations.includes('all')) {
        const orderLocation = getOrderLocation(order);
        if (!selectedLocations.includes(orderLocation)) return false;
      }

      return true;
    });
  }, [successOrders, deliveryType, selectedLocations, getOrderLocation]);

  const totals = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        // Calculate subtotal from line items if not provided
        const itemsSubtotal = order.subtotalPrice ??
          order.lineItems?.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0) ?? 0;

        return {
          itemsSubtotal: acc.itemsSubtotal + itemsSubtotal,
          shipping: acc.shipping + (order.shippingPrice || 0),
          shopifyFees: acc.shopifyFees + (order.transactionFee || 0),
          shipdayFees: acc.shipdayFees + (order.shipdayFee || 0),
          gross: acc.gross + (order.grossAmount || order.totalPrice || 0),
          net: acc.net + (order.netAmount || 0),
          count: acc.count + 1,
        };
      },
      { itemsSubtotal: 0, shipping: 0, shopifyFees: 0, shipdayFees: 0, gross: 0, net: 0, count: 0 }
    );
  }, [filteredOrders]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Header & Filters */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        pb: 2,
        mb: 2,
        borderBottom: 1,
        borderColor: 'divider',
        flexShrink: 0,
        bgcolor: 'background.paper',
        mx: -3,
        mt: -3,
        px: 3,
        pt: 2,
      }}>
        {/* Row 1: Title and Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Iconify icon="solar:shop-bold" width={28} sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight="bold">
              In-store Orders
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={() => playNotificationSound('local')}
              size="small"
              title="Test local delivery notification"
            >
              <Iconify icon="solar:volume-loud-bold" />
            </IconButton>
            <Button
              size="small"
              variant="outlined"
              startIcon={healMutation.isPending ? <CircularProgress size={16} /> : <Iconify icon="solar:health-bold" />}
              onClick={handleHealAll}
              disabled={healMutation.isPending || orders.length === 0}
            >
              {healMutation.isPending ? 'Healing...' : 'Heal All'}
            </Button>
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

          {/* Date Picker */}
          <TextField
            type="date"
            size="small"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            sx={{ width: 160 }}
          />

          {/* Location Selector */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="location-select-label">Location</InputLabel>
            <Select
              labelId="location-select-label"
              multiple
              open={locationSelectOpen}
              onOpen={() => setLocationSelectOpen(true)}
              onClose={() => setLocationSelectOpen(false)}
              value={selectedLocations}
              onChange={handleLocationChange}
              input={<OutlinedInput label="Location" />}
              renderValue={(selected) => {
                if (selected.includes('all')) return 'All Locations';
                if (selected.length === 1) return selected[0];
                return `${selected.length} Locations`;
              }}
              MenuProps={{
                disablePortal: true,
                disableScrollLock: true,
                PaperProps: {
                  style: { maxHeight: 300 },
                  onClick: (e) => e.stopPropagation(),
                },
              }}
            >
              <MenuItem value="all">
                <Checkbox checked={selectedLocations.includes('all')} />
                <ListItemText primary="All Locations" />
              </MenuItem>
              {locations.map((loc) => (
                <MenuItem key={loc} value={loc}>
                  <Checkbox checked={selectedLocations.includes(loc)} />
                  <ListItemText primary={loc} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: 2 }}>

      {/* Needs Attention Section */}
      {(errorOrders.length > 0 || needsHealingOrders.length > 0) && (
        <Card sx={{ mb: 3, border: '2px solid', borderColor: 'warning.main', bgcolor: 'warning.lighter' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:danger-triangle-bold" width={24} sx={{ color: 'warning.main' }} />
                <Typography variant="h6" fontWeight="bold">
                  Needs Attention ({errorOrders.length + needsHealingOrders.length})
                </Typography>
              </Box>
              <Button
                size="small"
                variant="contained"
                color="warning"
                startIcon={healMutation.isPending ? <CircularProgress size={16} /> : <Iconify icon="solar:health-bold" />}
                onClick={() => {
                  const idsToHeal = [
                    ...errorOrders.map(o => o.orderId),
                    ...needsHealingOrders.map(o => o.orderId),
                  ].filter(Boolean);
                  if (idsToHeal.length > 0) healMutation.mutate(idsToHeal);
                }}
                disabled={healMutation.isPending}
              >
                Heal All ({errorOrders.length + needsHealingOrders.length})
              </Button>
            </Box>

            {/* Error Orders */}
            {errorOrders.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="error.main" gutterBottom>
                  Failed Orders ({errorOrders.length})
                </Typography>
                <Stack spacing={1}>
                  {errorOrders.map((order) => (
                    <Box
                      key={`${order.pk}-${order.sk}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        bgcolor: 'error.lighter',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'error.light',
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          #{order.orderNumber || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="error.main">
                          {order.error || 'Unknown error'}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleHealOrder(order.orderId)}
                        disabled={healMutation.isPending}
                      >
                        Heal
                      </Button>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Needs Healing Orders */}
            {needsHealingOrders.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="warning.dark" gutterBottom>
                  Missing Data ({needsHealingOrders.length})
                </Typography>
                <Stack spacing={1}>
                  {needsHealingOrders.map((order) => (
                    <Box
                      key={order.orderId}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'warning.light',
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          #{order.orderNumber} - {order.customerName || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {!order.locationName || order.locationName === 'Unknown' ? 'Missing location' : ''}
                          {!order.deliveryType ? ' Missing delivery type' : ''}
                          {!order.lineItems?.length ? ' Missing line items' : ''}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        onClick={() => handleHealOrder(order.orderId)}
                        disabled={healMutation.isPending}
                      >
                        Heal
                      </Button>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Typography color="error" sx={{ textAlign: 'center', py: 4 }}>
          Failed to load orders. Check console for details.
        </Typography>
      ) : filteredOrders.length === 0 ? (
        <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
          No {deliveryType === 'pickup' ? 'pickup' : deliveryType === 'local' ? 'local delivery' : deliveryType === 'shipping' ? 'shipping' : ''} orders for {selectedDate}
          {!selectedLocations.includes('all') && ` at ${selectedLocations.join(', ')}`}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {filteredOrders.map((order) => (
            <Card
              key={order.orderId}
              sx={{
                cursor: 'pointer',
                '&:hover': { bgcolor: 'grey.50' },
              }}
              onClick={() => handleOrderClick(order)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="h6" fontWeight="bold">
                        #{order.orderNumber}
                      </Typography>
                      <StatusChip status={order.status} />
                    </Box>
                    <Typography variant="body1">{order.customerName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {order.shippingAddress?.address1}, {order.shippingAddress?.city}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" fontWeight="bold" color="success.main">
                        {formatCurrency(order.netAmount || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatCurrency(order.shippingPrice || 0)} shipping
                      </Typography>
                      <Typography variant="body2" color="error.main">
                        -{formatCurrency((order.transactionFee || 0) + (order.shipdayFee || 0))} fees
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDispatchClick(order);
                      }}
                      sx={{ minWidth: 80 }}
                    >
                      Dispatch
                    </Button>
                  </Box>
                </Box>

              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      </Box>

      {/* Order Detail Dialog */}
      <Dialog fullScreen open={detailOpen} onClose={handleDetailClose}>
        <AppBar position="sticky" sx={{ bgcolor: 'grey.200', color: 'black' }} elevation={0}>
          <Toolbar sx={{ minHeight: 48 }}>
            <IconButton edge="start" onClick={handleDetailClose}>
              <Iconify icon="solar:close-circle-bold" />
            </IconButton>
            <Typography variant="h6" sx={{ ml: 2, flexGrow: 1 }}>
              Order #{selectedOrder?.orderNumber}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={healMutation.isPending ? <CircularProgress size={16} /> : <Iconify icon="solar:health-bold" />}
              onClick={() => selectedOrder && handleHealOrder(selectedOrder.orderId)}
              disabled={healMutation.isPending}
            >
              {healMutation.isPending ? 'Healing...' : 'Heal'}
            </Button>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p: 3 }}>
          {selectedOrder && (
            <Box sx={{ maxWidth: 600, mx: 'auto' }}>
              {/* Status */}
              <Box sx={{ mb: 3, textAlign: 'center' }}>
                <StatusChip status={selectedOrder.status} />
              </Box>

              {/* Customer Info */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Customer
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {selectedOrder.customerName}
                  </Typography>
                  <Typography variant="body2">{selectedOrder.customerEmail}</Typography>
                  <Typography variant="body2">{selectedOrder.customerPhone}</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Delivery Address
                  </Typography>
                  <Typography variant="body2">
                    {selectedOrder.shippingAddress?.address1}
                    {selectedOrder.shippingAddress?.address2 && `, ${selectedOrder.shippingAddress.address2}`}
                  </Typography>
                  <Typography variant="body2">
                    {selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.province_code}{' '}
                    {selectedOrder.shippingAddress?.zip}
                  </Typography>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Items
                  </Typography>
                  {selectedOrder.lineItems?.map((item, idx) => (
                    <Box key={idx} sx={{ py: 1, borderBottom: idx < selectedOrder.lineItems.length - 1 ? '1px solid #eee' : 'none' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">
                          {item.quantity}x {item.name}
                        </Typography>
                        <Typography variant="body2">{formatCurrency(item.price)}</Typography>
                      </Box>
                      {item.variant && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {item.variant}
                        </Typography>
                      )}
                      {item.properties?.length > 0 && (
                        <Box sx={{ mt: 0.5, pl: 1, borderLeft: '2px solid', borderColor: 'grey.300' }}>
                          {item.properties.map((prop, pIdx) => (
                            <Typography key={pIdx} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {prop.name}: {prop.value}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  ))}
                </CardContent>
              </Card>

              {/* Financials */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Revenue Breakdown
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Items Subtotal</Typography>
                    <Typography variant="body2">
                      {formatCurrency(selectedOrder.subtotalPrice ?? selectedOrder.lineItems?.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0))}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      {selectedOrder.deliveryType === 'local' ? 'Delivery Fee' : 'Shipping Charges'}
                    </Typography>
                    <Typography variant="body2">{formatCurrency(selectedOrder.shippingPrice || 0)}</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" fontWeight="bold">Gross Amount</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatCurrency(selectedOrder.grossAmount || selectedOrder.totalPrice)}
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                    Fees
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="error.main">Shopify Fee</Typography>
                    <Typography variant="body2" color="error.main">
                      -{formatCurrency(selectedOrder.transactionFee || 0)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="error.main">Shipday Fee</Typography>
                    <Typography variant="body2" color="error.main">
                      -{formatCurrency(selectedOrder.shipdayFee || 0)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="error.main" fontWeight="bold">Total Fees</Typography>
                    <Typography variant="body2" color="error.main" fontWeight="bold">
                      -{formatCurrency((selectedOrder.transactionFee || 0) + (selectedOrder.shipdayFee || 0))}
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body1" fontWeight="bold">Net Amount</Typography>
                    <Typography variant="body1" fontWeight="bold" color="success.main">
                      {formatCurrency(selectedOrder.netAmount)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              {/* System IDs */}
              <Card>
                <CardContent>
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
                    {selectedOrder.shippingMethod && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Shipping Method</Typography>
                        <Typography variant="body2">{selectedOrder.shippingMethod}</Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Location</Typography>
                      <Typography variant="body2">{selectedOrder.locationName}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Created</Typography>
                      <Typography variant="body2">
                        {new Date(selectedOrder.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      System IDs
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Shopify Order ID</Typography>
                      <Typography variant="body2" fontFamily="monospace">
                        {selectedOrder.orderId}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Square Order ID</Typography>
                      <Typography variant="body2" fontFamily="monospace">
                        {selectedOrder.squareOrderId || '—'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Shipday Order ID</Typography>
                      <Typography variant="body2" fontFamily="monospace">
                        {selectedOrder.shipdayOrderId || '—'}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Dispatch Dialog */}
      <Dialog
        open={dispatchDialogOpen}
        onClose={() => {
          setDispatchDialogOpen(false);
          setDispatchOrder(null);
          setEstimates([]);
        }}
        maxWidth="sm"
        fullWidth
      >
        <AppBar position="sticky" sx={{ bgcolor: 'success.main' }} elevation={0}>
          <Toolbar sx={{ minHeight: 48 }}>
            <Iconify icon="solar:delivery-bold" width={24} sx={{ mr: 2 }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Dispatch Order #{dispatchOrder?.orderNumber}
            </Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => {
                setDispatchDialogOpen(false);
                setDispatchOrder(null);
                setEstimates([]);
              }}
            >
              <Iconify icon="solar:close-circle-bold" />
            </IconButton>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p: 3 }}>
          {estimatesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Getting delivery quotes...</Typography>
            </Box>
          ) : estimates.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Iconify icon="solar:sad-circle-bold" width={48} sx={{ color: 'text.secondary', mb: 2 }} />
              <Typography color="text.secondary">
                No delivery providers available for this order.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              <Typography variant="subtitle2" color="text.secondary">
                Select a delivery provider:
              </Typography>
              {estimates.map((estimate) => (
                <Card
                  key={estimate.id}
                  sx={{
                    cursor: estimate.error ? 'not-allowed' : 'pointer',
                    opacity: estimate.error ? 0.5 : 1,
                    '&:hover': estimate.error ? {} : { bgcolor: 'success.lighter', borderColor: 'success.main' },
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                  onClick={() => !estimate.error && handleSelectCarrier(estimate.id)}
                >
                  <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        {estimate.name}
                      </Typography>
                      {estimate.error ? (
                        <Typography variant="body2" color="error.main">
                          {estimate.errorMessage || 'Not available'}
                        </Typography>
                      ) : (
                        <>
                          <Typography variant="body2" color="text.secondary">
                            Pickup: {estimate.pickupDuration ? `${estimate.pickupDuration} min` : 'ASAP'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Delivery: {estimate.deliveryDuration ? `${estimate.deliveryDuration} min` : 'Est. time TBD'}
                          </Typography>
                        </>
                      )}
                    </Box>
                    {!estimate.error && (
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="h5" fontWeight="bold" color="success.main">
                          {formatCurrency(estimate.fee)}
                        </Typography>
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          disabled={dispatchMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCarrier(estimate.id);
                          }}
                        >
                          {dispatchMutation.isPending ? <CircularProgress size={16} /> : 'Select'}
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
