import React from 'react';
import { Box, Typography, Button, TextField, Alert } from '@mui/material';

// Collects an additional player's name for a gaming event. Reached either from the
// "already registered — different player?" interception (reason='duplicate') or the
// "register another player" button after a successful registration (reason='another').
export const PlayerNameSection = ({ eventName, reason, playerName, error, onChange, onSubmit, onCancel }) => {
    const isDuplicate = reason === 'duplicate';

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); onSubmit?.(); }
    };

    return (
        <Box>
            <Typography variant="h2" component="h2" gutterBottom>
                {isDuplicate ? "You're already registered" : 'Register another player'}
            </Typography>

            {isDuplicate ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                    That registration is all set. If you're registering a <strong>different</strong> player for {eventName},
                    enter their name below. Otherwise you can go back — nothing else is needed.
                </Alert>
            ) : (
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Enter the next player's name to register them for {eventName}. Each player gets their own spot.
                </Typography>
            )}

            <Box component="form" noValidate sx={{ mt: 1 }}>
                <TextField
                    fullWidth
                    autoFocus
                    margin="dense"
                    label="Player's Name"
                    name="playerName"
                    value={playerName}
                    onChange={(e) => onChange?.(e.target.value)}
                    onKeyDown={handleKeyDown}
                    error={!!error}
                    helperText={error || ' '}
                />
            </Box>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                <Button
                    variant="contained"
                    onClick={onCancel}
                    sx={{ backgroundColor: 'grey.200', color: 'primary.main', boxShadow: 'none', '&:hover': { backgroundColor: 'grey.300', boxShadow: 'none' } }}
                >
                    {isDuplicate ? 'No, go back' : 'Cancel'}
                </Button>
                <Button variant="contained" onClick={onSubmit}>
                    Continue
                </Button>
            </Box>
        </Box>
    );
};
