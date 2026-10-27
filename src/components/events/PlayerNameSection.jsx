import React from 'react';
import { Box, Typography, Button, TextField, Alert, Paper, Stack } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

// Collects an additional player's name for a gaming event. Reached either from the
// "already registered — different player?" interception (reason='duplicate') or the
// "register another player" button after a successful registration (reason='another').
export const PlayerNameSection = ({ eventName, reason, playerName, error, registeredPlayers = [], onChange, onSubmit, onCancel }) => {
    const isDuplicate = reason === 'duplicate';

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); onSubmit?.(); }
    };

    return (
        <Box>
            <Typography variant="h2" component="h2" sx={{ mb: '24px !important' }}>
                {isDuplicate ? 'Already registered' : 'Register another player'}
            </Typography>

            {isDuplicate ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                    The player information you have submitted is already registered. If you're registering a{' '}
                    <strong>different</strong> player, enter their information below.
                </Alert>
            ) : (
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Enter the next player's name to register them for {eventName}. Each player gets their own spot.
                </Typography>
            )}

            {registeredPlayers.length > 0 && (
                <Paper variant="outlined" sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, mb: 1.25 }}>
                        The following player{registeredPlayers.length === 1 ? ' has' : 's have'} already been registered:
                    </Typography>
                    <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} spacing={1}>
                        {registeredPlayers.map((name, i) => (
                            <Box component="li" key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CheckCircleRoundedIcon sx={{ fontSize: '1.8rem', color: 'success.main', flexShrink: 0 }} />
                                <Typography sx={{ fontSize: '1.6rem' }}>{name}</Typography>
                            </Box>
                        ))}
                    </Stack>
                </Paper>
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
