import React, { useState, useRef } from 'react';
import { Box, TextField } from '@mui/material';

const OtpInput = ({ onCodeChange }) => {
    const refs = useRef([]);
    const [code, setCode] = useState(new Array(6).fill(''));

    const handleChange = (e, index) => {
        const val = e.target.value;
        // Only allow a single digit
        if (!/^[0-9]$/.test(val) && val !== '') return;

        const newCode = [...code];
        newCode[index] = val;
        setCode(newCode);
        onCodeChange(newCode.join(''));

        // Focus next input if a digit was entered
        if (val !== '' && index < 5) {
            refs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e, index) => {
        // Focus previous input on backspace if current input is empty
        if (e.key === 'Backspace' && code[index] === '' && index > 0) {
            refs.current[index - 1]?.focus();
        }
    };

    return (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            {code.map((digit, i) => (
                <TextField 
                    key={i} 
                    inputRef={el => (refs.current[i] = el)} 
                    value={digit}
                    onChange={e => handleChange(e, i)} 
                    onKeyDown={e => handleKeyDown(e, i)}
                    inputProps={{ 
                        maxLength: 1, 
                        style: { textAlign: 'center' } 
                    }} 
                    sx={{ width: '45px' }}
                />
            ))}
        </Box>
    );
};

export default OtpInput;