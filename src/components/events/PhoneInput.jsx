import React from 'react';
import PhoneInput from 'react-phone-number-input/input';
import 'react-phone-number-input/style.css';

// Use 'export const' to create a named export
export const PhoneInputComponent = React.forwardRef(function PhoneInputComponent(props, ref) {
    const { onChange, ...other } = props;
    return (
        <PhoneInput
            {...other}
            ref={ref}
            onChange={(value) => {
                // Ensure onChange is called with a consistent event-like object
                onChange({ target: { name: props.name, value: value || '' } });
            }}
            country="US"
            international={false}
        />
    );
});
