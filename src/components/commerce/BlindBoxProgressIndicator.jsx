import React from 'react';
import { Box, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';

/**
 * Visual progress indicator for blind box quantity discounts
 * Shows numbered boxes that fill in as blind boxes are added to cart
 *
 * @param {number} current - Number of blind boxes currently in cart
 * @param {number} required - Number of blind boxes required for discount
 * @param {function} onClickIncomplete - Callback when clicking an incomplete step (receives step number)
 */
export const BlindBoxProgressIndicator = ({ current = 0, required = 3, onClickIncomplete }) => {
    return (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            my: 1.5
        }}>
            {Array.from({ length: required }, (_, index) => {
                const stepNumber = index + 1;
                const isCompleted = current >= stepNumber;
                const isClickable = !isCompleted && onClickIncomplete;

                return (
                    <Box
                        key={stepNumber}
                        onClick={isClickable ? () => onClickIncomplete(stepNumber) : undefined}
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: isCompleted ? 'none' : '2px dashed',
                            borderColor: isCompleted ? 'transparent' : '#333',
                            bgcolor: isCompleted ? '#2e7d32' : 'transparent',
                            transition: 'all 0.3s ease',
                            cursor: isClickable ? 'pointer' : 'default',
                            '&:hover': isClickable ? {
                                bgcolor: 'rgba(0, 0, 0, 0.04)',
                                borderColor: '#000'
                            } : {}
                        }}
                    >
                        {isCompleted ? (
                            <CheckIcon sx={{ color: 'white', fontSize: '1.8rem' }} />
                        ) : (
                            <Typography sx={{
                                fontSize: '1.6rem',
                                fontWeight: 600,
                                color: '#333'
                            }}>
                                {stepNumber}
                            </Typography>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};

export default BlindBoxProgressIndicator;
