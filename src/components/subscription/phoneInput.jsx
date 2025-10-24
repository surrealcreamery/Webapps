// /src/components/subscription/phoneInput.jsx
import React from 'react';
import PhoneInput from 'react-phone-number-input/input';
import 'react-phone-number-input/style.css';

const PhoneInputComponent = React.forwardRef(function PhoneInputComponent(props, ref) {
    const { onChange, ...other } = props;
    return (
        <PhoneInput
            {...other}
            ref={ref}
            onChange={(value) => {
                onChange({
                    target: {
                        name: props.name,
                        value: value || '',
                    },
                });
            }}
            country="US"
            international={false}
        />
    );
});

export default PhoneInputComponent;