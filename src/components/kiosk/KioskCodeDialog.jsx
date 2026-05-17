import React from 'react';
import { Box, Typography, Button, CircularProgress, Modal } from '@mui/material';

/**
 * Kiosk code entry dialog — 6-digit numeric keypad for terminal pairing.
 */
export function KioskCodeDialog({ open, onClose, codeInput, onCodeInputChange, loading, error, onSubmit }) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            <Box sx={{ bgcolor: 'white', borderRadius: 3, p: 4, mx: 2, maxWidth: 360, width: '100%', outline: 'none', textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                    Enter Device Code
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Enter the 6-digit registration code
                </Typography>

                {/* Code display */}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 1 }}>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <Box key={i} sx={{
                            width: 40, height: 48, borderRadius: 1.5,
                            border: '2px solid', borderColor: error ? 'error.main' : codeInput.length === i ? 'primary.main' : 'grey.300',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: codeInput[i] ? 'grey.50' : 'white',
                            transition: 'border-color 0.15s',
                        }}>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700 }}>
                                {codeInput[i] || ''}
                            </Typography>
                        </Box>
                    ))}
                </Box>
                {error && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
                        {error}
                    </Typography>
                )}

                {/* Numeric keypad */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 2, mt: 2 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <Button
                            key={n}
                            variant="outlined"
                            onClick={() => {
                                if (codeInput.length < 6) {
                                    onCodeInputChange(codeInput + n);
                                }
                            }}
                            sx={{ fontSize: '2rem', fontWeight: 600, py: 1.5, minWidth: 0, borderColor: 'grey.300', color: 'text.primary' }}
                        >
                            {n}
                        </Button>
                    ))}
                    <Button
                        variant="outlined"
                        onClick={() => onCodeInputChange('')}
                        sx={{ fontSize: '1.2rem', fontWeight: 600, py: 1.5, minWidth: 0, borderColor: 'grey.300', color: 'text.secondary' }}
                    >
                        Clear
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => {
                            if (codeInput.length < 6) {
                                onCodeInputChange(codeInput + '0');
                            }
                        }}
                        sx={{ fontSize: '2rem', fontWeight: 600, py: 1.5, minWidth: 0, borderColor: 'grey.300', color: 'text.primary' }}
                    >
                        0
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => onCodeInputChange(codeInput.slice(0, -1))}
                        disabled={codeInput.length === 0}
                        sx={{ fontSize: '1.6rem', fontWeight: 600, py: 1.5, minWidth: 0, borderColor: 'grey.300', color: 'text.secondary' }}
                    >
                        &#9003;
                    </Button>
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={onClose}
                        sx={{ flex: 1, textTransform: 'none', borderColor: 'grey.300', color: 'grey.700' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={onSubmit}
                        disabled={codeInput.length !== 6 || loading}
                        sx={{ flex: 2, textTransform: 'none', bgcolor: 'black', '&:hover': { bgcolor: 'grey.800' } }}
                    >
                        {loading ? <CircularProgress size={20} color="inherit" /> : 'Enter Kiosk Mode'}
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}
