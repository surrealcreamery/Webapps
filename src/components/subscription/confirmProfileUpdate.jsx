import React, { useState } from 'react';
import { Box, Typography, Button, Card, CardContent, Radio, Stack } from '@mui/material';

export default function ConfirmProfileUpdate({ send, profileMismatch }) {
    const { onFile, submitted } = profileMismatch;
    const [selectedOption, setSelectedOption] = useState('submitted');

    // Compute which fields differ
    const diffs = [];
    if (submitted.firstName !== onFile.firstName) {
        diffs.push({ field: 'firstName', label: 'First Name', onFile: onFile.firstName, submitted: submitted.firstName });
    }
    if (submitted.lastName !== onFile.lastName) {
        diffs.push({ field: 'lastName', label: 'Last Name', onFile: onFile.lastName, submitted: submitted.lastName });
    }

    const handleContinue = () => {
        if (selectedOption === 'submitted') {
            send({ type: 'CONFIRM_PROFILE_UPDATE' });
        } else {
            send({ type: 'SKIP_PROFILE_UPDATE' });
        }
    };

    return (
        <Box>
            <Typography variant="h5" gutterBottom>Confirm Your Details</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                The name you entered differs from what we have on file.
                Which information would you like to use?
            </Typography>

            <Box component="fieldset" sx={{ border: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Option 1: Use newly submitted info */}
                <Card variant="outlined" sx={{ '&:has(input:checked)': { borderColor: 'primary.main', borderWidth: 2 } }}>
                    <CardContent
                        component="label"
                        sx={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer', width: '100%', p: '16px !important' }}
                    >
                        <Radio
                            value="submitted"
                            name="profileOption"
                            checked={selectedOption === 'submitted'}
                            onChange={() => setSelectedOption('submitted')}
                            sx={{ mr: 2, mt: 0.5 }}
                        />
                        <Box>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                Update to new information
                            </Typography>
                            <Stack spacing={0.5} sx={{ mt: 1 }}>
                                {diffs.map(d => (
                                    <Typography key={d.field} variant="body2">
                                        <strong>{d.label}:</strong> {d.submitted}
                                    </Typography>
                                ))}
                            </Stack>
                        </Box>
                    </CardContent>
                </Card>

                {/* Option 2: Keep existing info on file */}
                <Card variant="outlined" sx={{ '&:has(input:checked)': { borderColor: 'primary.main', borderWidth: 2 } }}>
                    <CardContent
                        component="label"
                        sx={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer', width: '100%', p: '16px !important' }}
                    >
                        <Radio
                            value="onFile"
                            name="profileOption"
                            checked={selectedOption === 'onFile'}
                            onChange={() => setSelectedOption('onFile')}
                            sx={{ mr: 2, mt: 0.5 }}
                        />
                        <Box>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                Keep existing information
                            </Typography>
                            <Stack spacing={0.5} sx={{ mt: 1 }}>
                                {diffs.map(d => (
                                    <Typography key={d.field} variant="body2">
                                        <strong>{d.label}:</strong> {d.onFile}
                                    </Typography>
                                ))}
                            </Stack>
                        </Box>
                    </CardContent>
                </Card>
            </Box>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" onClick={handleContinue}>
                    Continue
                </Button>
            </Box>
        </Box>
    );
}
