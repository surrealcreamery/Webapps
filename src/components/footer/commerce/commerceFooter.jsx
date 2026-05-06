import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Box,
    Container,
    Link,
    IconButton,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    Typography
} from '@mui/material';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookIcon from '@mui/icons-material/Facebook';
import CloseIcon from '@mui/icons-material/Close';
import { trackFooterLinkClicked, trackSocialLinkClicked } from '@/services/analytics';

const tableSx = { width: '100%', borderCollapse: 'collapse', mb: 2, '& td, & th': { border: '1px solid #ddd', p: 1, fontSize: '1.6rem', textAlign: 'left', verticalAlign: 'top' }, '& th': { bgcolor: '#f5f5f5', fontWeight: 600 } };

const Footer = () => {
    const [openModal, setOpenModal] = useState(null);
    const location = useLocation();
    const isCateringMode = location.pathname.startsWith('/catering');

    const handleOpenModal = (modalName) => {
        setOpenModal(modalName);
    };

    const handleCloseModal = () => {
        setOpenModal(null);
    };


    return (
        <>
            <Box
                component="footer"
                sx={{
                    py: 3,
                    px: 2,
                    boxShadow: (theme) => `0 100dvh 0 100dvh ${theme.palette.grey[200]}`,
                    backgroundColor: (theme) =>
                        theme.palette.mode === 'light'
                            ? theme.palette.grey[200]
                            : theme.palette.grey[800],
                }}
            >
                <Container
                    maxWidth="sm"
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}
                >
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <Link
                            component="button"
                            variant="body1"
                            onClick={() => { trackFooterLinkClicked('accessibility'); handleOpenModal('accessibility'); }}
                            color="text.primary"
                            underline="hover"
                        >
                            Accessibility Statement
                        </Link>
                        {isCateringMode && (
                            <Link
                                component="button"
                                variant="body1"
                                onClick={() => { trackFooterLinkClicked('terms'); handleOpenModal('terms'); }}
                                color="text.secondary"
                                underline="hover"
                            >
                                Terms & Conditions
                            </Link>
                        )}
                        <Link
                            component="button"
                            variant="body1"
                            onClick={() => { trackFooterLinkClicked('privacy'); handleOpenModal('privacy'); }}
                            color="text.primary"
                            underline="hover"
                        >
                            Privacy Policy
                        </Link>
                    </Box>

                    <Divider sx={{ my: 2, width: '50%' }} />

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                            aria-label="Instagram"
                            href="https://www.instagram.com/surrealcreamery/"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackSocialLinkClicked('instagram')}
                            sx={{ color: 'text.secondary' }}
                        >
                            <InstagramIcon sx={{ width: 45, height: 45 }} />
                        </IconButton>
                        <IconButton
                            aria-label="Facebook"
                            href="https://www.facebook.com/surrealcreamery/"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackSocialLinkClicked('facebook')}
                            sx={{ color: 'text.secondary' }}
                        >
                            <FacebookIcon sx={{ width: 45, height: 45 }} />
                        </IconButton>
                    </Box>
                </Container>
            </Box>

            {/* Accessibility Statement Dialog */}
            <Dialog
                fullScreen
                open={openModal === 'accessibility'}
                onClose={handleCloseModal}
                aria-labelledby="accessibility-dialog-title"
                sx={{ '& .MuiDialog-paper': { display: 'flex', flexDirection: 'column', maxHeight: '100vh' }}}
            >
                <DialogTitle sx={{ bgcolor: 'black', color: 'white', m: 0, p: 2, flexShrink: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography id="accessibility-dialog-title" variant="h1" component="h1">
                            Accessibility Statement
                        </Typography>
                        <IconButton aria-label="close" onClick={handleCloseModal} sx={{ color: 'white' }}>
                            <CloseIcon sx={{ width: 45, height: 45 }} />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent dividers sx={{ flexGrow: 1, p: { xs: 2, sm: 3, md: 4 } }}>
                    <Container maxWidth="md">
                        <Typography paragraph sx={{ mt: 2 }}>
                            Surreal Creamery is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply the relevant accessibility standards.
                        </Typography>
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '32px !important' }}>
                            Conformance Status
                        </Typography>
                        <Typography paragraph>
                            The Web Content Accessibility Guidelines (WCAG) defines requirements for designers and developers to improve accessibility for people with disabilities. It defines three levels of conformance: Level A, Level AA, and Level AAA.
                        </Typography>
                        <Typography paragraph>
                            Surreal Creamery is fully conformant with <b>WCAG 2.1 Level AA</b>. Fully conformant means that the content fully meets the accessibility standard without any exceptions.
                        </Typography>
                        <Typography paragraph sx={{ color: 'text.secondary', fontSize: '1.6rem' }}>
                            Assessment date: May 4, 2026
                        </Typography>
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '32px !important' }}>
                            Feedback
                        </Typography>
                        <Typography paragraph>
                            We welcome your feedback on the accessibility of Surreal Creamery. Please let us know if you encounter accessibility barriers:
                        </Typography>
                        <ul>
                            <li><Typography><b>Phone:</b> 917-539-9700</Typography></li>
                            <li><Typography><b>E-mail:</b> accessibility@surrealcreamery.com</Typography></li>
                        </ul>
                        <Typography paragraph>
                            We try to respond to feedback within 5 business days.
                        </Typography>
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '32px !important' }}>
                            Accessibility Assessment
                        </Typography>

                        <Typography variant="h4" component="h3" sx={{ mt: 3, mb: 1, fontSize: '1.8rem', fontWeight: 600 }}>
                            1. Perceivable
                        </Typography>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            1.1 Text Alternatives (SC 1.1.1)
                        </Typography>
                        <Box component="table" sx={tableSx}>
                            <thead>
                                <tr><th>Technique</th><th>Implementation</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>H37</td><td>Product images use the product name as alternative text</td></tr>
                                <tr><td>H37</td><td>Thumbnails have sequentially numbered alternative text</td></tr>
                                <tr><td>H37</td><td>Make-your-own selection images use the item name as alternative text</td></tr>
                                <tr><td>H37</td><td>Modifier option images use the option name as alternative text</td></tr>
                                <tr><td>ARIA14</td><td>Product cards announce "View product" followed by the product name</td></tr>
                                <tr><td>ARIA14</td><td>Loading spinners in Add to Cart buttons announce "Adding to cart"</td></tr>
                            </tbody>
                        </Box>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            1.2 Time-based Media
                        </Typography>
                        <Typography paragraph sx={{ fontStyle: 'italic' }}>Not applicable — no audio or video content.</Typography>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            1.3 Adaptable (SC 1.3.1, 1.3.2, 1.3.3)
                        </Typography>
                        <Box component="table" sx={tableSx}>
                            <thead>
                                <tr><th>Technique</th><th>Implementation</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>H42</td><td>Product title rendered as top-level heading</td></tr>
                                <tr><td>H42</td><td>Sub-category groups use proper heading hierarchy</td></tr>
                                <tr><td>G140</td><td>Grid layout preserves visual and reading order</td></tr>
                                <tr><td>ARIA14</td><td>Product cards identified as interactive with descriptive labels</td></tr>
                                <tr><td>ARIA19</td><td>Quantity changes announced to screen readers automatically</td></tr>
                            </tbody>
                        </Box>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            1.4 Distinguishable (SC 1.4.1, 1.4.3, 1.4.11)
                        </Typography>
                        <Box component="table" sx={tableSx}>
                            <thead>
                                <tr><th>Technique</th><th>Implementation</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>G18/G145</td><td>Dynamic text color ensures minimum 4.5:1 contrast against all backgrounds</td></tr>
                                <tr><td>G178</td><td>Visible focus indicator (blue outline) on all interactive elements</td></tr>
                                <tr><td>C22</td><td>Font sizes use relative units throughout</td></tr>
                                <tr><td>ARIA7</td><td>Decorative emoji icons hidden from screen readers</td></tr>
                            </tbody>
                        </Box>

                        <Typography variant="h4" component="h3" sx={{ mt: 3, mb: 1, fontSize: '1.8rem', fontWeight: 600 }}>
                            2. Operable
                        </Typography>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            2.1 Keyboard Accessible (SC 2.1.1, 2.1.2)
                        </Typography>
                        <Box component="table" sx={tableSx}>
                            <thead>
                                <tr><th>Technique</th><th>Implementation</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>G202/SCR20</td><td>All interactive elements respond to Enter and Space keys</td></tr>
                                <tr><td>H91</td><td>Native button elements used for close, add-to-cart, and quantity controls</td></tr>
                            </tbody>
                        </Box>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            2.2 Enough Time
                        </Typography>
                        <Typography paragraph sx={{ fontStyle: 'italic' }}>Not applicable — no time-limited interactions.</Typography>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            2.3 Seizures (SC 2.3.1)
                        </Typography>
                        <Box component="table" sx={tableSx}>
                            <thead>
                                <tr><th>Technique</th><th>Implementation</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>G19</td><td>Framer Motion animations use short durations (0.25-0.4s), smooth transitions</td></tr>
                            </tbody>
                        </Box>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            2.4 Navigable (SC 2.4.1, 2.4.2, 2.4.6)
                        </Typography>
                        <Box component="table" sx={tableSx}>
                            <thead>
                                <tr><th>Technique</th><th>Implementation</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>H69</td><td>Product title rendered as h1 at beginning of detail view</td></tr>
                            </tbody>
                        </Box>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            2.5 Input Modalities (SC 2.5.1)
                        </Typography>
                        <Box component="table" sx={tableSx}>
                            <thead>
                                <tr><th>Technique</th><th>Implementation</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>H91</td><td>Visible expand/collapse IconButton as alternative to scroll-driven gesture</td></tr>
                            </tbody>
                        </Box>

                        <Typography variant="h4" component="h3" sx={{ mt: 3, mb: 1, fontSize: '1.8rem', fontWeight: 600 }}>
                            3. Understandable
                        </Typography>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            3.1 Readable (SC 3.1.1)
                        </Typography>
                        <Typography paragraph>Text content uses plain language; prices formatted consistently.</Typography>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            3.2 Predictable (SC 3.2.1, 3.2.3)
                        </Typography>
                        <Box component="table" sx={tableSx}>
                            <thead>
                                <tr><th>Technique</th><th>Implementation</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>G61</td><td>Product cards consistently navigate to detail on click/enter/space</td></tr>
                            </tbody>
                        </Box>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            3.3 Input Assistance (SC 3.3.1, 3.3.2)
                        </Typography>
                        <Box component="table" sx={tableSx}>
                            <thead>
                                <tr><th>Technique</th><th>Implementation</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>ARIA21</td><td>Variant unavailability uses aria-disabled</td></tr>
                            </tbody>
                        </Box>

                        <Typography variant="h4" component="h3" sx={{ mt: 3, mb: 1, fontSize: '1.8rem', fontWeight: 600 }}>
                            4. Robust
                        </Typography>

                        <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1, fontSize: '1.6rem', fontWeight: 600 }}>
                            4.1 Compatible (SC 4.1.2, 4.1.3)
                        </Typography>
                        <Box component="table" sx={tableSx}>
                            <thead>
                                <tr><th>Technique</th><th>Implementation</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>ARIA16</td><td>aria-label on image expand/collapse button communicating state</td></tr>
                                <tr><td>ARIA4</td><td>Toggle state (pressed/not pressed) conveyed on thumbnails, fulfillment, and location selectors</td></tr>
                                <tr><td>ARIA5</td><td>Disabled state conveyed on unavailable fulfillment methods and variants</td></tr>
                            </tbody>
                        </Box>
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '32px !important' }}>
                            Technical Specifications
                        </Typography>
                        <Typography paragraph>
                            Accessibility of Surreal Creamery relies on the following technologies:
                        </Typography>
                        <ul>
                            <li><Typography>HTML5</Typography></li>
                            <li><Typography>WAI-ARIA 1.2</Typography></li>
                            <li><Typography>CSS3</Typography></li>
                            <li><Typography>JavaScript (React 18)</Typography></li>
                        </ul>
                        <Typography paragraph sx={{ mt: 2 }}>
                            These technologies are relied upon for conformance with the accessibility standards used.
                        </Typography>
                    </Container>
                </DialogContent>
            </Dialog>

            {/* Terms & Conditions Dialog (Catering) */}
            {isCateringMode && (
                <Dialog
                    fullScreen
                    open={openModal === 'terms'}
                    onClose={handleCloseModal}
                    aria-labelledby="terms-dialog-title"
                    sx={{ '& .MuiDialog-paper': { display: 'flex', flexDirection: 'column', maxHeight: '100vh' }}}
                >
                    <DialogTitle sx={{ bgcolor: 'black', color: 'white', m: 0, p: 2, flexShrink: 0 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography id="terms-dialog-title" variant="h1" component="h1">
                                Terms & Conditions
                            </Typography>
                            <IconButton aria-label="close" onClick={handleCloseModal} sx={{ color: 'white' }}>
                                <CloseIcon sx={{ width: 45, height: 45 }} />
                            </IconButton>
                        </Box>
                    </DialogTitle>
                    <DialogContent dividers sx={{ flexGrow: 1, p: { xs: 2, sm: 3, md: 4 } }}>
                        <Container maxWidth="md">
                            <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>1. Order Minimums & Pricing</Typography>
                            <Typography paragraph>All catering orders are subject to minimum order requirements which vary by product category.</Typography>
                            <Typography paragraph>Prices are subject to change without notice. The price at the time of order confirmation will be honored.</Typography>

                            <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>2. Order Lead Time</Typography>
                            <Typography paragraph>Catering orders require a minimum of 48 hours advance notice.</Typography>
                            <Typography paragraph>Large orders or orders during peak seasons may require additional lead time.</Typography>
                            <Typography paragraph>Rush orders may be accommodated based on availability and may incur additional fees.</Typography>

                            <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>3. Payment</Typography>
                            <Typography paragraph>Full payment is required at the time of order placement.</Typography>
                            <Typography paragraph>We accept all major credit cards and approved corporate accounts.</Typography>

                            <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>4. Cancellations & Modifications</Typography>
                            <Typography paragraph>Cancellations made more than 48 hours before the scheduled pickup/delivery date will receive a full refund.</Typography>
                            <Typography paragraph>Cancellations made within 48 hours may be subject to a cancellation fee.</Typography>
                            <Typography paragraph>Order modifications are subject to availability and must be requested at least 24 hours in advance.</Typography>

                            <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>5. Pickup & Delivery</Typography>
                            <Typography paragraph>Orders must be picked up at the designated time. Orders not picked up within 30 minutes may be forfeited.</Typography>
                            <Typography paragraph>Delivery is available for an additional fee based on distance and order size.</Typography>
                            <Typography paragraph>Customer is responsible for proper storage and handling of products after pickup or delivery.</Typography>

                            <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>6. Product Quality</Typography>
                            <Typography paragraph>All products are made fresh and should be consumed within the recommended timeframe.</Typography>
                            <Typography paragraph>Frozen products must be kept frozen until ready to serve.</Typography>
                            <Typography paragraph>We are not responsible for product quality issues resulting from improper storage or handling.</Typography>

                            <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>7. Allergies & Dietary Restrictions</Typography>
                            <Typography paragraph>Please inform us of any allergies or dietary restrictions at the time of ordering.</Typography>
                            <Typography paragraph>While we take precautions, our facility handles common allergens and cross-contamination may occur.</Typography>

                            <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>8. Limitation of Liability</Typography>
                            <Typography paragraph>Surreal Creamery is not liable for any damages arising from the use of our catering services beyond the cost of the order.</Typography>
                        </Container>
                    </DialogContent>
                </Dialog>
            )}

            {/* Privacy Policy Dialog */}
            <Dialog
                fullScreen
                open={openModal === 'privacy'}
                onClose={handleCloseModal}
                aria-labelledby="privacy-dialog-title"
                sx={{ '& .MuiDialog-paper': { display: 'flex', flexDirection: 'column', maxHeight: '100vh' }}}
            >
                <DialogTitle sx={{ bgcolor: 'black', color: 'white', m: 0, p: 2, flexShrink: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography id="privacy-dialog-title" variant="h1" component="h1">
                            Privacy Policy
                        </Typography>
                        <IconButton aria-label="close" onClick={handleCloseModal} sx={{ color: 'white' }}>
                            <CloseIcon sx={{ width: 45, height: 45 }} />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent dividers sx={{ flexGrow: 1, p: { xs: 2, sm: 3, md: 4 } }}>
                    <Container maxWidth="md">
                        <Typography paragraph sx={{ mt: 2 }}>
                            Last updated: May 6, 2026
                        </Typography>

                        <Typography paragraph>
                            Surreal Creamery ("we," "us," or "our") operates the website surrealcreamery.com and related subdomains (collectively, the "Site"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our Site, place an order, use our subscription services, attend our events, or otherwise interact with us.
                        </Typography>
                        <Typography paragraph>
                            By using the Site, you consent to the practices described in this policy. If you do not agree, please discontinue use of the Site.
                        </Typography>

                        {/* 1. Information We Collect */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>1. Information We Collect</Typography>

                        <Typography variant="h4" component="h3" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>Personal Information You Provide</Typography>
                        <Typography paragraph>When you place an order, create an account, subscribe to a service, register for an event, or contact us, we may collect:</Typography>
                        <ul>
                            <li><Typography paragraph sx={{ mb: 1 }}>Name</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Email address</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Phone number</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Shipping and billing address</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Payment information (processed securely by our payment providers — we do not store full card numbers)</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Order history and product preferences</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Any other information you voluntarily provide (e.g., event inquiries, catering requests, customer support messages)</Typography></li>
                        </ul>

                        <Typography variant="h4" component="h3" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>Information Collected Automatically</Typography>
                        <Typography paragraph>When you visit the Site, we automatically collect certain technical and usage information, including:</Typography>
                        <ul>
                            <li><Typography paragraph sx={{ mb: 1 }}>Device type, browser type, and operating system</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>IP address and approximate geographic location</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Pages visited, time spent on pages, and navigation paths</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Referring URL and search terms</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Campaign attribution data (e.g., UTM parameters, ad click identifiers)</Typography></li>
                        </ul>

                        {/* 2. How We Use Your Information */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>2. How We Use Your Information</Typography>
                        <Typography paragraph>We use the information we collect to:</Typography>
                        <ul>
                            <li><Typography paragraph sx={{ mb: 1 }}>Process and fulfill your orders, subscriptions, and catering requests</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Send order confirmations, shipping updates, and delivery notifications</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Manage your account and provide customer support</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Send promotional communications (with your consent, where required)</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Improve our Site, products, and services</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Analyze usage trends and measure the effectiveness of our marketing campaigns</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Prevent fraud and maintain security</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Comply with legal obligations</Typography></li>
                        </ul>

                        {/* 3. Cookies & Tracking Technologies */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>3. Cookies & Tracking Technologies</Typography>
                        <Typography paragraph>We use the following technologies to collect usage data and improve your experience:</Typography>
                        <ul>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Analytics tools</b> — Collect anonymized usage data such as page views, session duration, and user interactions to help us improve the Site.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Local Storage & Session Storage</b> — Used to store your shopping cart, user preferences, and marketing attribution data locally on your device. This data is not transmitted to third parties.</Typography></li>
                        </ul>
                        <Typography paragraph>
                            Most web browsers allow you to control cookies through their settings. Disabling cookies may affect your ability to use certain features of the Site, such as maintaining items in your cart.
                        </Typography>

                        {/* 4. Third-Party Services */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>4. Third-Party Services</Typography>
                        <Typography paragraph>We work with trusted third-party service providers to operate our business. These providers only receive the information necessary to perform their services:</Typography>
                        <ul>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Payment processors</b> — Securely process online and in-store payment transactions on our behalf.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Shipping and delivery providers</b> — Receive your name and shipping address to fulfill delivery orders.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Email service providers</b> — Send transactional and promotional emails on our behalf.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Cloud hosting providers</b> — Host our Site and store order data securely.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Analytics providers</b> — Help us understand how visitors use our Site to improve the experience.</Typography></li>
                        </ul>
                        <Typography paragraph>
                            We do not sell, rent, or trade your personal information to third parties for their own marketing purposes.
                        </Typography>

                        {/* 5. Data Sharing */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>5. Data Sharing</Typography>
                        <Typography paragraph>We may share your information only in the following circumstances:</Typography>
                        <ul>
                            <li><Typography paragraph sx={{ mb: 1 }}>With service providers who assist in operating our business (as described above)</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>To comply with applicable laws, regulations, or legal processes</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>To protect the rights, property, or safety of Surreal Creamery, our customers, or others</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>In connection with a merger, acquisition, or sale of assets (you will be notified of any such change)</Typography></li>
                        </ul>

                        {/* 6. Data Retention */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>6. Data Retention</Typography>
                        <Typography paragraph>
                            We retain your personal information for as long as necessary to fulfill the purposes described in this policy, including to satisfy legal, accounting, or reporting requirements. Order records are retained for a minimum of 3 years for tax and compliance purposes. You may request deletion of your data at any time (see Your Rights below).
                        </Typography>

                        {/* 7. Your Rights */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>7. Your Rights</Typography>
                        <Typography paragraph>Depending on your location, you may have the following rights regarding your personal information:</Typography>
                        <ul>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Access</b> — Request a copy of the personal data we hold about you.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Correction</b> — Request that we correct inaccurate or incomplete information.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Deletion</b> — Request that we delete your personal information, subject to legal retention requirements.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Opt-out of marketing</b> — Unsubscribe from promotional emails using the link provided in each message, or contact us directly.</Typography></li>
                        </ul>
                        <Typography paragraph>
                            To exercise any of these rights, contact us at privacy@surrealcreamery.com or (646) 455-0093.
                        </Typography>

                        {/* 8. California Privacy Rights (CCPA) */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>8. California Privacy Rights</Typography>
                        <Typography paragraph>
                            If you are a California resident, the California Consumer Privacy Act (CCPA) provides you with additional rights, including:
                        </Typography>
                        <ul>
                            <li><Typography paragraph sx={{ mb: 1 }}>The right to know what personal information we collect, use, and disclose.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>The right to request deletion of your personal information.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>The right to opt out of the sale of personal information. <b>We do not sell personal information.</b></Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>The right to non-discrimination for exercising your privacy rights.</Typography></li>
                        </ul>
                        <Typography paragraph>
                            To submit a CCPA request, email us at privacy@surrealcreamery.com. We will verify your identity before processing your request.
                        </Typography>

                        {/* 9. Children's Privacy */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>9. Children's Privacy</Typography>
                        <Typography paragraph>
                            Our Site is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately at privacy@surrealcreamery.com and we will promptly delete it.
                        </Typography>

                        {/* 10. Security */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>10. Security</Typography>
                        <Typography paragraph>
                            We implement industry-standard security measures to protect your personal information, including HTTPS encryption for all data in transit, secure cloud infrastructure, and restricted access controls. Payment information is processed by PCI-compliant third-party providers and is never stored on our servers. However, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
                        </Typography>

                        {/* 11. SMS / Text Messaging */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>11. SMS / Text Messaging</Typography>
                        <Typography paragraph>
                            By providing your mobile number, you agree that Surreal Creamery may send you SMS or MMS messages containing important information, updates, deals, and specials.
                        </Typography>
                        <ul>
                            <li><Typography paragraph sx={{ mb: 1 }}>Message frequency may vary.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>You may unsubscribe at any time by texting STOP to (833) 321-0163.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>For help, text HELP to (833) 321-0163.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Message and data rates may apply.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Participating carriers include AT&T, T-Mobile, Verizon, Boost Mobile, U.S. Cellular, Cricket Wireless, and others.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Carriers are not liable for delayed or undelivered messages.</Typography></li>
                        </ul>
                        <Typography paragraph>
                            No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Text messaging opt-in data and consent will not be shared with any third parties.
                        </Typography>
                        <Typography paragraph>
                            Surreal Creamery will never charge you for text messages. Depending on your phone plan, you may see charges from your mobile provider.
                        </Typography>

                        {/* 12. Changes to This Policy */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>12. Changes to This Policy</Typography>
                        <Typography paragraph>
                            We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date at the top of this page. We encourage you to review this policy periodically. Continued use of the Site after changes constitutes acceptance of the updated policy.
                        </Typography>

                        {/* 13. Contact Us */}
                        <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>13. Contact Us</Typography>
                        <Typography paragraph>If you have any questions about this Privacy Policy or our data practices, please contact us:</Typography>
                        <ul>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Email:</b> privacy@surrealcreamery.com</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Phone:</b> (646) 455-0093</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}><b>Address:</b> Surreal Creamery, New York, NY</Typography></li>
                        </ul>

                    </Container>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default Footer;
