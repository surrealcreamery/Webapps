/**
 * NotificationBanner — Renders active notifications at the top of the consumer storefront.
 * Supports three types: banner (slim top bar), modal (centered dialog), info (snackbar).
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Snackbar,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNotifications } from '@/contexts/commerce/NotificationContext';

export default function NotificationBanner() {
  const { notifications, dismissNotification } = useNotifications();
  const [closedModals, setClosedModals] = useState(new Set());

  if (!notifications || notifications.length === 0) return null;

  const banners = notifications.filter(n => n.type === 'banner');
  const modals = notifications.filter(n => n.type === 'modal' && !closedModals.has(n.notificationId));
  const infos = notifications.filter(n => n.type === 'info');

  const handleDismiss = (notificationId) => {
    dismissNotification(notificationId);
  };

  const handleCloseModal = (notificationId) => {
    setClosedModals(prev => new Set(prev).add(notificationId));
    dismissNotification(notificationId);
  };

  return (
    <>
      {/* Banner notifications — slim top bar */}
      {banners.map(n => (
        <Box
          key={n.notificationId}
          role="alert"
          sx={{
            bgcolor: '#1a1a2e',
            color: 'white',
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="subtitle2" component="span" fontWeight={600}>
              {n.title}
            </Typography>
            {n.body && (
              <Typography variant="body2" component="span" sx={{ ml: 1, opacity: 0.9 }}>
                {n.body}
              </Typography>
            )}
          </Box>
          <IconButton size="small" aria-label="Dismiss notification" sx={{ color: 'white' }} onClick={() => handleDismiss(n.notificationId)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}

      {/* Modal notifications — centered dialog */}
      {modals.map(n => (
        <Dialog key={n.notificationId} open onClose={() => handleCloseModal(n.notificationId)} maxWidth="xs" fullWidth aria-labelledby={`notification-dialog-title-${n.notificationId}`}>
          <DialogTitle id={`notification-dialog-title-${n.notificationId}`}>{n.title}</DialogTitle>
          <DialogContent>
            <Typography variant="body1">{n.body}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => handleCloseModal(n.notificationId)}>Got it</Button>
          </DialogActions>
        </Dialog>
      ))}

      {/* Info notifications — snackbar */}
      {infos.map(n => (
        <Snackbar
          key={n.notificationId}
          open
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          onClose={() => handleDismiss(n.notificationId)}
        >
          <Alert severity="info" variant="filled" onClose={() => handleDismiss(n.notificationId)}>
            <Typography variant="subtitle2">{n.title}</Typography>
            {n.body && <Typography variant="body2">{n.body}</Typography>}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
}
