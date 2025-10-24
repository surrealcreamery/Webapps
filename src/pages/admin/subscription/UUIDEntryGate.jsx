import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  CircularProgress, 
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Button,
} from '@mui/material';
import { useValidateAndAssignUUID } from '@/contexts/admin/AdminDataContext';

// --- Fingerprinting Logic ---

/**
 * Hashes a string using the SHA-256 algorithm.
 * @param {string} str The string to hash.
 * @returns {Promise<string>} A promise that resolves with the hex-encoded hash.
 */
async function sha256(str) {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Generates a fingerprint based on the device's WebGL rendering capabilities.
 * @returns {string} The WebGL fingerprint or a fallback string.
 */
function getWebGLFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      return 'no_webgl';
    }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return `${vendor}#${renderer}`;
  } catch (e) {
    return 'webgl_error';
  }
}

/**
 * Generates a fingerprint based on the device's audio processing capabilities.
 * @returns {Promise<string>} A promise that resolves with the audio fingerprint.
 */
function getAudioFingerprint() {
  return new Promise((resolve) => {
    try {
      const audioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!audioContext) {
        return resolve('no_audio_context');
      }
      const context = new audioContext(1, 44100, 44100);
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, context.currentTime);

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, context.currentTime);
      compressor.knee.setValueAtTime(40, context.currentTime);
      compressor.ratio.setValueAtTime(12, context.currentTime);
      compressor.attack.setValueAtTime(0, context.currentTime);
      compressor.release.setValueAtTime(0.25, context.currentTime);
      
      oscillator.connect(compressor);
      compressor.connect(context.destination);
      oscillator.start(0);
      context.startRendering();

      context.oncomplete = (event) => {
        const buffer = event.renderedBuffer.getChannelData(0);
        const sum = buffer.slice(4500, 5000).reduce((acc, val) => acc + Math.abs(val), 0);
        resolve(sum.toString());
        compressor.disconnect();
      };
    } catch (e) {
      resolve('audio_error');
    }
  });
}

/**
 * Generates a stable, unique fingerprint for the current device.
 * @returns {Promise<string>} A promise that resolves with the SHA-256 hash of the device fingerprint.
 */
async function generateDeviceFingerprint() {
  const components = await Promise.all([
    getAudioFingerprint(),
    getWebGLFingerprint(),
    navigator.hardwareConcurrency,
    navigator.platform,
  ]);

  const fingerprintString = components.join('#');
  return sha256(fingerprintString);
}


export default function UUIDEntryGate({ onAuthenticated }) {
  const [view, setView] = useState('loading'); // loading | pending | selection | error
  const [statusMessage, setStatusMessage] = useState('Analyzing device...');
  const [error, setError] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [deviceChoices, setDeviceChoices] = useState([]);
  const [fingerprint, setFingerprint] = useState(null);
  
  const verificationMutation = useValidateAndAssignUUID();

  const handleServerResponse = (result) => {
    if (result && result.Action === 'Device Added') {
      setView('pending');
    } else if (Array.isArray(result)) {
      if (result.length === 0) {
        setView('pending');
      } else if (result.length === 1 && result[0].Status === 'Approved') {
        onAuthenticated();
      } else {
        setDeviceChoices(result);
        setView('selection');
      }
    } else {
      throw new Error('Received an unexpected response from the server.');
    }
  };

  useEffect(() => {
    const identifyDevice = async () => {
      try {
        const fp = await generateDeviceFingerprint();
        setFingerprint(fp);
        setStatusMessage('Verifying device...');

        const result = await verificationMutation.mutateAsync({ fingerprint: fp });
        handleServerResponse(result);
      } catch (err) {
        setError(err.message || 'An error occurred during device verification.');
        setView('error');
      }
    };
    
    identifyDevice();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckStatus = async () => {
    setSelectionError('');
    try {
      const result = await verificationMutation.mutateAsync({ fingerprint });
      handleServerResponse(result);
    } catch (err) {
      setError(err.message || 'Could not check device status.');
      setView('error');
    }
  };

  const handleSelectIdentity = (selectedDevice) => {
    if (selectedDevice.Status === 'Approved') {
      onAuthenticated();
    } else {
      setSelectionError(`Device "${selectedDevice['Device Location']}" has not been approved yet.`);
      setView('pending');
    }
  };
  
  const renderLoading = () => (
    <>
      <CircularProgress sx={{ mb: 3 }} />
      <Typography variant="h6" component="h1">
        Device Verification
      </Typography>
      <Typography color="text.secondary">
        {statusMessage}
      </Typography>
    </>
  );

  const renderPending = () => (
    <>
      <Typography variant="h5" component="h1" gutterBottom>
        Access Requested
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        This device has been submitted for approval. Please check back after an administrator has granted access.
      </Typography>
      {selectionError && <Alert severity="warning" sx={{ width: '100%', mb: 2 }}>{selectionError}</Alert>}
      <Button
        variant="contained"
        size="large"
        onClick={handleCheckStatus}
        disabled={verificationMutation.isPending}
        fullWidth
      >
        {verificationMutation.isPending ? <CircularProgress size={24} color="inherit" /> : 'Check Status'}
      </Button>
    </>
  );

  const renderSelection = () => (
    <>
      <Typography variant="h5" component="h1" gutterBottom>
        Select Device Identity
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        This device fingerprint is associated with multiple profiles. Please select the correct one for this physical device.
      </Typography>
      <List sx={{ width: '100%', border: '1px solid #ddd', borderRadius: 1 }}>
        {deviceChoices.map((choice, index) => (
          <React.Fragment key={choice.id}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleSelectIdentity(choice)}>
                <ListItemText 
                  primary={choice['Device Location']} 
                  secondary={`Status: ${choice.Status}`}
                />
              </ListItemButton>
            </ListItem>
            {index < deviceChoices.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    </>
  );

  const renderError = () => (
    <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>
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
        {view === 'pending' && renderPending()}
        {view === 'selection' && renderSelection()}
        {view === 'error' && renderError()}
      </Paper>
    </Box>
  );
};