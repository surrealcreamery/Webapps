import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, Paper, Stack, Chip, Divider,
  Accordion, AccordionSummary, AccordionDetails, Skeleton, Alert,
  InputAdornment, Link,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import StorefrontIcon from '@mui/icons-material/Storefront';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import { identifyUser } from '@/services/analytics';

const CHECKOUT_API_URL = 'https://viif6favb73jr3pm2ph6qcten40ethnp.lambda-url.us-east-1.on.aws';
const CONSUMER_ORDERS_URL = 'https://qeg2uc6ykdeexcnc64nn66ph7m0hrtep.lambda-url.us-east-1.on.aws';

function callApi(action, data = {}) {
  return fetch(CHECKOUT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  }).then(async res => {
    const json = await res.json();
    const result = typeof json.body === 'string' ? JSON.parse(json.body) : json;
    if (!res.ok || result.error) throw new Error(result.error || 'Request failed');
    return result;
  });
}

function callOrdersApi(action, data = {}) {
  return fetch(CONSUMER_ORDERS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  }).then(async res => {
    const json = await res.json();
    const result = typeof json.body === 'string' ? JSON.parse(json.body) : json;
    if (!res.ok || result.error) throw new Error(result.error || 'Request failed');
    return result;
  });
}

const formatCents = (cents) => {
  if (cents == null) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const statusColor = (status) => {
  switch (status) {
    case 'COMPLETED': case 'DELIVERED': return 'success';
    case 'CANCELLED': case 'REFUNDED': return 'error';
    case 'NEW': case 'PROCESSING': return 'info';
    case 'DISPATCHED': case 'PICKED_UP': return 'warning';
    default: return 'default';
  }
};

const SESSION_KEY = 'accountSession';

export default function AccountPage() {
  const navigate = useNavigate();
  const mainContentRef = useRef(null);

  // Auth state
  const [to, setTo] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState('');

  // Session state
  const [session, setSession] = useState(null); // { sessionToken, customerId, firstName, lastName }

  // Orders state
  const [orders, setOrders] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');

  // Restore session on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.sessionToken) {
          setSession(parsed);
        }
      }
    } catch {}
  }, []);

  // Listen for header logout event
  useEffect(() => {
    const onLogout = () => {
      setSession(null);
      setOrders(null);
      setOtpSent(false);
      setCode('');
      setTo('');
      setAuthError('');
    };
    window.addEventListener('accountLogout', onLogout);
    return () => window.removeEventListener('accountLogout', onLogout);
  }, []);

  // Fetch orders when session is set
  useEffect(() => {
    if (!session?.sessionToken) return;
    fetchOrders(session.sessionToken);
  }, [session?.sessionToken]);

  // Manage focus after authentication state changes (SC 2.4.3)
  useEffect(() => {
    if (session && mainContentRef.current) {
      mainContentRef.current.focus();
    }
  }, [session]);

  const fetchOrders = useCallback(async (token) => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const result = await callOrdersApi('getCustomerOrders', { sessionToken: token });
      setOrders(result.orders || []);
    } catch (err) {
      if (err.message?.includes('expired') || err.message?.includes('invalid')) {
        // Session expired — log out
        sessionStorage.removeItem(SESSION_KEY);
        setSession(null);
        setOrders(null);
        setAuthError('Your session has expired. Please log in again.');
      } else {
        setOrdersError(err.message || 'Failed to load orders');
      }
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const isEmail = to.includes('@');

  const handleSendOtp = async () => {
    setSending(true);
    setAuthError('');
    try {
      await callApi('sendCheckoutOtp', { to, channel: isEmail ? 'email' : 'sms' });
      setOtpSent(true);
    } catch (err) {
      setAuthError(err.message || 'Failed to send code');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    setVerifying(true);
    setAuthError('');
    try {
      const channel = isEmail ? 'email' : 'sms';
      const result = await callApi('verifyCheckoutOtp', { to, code, channel });
      if (result.success) {
        const sessionData = {
          sessionToken: result.sessionToken,
          customerId: result.customerId,
          firstName: result.customer?.firstName || '',
          lastName: result.customer?.lastName || '',
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
        setSession(sessionData);
        if (result.customerId) identifyUser(result.customerId, { firstName: sessionData.firstName, lastName: sessionData.lastName });
      } else {
        setAuthError(result.message || 'Verification failed');
      }
    } catch (err) {
      setAuthError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  // ── Login View ──
  if (!session) {
    return (
      <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 2, py: 6 }}>
        <Helmet><title>My Account | Surreal Creamery</title></Helmet>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 1, textAlign: 'center' }}>
          My Account
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
          Sign in with your email or phone to view your orders.
        </Typography>

        {authError && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{authError}</Alert>}

        {!otpSent ? (
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Email or phone number"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && to.trim()) handleSendOtp(); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {isEmail ? <EmailIcon sx={{ color: 'text.secondary' }} aria-hidden="true" /> : <PhoneIcon sx={{ color: 'text.secondary' }} aria-hidden="true" />}
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              fullWidth
              disabled={!to.trim() || sending}
              onClick={handleSendOtp}
              sx={{
                bgcolor: 'black', color: 'white', textTransform: 'none', fontWeight: 600,
                py: 1.5, fontSize: '1.6rem',
                '&:hover': { bgcolor: '#333' },
                '&.Mui-disabled': { bgcolor: '#ccc', color: '#888' },
              }}
            >
              {sending ? 'Sending...' : 'Send Code'}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary' }}>
              We sent a code to <strong>{to}</strong>
            </Typography>
            <TextField
              fullWidth
              label="Verification code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) handleVerifyOtp(); }}
              inputProps={{ inputMode: 'numeric', maxLength: 6 }}
            />
            <Button
              variant="contained"
              fullWidth
              disabled={code.length !== 6 || verifying}
              onClick={handleVerifyOtp}
              sx={{
                bgcolor: 'black', color: 'white', textTransform: 'none', fontWeight: 600,
                py: 1.5, fontSize: '1.6rem',
                '&:hover': { bgcolor: '#333' },
                '&.Mui-disabled': { bgcolor: '#ccc', color: '#888' },
              }}
            >
              {verifying ? 'Verifying...' : 'Verify'}
            </Button>
            <Stack direction="row" justifyContent="center" spacing={2}>
              <Link
                component="button"
                variant="body2"
                onClick={() => { setOtpSent(false); setCode(''); setAuthError(''); }}
                sx={{ color: 'text.secondary', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Change
              </Link>
              <Link
                component="button"
                variant="body2"
                onClick={handleSendOtp}
                sx={{ color: 'text.secondary', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Resend code
              </Link>
            </Stack>
          </Stack>
        )}
      </Box>
    );
  }

  // ── Orders View ──
  return (
    <Box component="main" ref={mainContentRef} tabIndex={-1} sx={{ maxWidth: 600, mx: 'auto', px: 2, py: 4, outline: 'none' }}>
      <Helmet><title>My Account | Surreal Creamery</title></Helmet>
      {/* Header */}
      {session.firstName && (
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 0.5 }}>
          Hi, {session.firstName}
        </Typography>
      )}
      <Typography variant="h2" component="h1">My Orders</Typography>
      <Box sx={{ height: 16 }} />

      {ordersError && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{ordersError}</Alert>}

      {/* Loading skeletons */}
      {ordersLoading && (
        <Stack spacing={2} aria-busy="true" role="status" aria-live="polite">
          {[1, 2, 3].map(i => (
            <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Skeleton variant="text" width="40%" height={28} />
              <Skeleton variant="text" width="60%" height={20} sx={{ mt: 1 }} />
              <Skeleton variant="text" width="30%" height={20} sx={{ mt: 0.5 }} />
            </Paper>
          ))}
        </Stack>
      )}

      {/* Empty state */}
      {!ordersLoading && orders && orders.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <ReceiptLongIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>No orders yet</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Your order history will appear here once you place an order.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/desserts')}
            sx={{
              bgcolor: 'black', color: 'white', textTransform: 'none', fontWeight: 600,
              px: 4, py: 1.5,
              '&:hover': { bgcolor: '#333' },
            }}
          >
            Start Shopping
          </Button>
        </Box>
      )}

      {/* Order list */}
      {!ordersLoading && orders && orders.length > 0 && (
        <Stack spacing={2}>
          {orders.map((order) => (
            <Accordion
              key={order.masterOrderId}
              variant="outlined"
              disableGutters
              sx={{
                borderRadius: '8px !important',
                '&:before': { display: 'none' },
                '&.Mui-expanded': { margin: '0 !important' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, py: 0.5 }}>
                <Stack sx={{ width: '100%', pr: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontWeight: 600 }}>
                      Order {order.displayName || `#${order.orderNumber}`}
                    </Typography>
                    <Typography sx={{ fontWeight: 700 }}>
                      {formatCents(order.payment?.total)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {formatDate(order.createdAt || order.date)}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {order.fulfillment?.type && (
                        order.fulfillment.type === 'shipping' || order.fulfillment.type === 'local'
                          ? <LocalShippingIcon sx={{ fontSize: 16, color: 'text.secondary' }} aria-hidden="true" />
                          : <StorefrontIcon sx={{ fontSize: 16, color: 'text.secondary' }} aria-hidden="true" />
                      )}
                      <Chip
                        label={order.status}
                        size="small"
                        color={statusColor(order.status)}
                        variant="outlined"
                        sx={{ fontWeight: 600, fontSize: '1.6rem', height: 24 }}
                      />
                    </Stack>
                  </Stack>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                <Divider sx={{ mb: 1.5 }} />
                <Stack spacing={1}>
                  {order.lineItems?.map((item, idx) => (
                    <Box key={idx}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.quantity > 1 ? `${item.quantity} x ` : ''}{item.name}
                          {item.variantName ? ` — ${item.variantName}` : ''}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, flexShrink: 0, ml: 1 }}>
                          {formatCents(item.totalPrice)}
                        </Typography>
                      </Stack>
                      {item.modifiers?.length > 0 && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', pl: 1, fontSize: '1.6rem' }}>
                          {item.modifiers.map(m => m.name || m).join(', ')}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>

                {/* Payment summary */}
                {order.payment && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    <Box component="dl" sx={{ m: 0, '& > div': { display: 'flex', justifyContent: 'space-between', mb: 0.5 } }}>
                      <div>
                        <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>Subtotal</Typography>
                        <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatCents(order.payment.subtotal)}</Typography>
                      </div>
                      {order.payment.tax > 0 && (
                        <div>
                          <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>Tax</Typography>
                          <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatCents(order.payment.tax)}</Typography>
                        </div>
                      )}
                      {order.payment.shipping > 0 && (
                        <div>
                          <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>Shipping</Typography>
                          <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatCents(order.payment.shipping)}</Typography>
                        </div>
                      )}
                      {order.payment.tip > 0 && (
                        <div>
                          <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>Tip</Typography>
                          <Typography component="dd" variant="body2" sx={{ m: 0 }}>{formatCents(order.payment.tip)}</Typography>
                        </div>
                      )}
                      {order.payment.discount > 0 && (
                        <div>
                          <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>Discount</Typography>
                          <Typography component="dd" variant="body2" sx={{ m: 0, color: 'success.main' }}>-{formatCents(order.payment.discount)}</Typography>
                        </div>
                      )}
                      <Box component="div" sx={{ pt: 0.5 }}>
                        <Typography component="dt" variant="body2" sx={{ fontWeight: 700 }}>Total</Typography>
                        <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 700 }}>{formatCents(order.payment.total)}</Typography>
                      </Box>
                    </Box>
                  </>
                )}

                {/* Location */}
                {order.locationName && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
                    {order.locationName}
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}
    </Box>
  );
}
