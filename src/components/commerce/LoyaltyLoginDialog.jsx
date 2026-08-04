import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import { useCheckout } from '@/components/commerce/CheckoutContext';
import { useLoyalty } from '@/contexts/commerce/LoyaltyContext';
import { sendCheckoutOtp, verifyCheckoutOtp } from '@/services/checkoutService';

// Detect whether input looks like a phone number (digits, dashes, parens, spaces, leading +)
const looksLikePhone = (val) => /^\+?[\d\s()-]{7,}$/.test(val.trim());

export function LoyaltyLoginDialog({ open, onClose }) {
  const { setOtpSession, setSavedAddresses, setSavedPaymentMethods } = useCheckout();
  const { loyaltyAccount, loyaltyBalance } = useLoyalty();

  const [identifier, setIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState('input'); // input | sending | code | verifying | done
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [otpChannel, setOtpChannel] = useState('email'); // email | sms

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setIdentifier('');
      setOtpCode('');
      setStep('input');
      setError(null);
      setCooldown(0);
      setOtpChannel('email');
    }
  }, [open]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSendOtp = useCallback(async () => {
    const val = identifier.trim();
    if (!val) { setError('Please enter your email or phone number'); return; }
    const isPhone = looksLikePhone(val);
    const channel = isPhone ? 'sms' : 'email';
    setOtpChannel(channel);
    setStep('sending');
    setError(null);
    try {
      await sendCheckoutOtp({ to: val, channel });
      setStep('code');
      setCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to send code');
      setStep('input');
    }
  }, [identifier]);

  const handleVerifyOtp = useCallback(async () => {
    if (otpCode.length !== 6) { setError('Please enter the 6-digit code'); return; }
    setStep('verifying');
    setError(null);
    try {
      const result = await verifyCheckoutOtp({ to: identifier.trim(), code: otpCode });
      if (!result.success) {
        setError(result.message || 'Invalid code');
        setStep('code');
        return;
      }
      setOtpSession(result.sessionToken, result.customerId);

      // Fetch saved profile data
      try {
        const CHECKOUT_API_URL = 'https://viif6favb73jr3pm2ph6qcten40ethnp.lambda-url.us-east-1.on.aws';
        const res = await fetch(CHECKOUT_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getCustomerCheckoutProfile', sessionToken: result.sessionToken }),
        });
        const data = await res.json();
        const profile = typeof data.body === 'string' ? JSON.parse(data.body) : data;
        setSavedAddresses(profile.addresses || []);
        setSavedPaymentMethods(profile.savedPaymentMethods || []);
      } catch (_) { /* non-critical */ }

      setStep('done');
    } catch (err) {
      setError(err.message || 'Verification failed');
      setStep('code');
    }
  }, [identifier, otpCode, setOtpSession, setSavedAddresses, setSavedPaymentMethods]);

  const isDone = step === 'done';
  const channelLabel = otpChannel === 'sms' ? 'phone' : 'email';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <StarIcon sx={{ color: '#f57f17' }} />
          <Typography variant="h6" component="span" fontWeight={700}>
            Surreal Rewards
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {isDone ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#f57f17', mb: 1 }}>
              Welcome back!
            </Typography>
            {loyaltyAccount && (
              <>
                <Typography variant="h4" fontWeight={800} sx={{ mb: 0.5 }}>
                  {loyaltyBalance.toLocaleString()} pts
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {loyaltyAccount.tierName} member
                </Typography>
              </>
            )}
            <Button
              fullWidth
              variant="contained"
              onClick={onClose}
              sx={{ mt: 3, bgcolor: '#000', '&:hover': { bgcolor: '#333' }, textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
            >
              Start Shopping
            </Button>
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter your email or phone number to get started.
            </Typography>

            {(step === 'input' || step === 'sending') && (
              <>
                <TextField
                  fullWidth
                  label="Email or phone number"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                  disabled={step === 'sending'}
                  autoFocus
                  sx={{ mb: 2 }}
                />
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleSendOtp}
                  disabled={step === 'sending' || !identifier.trim()}
                  sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#333' }, textTransform: 'none', fontWeight: 600, borderRadius: 2, py: 1.2 }}
                >
                  {step === 'sending' ? <CircularProgress size={22} color="inherit" /> : 'Send Verification Code'}
                </Button>
              </>
            )}

            {(step === 'code' || step === 'verifying') && (
              <>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  We sent a code to your <strong>{channelLabel}</strong>
                </Typography>
                <TextField
                  fullWidth
                  label="6-digit code"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                  disabled={step === 'verifying'}
                  autoFocus
                  inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                  sx={{ mb: 2 }}
                />
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleVerifyOtp}
                  disabled={step === 'verifying' || otpCode.length !== 6}
                  sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#333' }, textTransform: 'none', fontWeight: 600, borderRadius: 2, py: 1.2 }}
                >
                  {step === 'verifying' ? <CircularProgress size={22} color="inherit" /> : 'Verify'}
                </Button>
                {cooldown > 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                    Resend in {cooldown}s
                  </Typography>
                ) : (
                  <Button size="small" onClick={handleSendOtp} sx={{ mt: 1, textTransform: 'none', display: 'block', mx: 'auto' }}>
                    Resend code
                  </Button>
                )}
              </>
            )}

            {error && (
              <Typography variant="body2" color="error" sx={{ mt: 1, textAlign: 'center' }}>
                {error}
              </Typography>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
