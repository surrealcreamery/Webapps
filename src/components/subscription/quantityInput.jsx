// /src/components/subscription/quantityInput.jsx
import React from 'react';
import { Box, IconButton, TextField } from '@mui/material';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

const MAX_QUANTITY = 99;

const QuantityInput = ({ value, onChange }) => {
    const handleIncrement = () => {
        if (value < MAX_QUANTITY) onChange(value + 1);
    };

    const handleDecrement = () => {
        onChange(value > 1 ? value - 1 : 1);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleIncrement();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleDecrement();
        }
    };

    return (
        <Box
            role="group"
            aria-label="Quantity selector"
            sx={{
                display: 'flex',
                alignItems: 'center',
                border: '1px solid #767676',
                borderRadius: 1,
                width: 'fit-content'
            }}
        >
            <IconButton onClick={handleDecrement} disabled={value === 1} aria-label="Decrease quantity">
                <RemoveCircleOutlineIcon />
            </IconButton>
            <Box aria-live="polite">
                <TextField
                    value={value}
                    variant="standard"
                    InputProps={{
                        disableUnderline: true,
                        readOnly: true,
                        sx: { '& input': { textAlign: 'center', width: '40px' } },
                    }}
                    inputProps={{
                        'aria-label': 'Quantity',
                        role: 'spinbutton',
                        'aria-valuenow': value,
                        'aria-valuemin': 1,
                        'aria-valuemax': MAX_QUANTITY,
                        onKeyDown: handleKeyDown,
                    }}
                />
            </Box>
            <IconButton onClick={handleIncrement} disabled={value >= MAX_QUANTITY} aria-label="Increase quantity">
                <AddCircleOutlineIcon />
            </IconButton>
        </Box>
    );
};

export default QuantityInput;