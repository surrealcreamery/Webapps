import React, { useEffect, useRef } from 'react';
import {
    Box,
    Typography,
    Button,
    Divider,
    Modal,
    Paper,
    IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// --- Import Drink Images ---
// Iced Milk Teas
import BrownSugar from '@/assets/images/drinks/BrownSugar_Transparent.png';
import EarlGrey from '@/assets/images/drinks/EarlGrey_Transparent.png';
import Matcha from '@/assets/images/drinks/Matcha_Transparent.png';
import Taro from '@/assets/images/drinks/Taro_Transparent.png';
import Thai from '@/assets/images/drinks/Thai_Transparent.png';

// Iced Black & Green Fruit Teas
import LycheeBlack from '@/assets/images/drinks/Lychee_Black_Transparent.png';
import LycheeGreen from '@/assets/images/drinks/Lychee_Green_Transparent.png';
import MangoBlack from '@/assets/images/drinks/Mango_Black_Transparent.png';
import MangoGreen from '@/assets/images/drinks/Mango_Green_Transparent.png';
import PassionfruitBlack from '@/assets/images/drinks/Passionfruit_Black_Transparent.png';
import PassionfruitGreen from '@/assets/images/drinks/Passionfruit_Green_Transparent.png';
import StrawberryBlack from '@/assets/images/drinks/Strawberry_Black_Transparent.png';
import StrawberryGreen from '@/assets/images/drinks/Strawberry_Green_Transparent.png';

// Iced Coffees
import VietCoffee from '@/assets/images/drinks/VietCoffee_Transparent.png';


// --- Drink Data ---
const milkTeas = [
    { name: 'Iced Brown Sugar Milk Tea', image: BrownSugar },
    { name: 'Iced Earl Grey Milk Tea', image: EarlGrey },
    { name: 'Iced Matcha Milk Tea', image: Matcha },
    { name: 'Iced Taro Milk Tea', image: Taro },
    { name: 'Iced Thai Milk Tea', image: Thai },
];

const fruitTeas = [
    { name: 'Iced Lychee Black Tea', image: LycheeBlack },
    { name: 'Iced Lychee Green Tea', image: LycheeGreen },
    { name: 'Iced Mango Black Tea', image: MangoBlack },
    { name: 'Iced Mango Green Tea', image: MangoGreen },
    { name: 'Iced Passionfruit Black Tea', image: PassionfruitBlack },
    { name: 'Iced Passionfruit Green Tea', image: PassionfruitGreen },
    { name: 'Iced Strawberry Black Tea', image: StrawberryBlack },
    { name: 'Iced Strawberry Green Tea', image: StrawberryGreen },
];

const coffees = [
    { name: 'Vietnamese Iced Coffee', image: VietCoffee },
];


// Style for the modal content
const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: { xs: '90%', sm: '80%', md: '600px' }, // Constrain width
    maxHeight: '90vh', // Limit height to 90% of the viewport
    bgcolor: 'background.paper',
    boxShadow: 24,
    borderRadius: 2, // Re-add border radius
    outline: 'none',
    display: 'flex',
    flexDirection: 'column',
};

// Reusable component for rendering a list of drinks using a flexbox layout
const DrinkList = ({ drinks }) => {
    return (
        <Box>
            {drinks && drinks.map((drink, index) => (
                <React.Fragment key={drink.name}>
                    {/* Each drink is a flex container */}
                    <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5, gap: 2 }}>
                        {/* Image container with a fixed width */}
                        <Box sx={{ width: '80px', flexShrink: 0 }}>
                            <Box
                                component="img"
                                src={drink.image}
                                alt={drink.name}
                                sx={{
                                    width: '100%',
                                    height: 'auto',
                                    aspectRatio: '1 / 1',
                                    objectFit: 'contain',
                                }}
                            />
                        </Box>
                        {/* Drink name container that takes up the remaining space */}
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body1">{drink.name}</Typography>
                        </Box>
                    </Box>
                    {/* Divider between items */}
                    {index < drinks.length - 1 && <Divider />}
                </React.Fragment>
            ))}
        </Box>
    );
};

const ViewAllDrinksModal = ({ open, handleClose, section }) => {
    // Refs for each content section to enable scrolling
    const sectionsRef = {
        'iced-milk-teas': useRef(null),
        'iced-coffee': useRef(null),
        'iced-fruit-teas': useRef(null),
    };

    // Helper function to handle scrolling
    const scrollToSection = (sectionId) => {
        if (sectionsRef[sectionId]?.current) {
            sectionsRef[sectionId].current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Effect to scroll to the specified section when the modal opens
    useEffect(() => {
        if (open && section) {
            // Timeout ensures the element is rendered and visible before we try to scroll
            setTimeout(() => {
                scrollToSection(section);
            }, 100);
        }
    }, [open, section]);

    return (
        <Modal
            open={open}
            onClose={handleClose}
            aria-labelledby="view-all-drinks-title"
        >
            <Paper sx={style}>
                {/* --- Header (Static) --- */}
                <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography id="view-all-drinks-title" variant="h1" component="h2">
                            All Drinks
                        </Typography>
                        <IconButton onClick={handleClose} aria-label="Close modal">
                            <CloseIcon sx={{ fontSize: '2rem' }} />
                        </IconButton>
                    </Box>
                </Box>

                {/* --- Content (Scrollable) --- */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 2, sm: 3, md: 4 } }}>
                    {/* Vertical Navigation Links */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, mb: 4 }}>
                        <Button variant="text" onClick={() => scrollToSection('iced-milk-teas')} sx={{ justifyContent: 'flex-start' }}>Iced Milk Teas</Button>
                        <Button variant="text" onClick={() => scrollToSection('iced-coffee')} sx={{ justifyContent: 'flex-start' }}>Iced Coffees</Button>
                        <Button variant="text" onClick={() => scrollToSection('iced-fruit-teas')} sx={{ justifyContent: 'flex-start' }}>Iced Black & Green Fruit Teas</Button>
                    </Box>
                    <Divider sx={{ mb: 4 }} />

                    {/* Iced Milk Teas Section */}
                    <Box id="iced-milk-teas" ref={sectionsRef['iced-milk-teas']} sx={{ mb: 4 }}>
                        <Typography variant="h3" gutterBottom>Iced Milk Teas</Typography>
                        <DrinkList drinks={milkTeas} />
                    </Box>
                    <Divider sx={{ my: 4 }} />
                    {/* Iced Coffee Section */}
                    <Box id="iced-coffee" ref={sectionsRef['iced-coffee']} sx={{ mb: 4 }}>
                        <Typography variant="h3" gutterBottom>Iced Coffees</Typography>
                        <DrinkList drinks={coffees} />
                    </Box>
                    <Divider sx={{ my: 4 }} />
                     {/* Iced Fruit Teas Section */}
                    <Box id="iced-fruit-teas" ref={sectionsRef['iced-fruit-teas']} sx={{ mb: 4 }}>
                        <Typography variant="h3" gutterBottom>Iced Black & Green Fruit Teas</Typography>
                        <DrinkList drinks={fruitTeas} />
                    </Box>
                </Box>
            </Paper>
        </Modal>
    );
};

export default ViewAllDrinksModal;
