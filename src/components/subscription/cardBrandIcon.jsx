// /src/components/subscription/cardBrandIcon.jsx
import React from 'react';
import { Visa, Mastercard, Amex, Discover, DinersClub, Jcb } from 'react-payment-logos/dist/flat';
import CreditCardIcon from '@mui/icons-material/CreditCard';

const CardBrandIcon = React.memo(({ brand }) => {
    const IconComponentMap = {
        'VISA': Visa,
        'MASTERCARD': Mastercard,
        'AMERICAN_EXPRESS': Amex,
        'DISCOVER': Discover,
        'DINERS_CLUB': DinersClub,
        'JCB': Jcb,
    };
    const Component = IconComponentMap[brand?.toUpperCase()];
    const iconStyle = {
        width: 40,
        height: 25,
        borderRadius: '5px'
    };
    return Component ? <Component style={iconStyle} /> : <CreditCardIcon />;
});

export default CardBrandIcon;