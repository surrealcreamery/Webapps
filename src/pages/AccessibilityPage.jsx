// src/pages/AccessibilityPage.jsx
// Standalone page for /accessibility — same content as footer dialog, linkable from emails

import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';

const tableSx = { width: '100%', borderCollapse: 'collapse', mb: 2, '& td, & th': { border: '1px solid #ddd', p: 1, fontSize: '1.6rem', textAlign: 'left', verticalAlign: 'top' }, '& th': { bgcolor: '#f5f5f5', fontWeight: 600 } };

export default function AccessibilityPage() {
    return (
        <Box sx={{ py: 4 }}>
            <Helmet>
                <title>Accessibility Statement – Surreal Creamery</title>
            </Helmet>
            <Container maxWidth="md">
                <Typography variant="h1" component="h1" sx={{ mb: 3 }}>
                    Accessibility Statement
                </Typography>
                <Typography paragraph>
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
        </Box>
    );
}
