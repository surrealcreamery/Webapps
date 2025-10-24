import React from 'react';
import { AsYouType } from 'libphonenumber-js';

// ✅ FIX: This component now correctly renders a standard input,
// allowing the parent TextField to style it correctly.
export const PhoneInputComponent = React.forwardRef((props, ref) => {
    const { onChange, ...other } = props;

    const handleChange = (event) => {
        const formatter = new AsYouType('US');
        const formatted = formatter.input(event.target.value);
        // Create a synthetic event to pass the formatted value up
        const syntheticEvent = {
            target: {
                name: props.name,
                value: formatted,
            },
        };
        onChange(syntheticEvent);
    };

    return <input {...other} ref={ref} onChange={handleChange} />;
});

