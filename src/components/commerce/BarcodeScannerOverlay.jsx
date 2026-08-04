import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, TextField, LinearProgress, IconButton, Dialog, DialogTitle, DialogContent } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CloseIcon from '@mui/icons-material/Close';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const TEAM_API_URL = 'https://kydyl5bt2suzjmewcljrgsy5re0jbqdz.lambda-url.us-east-1.on.aws';

const DEBOUNCE_MS = 1500;

export default function BarcodeScannerOverlay({ scanItems, onScanUpdate, onComplete, onOverride, onCancel, kioskTerminal }) {
  const [feedback, setFeedback] = useState(null); // { message, severity }
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ barcode: '', time: 0 });
  const feedbackTimer = useRef(null);
  const scanItemsRef = useRef(scanItems);

  // Keep ref in sync for use inside scanner callback
  useEffect(() => { scanItemsRef.current = scanItems; }, [scanItems]);

  const totalRequired = scanItems.reduce((sum, i) => sum + i.requiredScans, 0);
  const totalScanned = scanItems.reduce((sum, i) => sum + i.scannedCount, 0);

  const showFeedback = useCallback((message, severity) => {
    setFeedback({ message, severity });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
  }, []);

  const onDecodeSuccess = useCallback((decodedText) => {
    const now = Date.now();
    if (lastScanRef.current.barcode === decodedText && now - lastScanRef.current.time < DEBOUNCE_MS) return;
    lastScanRef.current = { barcode: decodedText, time: now };

    const items = scanItemsRef.current;
    const match = items.find(item => item.barcode === decodedText && item.scannedCount < item.requiredScans);

    if (match) {
      const updated = items.map(item =>
        item.id === match.id ? { ...item, scannedCount: item.scannedCount + 1 } : item
      );
      onScanUpdate(updated);
      if (updated.every(item => item.scannedCount >= item.requiredScans)) {
        onComplete();
      } else {
        showFeedback(`${match.name} scanned`, 'success');
      }
    } else if (items.some(item => item.barcode === decodedText)) {
      showFeedback('Already verified', 'info');
    } else {
      showFeedback(`Barcode ${decodedText} does not match any item`, 'error');
    }
  }, [onScanUpdate, onComplete, showFeedback]);

  // Initialize scanner
  useEffect(() => {
    const scannerId = 'barcode-scanner-region';
    let html5Qrcode = null;
    let running = false;

    const startScanner = async () => {
      try {
        html5Qrcode = new Html5Qrcode(scannerId);
        scannerRef.current = html5Qrcode;
        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            formatsToSupport: [
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_128,
            ],
          },
          onDecodeSuccess,
          () => {} // ignore decode errors (no barcode in frame)
        );
        running = true;
      } catch (err) {
        console.error('[BarcodeScanner] Failed to start:', err);
        showFeedback('Camera access failed', 'error');
      }
    };

    // Small delay to let the DOM element mount
    const timer = setTimeout(startScanner, 300);

    return () => {
      clearTimeout(timer);
      if (html5Qrcode && running) {
        html5Qrcode.stop().catch(() => {});
      }
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // PIN verification
  const handlePinSubmit = useCallback(async (enteredPin) => {
    if (enteredPin.length !== 4) return;
    setVerifying(true);
    setPinError('');
    try {
      const res = await fetch(TEAM_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verifyPin', locationId: kioskTerminal?.locationId, pin: enteredPin }),
      });
      if (res.ok) {
        setShowPinDialog(false);
        setPin('');
        onOverride();
      } else {
        setPinError('Invalid PIN');
        setPin('');
      }
    } catch {
      setPinError('Verification failed');
      setPin('');
    } finally {
      setVerifying(false);
    }
  }, [kioskTerminal, onOverride]);

  const handlePinChange = useCallback((e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    setPinError('');
    if (val.length === 4) handlePinSubmit(val);
  }, [handlePinSubmit]);

  return (
    <Box sx={{ position: 'fixed', inset: 0, bgcolor: '#fff', display: 'flex', flexDirection: 'column', zIndex: 1300 }}>
      {/* Camera viewfinder */}
      <Box sx={{ position: 'relative', width: '100%', height: '40%', bgcolor: '#000', overflow: 'hidden' }}>
        <div id="barcode-scanner-region" style={{ width: '100%', height: '100%' }} />
        {/* Scan feedback overlay */}
        {feedback && (
          <Box sx={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            px: 3, py: 1.5, borderRadius: 2,
            bgcolor: feedback.severity === 'success' ? 'success.main' : feedback.severity === 'error' ? 'error.main' : 'info.main',
            color: '#fff', fontWeight: 600, fontSize: '1rem', whiteSpace: 'nowrap',
            boxShadow: 3,
          }}>
            {feedback.message}
          </Box>
        )}
      </Box>

      {/* Item checklist */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          Scan Items
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {totalScanned} of {totalRequired} items verified
        </Typography>
        <LinearProgress
          variant="determinate"
          value={totalRequired > 0 ? (totalScanned / totalRequired) * 100 : 0}
          sx={{ mb: 2, height: 6, borderRadius: 3 }}
        />

        {scanItems.map((item) => {
          const done = item.scannedCount >= item.requiredScans;
          return (
            <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              {done
                ? <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
                : <RadioButtonUncheckedIcon sx={{ color: 'text.disabled', fontSize: 28 }} />
              }
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: done ? 600 : 400, color: done ? 'success.main' : 'text.primary' }}>
                  {item.name}{item.variantName ? ` — ${item.variantName}` : ''}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: done ? 'success.main' : 'text.secondary' }}>
                {item.scannedCount}/{item.requiredScans}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Bottom buttons */}
      <Box sx={{ p: 3, pt: 1, display: 'flex', gap: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          variant="text"
          color="inherit"
          onClick={() => { setShowPinDialog(true); setPinError(''); setPin(''); }}
          sx={{ flex: 1, textTransform: 'none', fontSize: '1rem' }}
        >
          Manager Override
        </Button>
        <Button
          variant="text"
          color="inherit"
          onClick={onCancel}
          sx={{ flex: 1, textTransform: 'none', fontSize: '1rem' }}
        >
          Back to Cart
        </Button>
      </Box>

      {/* Manager PIN Dialog */}
      <Dialog
        open={showPinDialog}
        onClose={() => setShowPinDialog(false)}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        PaperProps={{ sx: { minWidth: 320, p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          Manager PIN
          <IconButton size="small" onClick={() => setShowPinDialog(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter a manager PIN to override barcode verification.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            type="password"
            placeholder="4-digit PIN"
            value={pin}
            onChange={handlePinChange}
            disabled={verifying}
            error={!!pinError}
            helperText={pinError}
            inputProps={{ maxLength: 4, inputMode: 'numeric', pattern: '[0-9]*', style: { fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.5em' } }}
            sx={{ mb: 1 }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
