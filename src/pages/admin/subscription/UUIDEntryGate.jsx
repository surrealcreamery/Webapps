import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  TextField,
  Button,
} from '@mui/material';
import { getAuth } from 'firebase/auth';
import { ADMIN_API_URL } from '@/constants/admin/adminConstants';

// Generate a stable client UUID for this browser
function getOrCreateClientUUID() {
  const STORAGE_KEY = 'surreal_client_uuid';
  let uuid = localStorage.getItem(STORAGE_KEY);
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, uuid);
  }
  return uuid;
}

// Check if device is already registered
function getStoredDeviceId() {
  return localStorage.getItem('surreal_device_id');
}

// Store device ID after successful registration
function storeDeviceId(deviceId) {
  localStorage.setItem('surreal_device_id', deviceId);
}

// Master bypass configuration
const MASTER_CODE = '911911';
const MASTER_EMAIL = 'albert@breakingbatter.com';

export default function UUIDEntryGate({ onAuthenticated }) {
  const [view, setView] = useState('loading'); // loading | code_entry | error
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef([]);

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    // Check if device is already registered
    const deviceId = getStoredDeviceId();
    if (deviceId) {
      // Device is registered, authenticate
      onAuthenticated();
    } else {
      // Show code entry screen
      setView('code_entry');
    }
  }, [onAuthenticated]);

  const handleCodeChange = (index, value) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = code.split('');
    newCode[index] = digit;
    const updatedCode = newCode.join('').slice(0, 6);
    setCode(updatedCode.padEnd(6, ' ').slice(0, 6).replace(/ /g, ''));

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setCode(pastedData);
    // Focus the appropriate input
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = async () => {
    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      // Check for master bypass
      if (code === MASTER_CODE && user?.email === MASTER_EMAIL) {
        // Master bypass - store a special device ID and authenticate
        storeDeviceId('MASTER_BYPASS');
        onAuthenticated();
        return;
      }

      // Get or create client UUID
      const clientUUID = getOrCreateClientUUID();
      const userAgent = navigator.userAgent;

      // Get Firebase token
      const token = user ? await user.getIdToken() : null;

      // Call registerDevice API
      const response = await fetch(ADMIN_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          action: 'registerDevice',
          code,
          clientUUID,
          userAgent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      if (data.success && data.deviceId) {
        // Store device ID and authenticate
        storeDeviceId(data.deviceId);
        onAuthenticated();
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError(err.message || 'Failed to register device');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderLoading = () => (
    <>
      <CircularProgress sx={{ mb: 3 }} />
      <Typography variant="h6" component="h1">
        Checking device...
      </Typography>
    </>
  );

  const renderCodeEntry = () => (
    <>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
        Device Registration
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
        Enter the 6-digit registration code from your administrator to access this device.
      </Typography>

      {/* 6-digit code input */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <TextField
            key={index}
            inputRef={(el) => (inputRefs.current[index] = el)}
            value={code[index] || ''}
            onChange={(e) => handleCodeChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={index === 0 ? handlePaste : undefined}
            inputProps={{
              maxLength: 1,
              style: {
                textAlign: 'center',
                fontSize: '2rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                padding: '12px 0',
              },
              inputMode: 'numeric',
              pattern: '[0-9]*',
            }}
            sx={{
              width: 56,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
            autoFocus={index === 0}
          />
        ))}
      </Box>

      {error && (
        <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        size="large"
        onClick={handleSubmit}
        disabled={code.length !== 6 || isSubmitting}
        fullWidth
        sx={{ py: 1.5, fontSize: '1.1rem' }}
      >
        {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Register Device'}
      </Button>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
        Contact your administrator if you don't have a registration code.
      </Typography>
    </>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
        p: 3
      }}
    >
      <Paper
        elevation={4}
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 450,
          width: '100%',
          borderRadius: 2
        }}
      >
        {view === 'loading' && renderLoading()}
        {view === 'code_entry' && renderCodeEntry()}
      </Paper>
    </Box>
  );
}
