// /src/components/subscription/quantityInput.jsx
import React from 'react';
import { Box, IconButton, TextField } from '@mui/material';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

const QuantityInput = ({ value, onChange }) => {
    const handleIncrement = () => {
        onChange(value + 1);
    };

    const handleDecrement = () => {
        onChange(value > 1 ? value - 1 : 1);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                border: '1px solid #ccc',
                borderRadius: 1,
                width: 'fit-content'
            }}
        >
            <IconButton onClick={handleDecrement} disabled={value === 1}>
                <RemoveCircleOutlineIcon />
            </IconButton>
            <TextField
                value={value}
                variant="standard"
                InputProps={{
                    disableUnderline: true,
                    readOnly: true,
                    sx: { '& input': { textAlign: 'center', width: '40px' } },
                }}
            />
            <IconButton onClick={handleIncrement}>
                <AddCircleOutlineIcon />
            </IconButton>
        </Box>
    );
};

export default QuantityInput;