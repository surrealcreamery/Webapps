// src/pages/PrivacyPage.jsx
// Standalone page for /privacy — same content as footer dialog, linkable from emails

import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';

export default function PrivacyPage() {
    return (
        <Box sx={{ py: 4 }}>
            <Helmet>
                <title>Privacy Policy – Surreal Creamery</title>
            </Helmet>
            <Container maxWidth="md">
                <Typography variant="h1" component="h1" sx={{ mb: 3 }}>
                    Privacy Policy
                </Typography>
                <Typography paragraph>
                    Last updated: May 6, 2026
                </Typography>

                <Typography paragraph>
                    Surreal Creamery ("we," "us," or "our") operates the website surrealcreamery.com and related subdomains (collectively, the "Site"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our Site, place an order, use our subscription services, attend our events, or otherwise interact with us.
                </Typography>
                <Typography paragraph>
                    By using the Site, you consent to the practices described in this policy. If you do not agree, please discontinue use of the Site.
                </Typography>

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

                <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>3. Cookies & Tracking Technologies</Typography>
                <Typography paragraph>We use the following technologies to collect usage data and improve your experience:</Typography>
                <ul>
                    <li><Typography paragraph sx={{ mb: 1 }}><b>Analytics tools</b> — Collect anonymized usage data such as page views, session duration, and user interactions to help us improve the Site.</Typography></li>
                    <li><Typography paragraph sx={{ mb: 1 }}><b>Local Storage & Session Storage</b> — Used to store your shopping cart, user preferences, and marketing attribution data locally on your device. This data is not transmitted to third parties.</Typography></li>
                </ul>
                <Typography paragraph>
                    Most web browsers allow you to control cookies through their settings. Disabling cookies may affect your ability to use certain features of the Site, such as maintaining items in your cart.
                </Typography>

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

                <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>5. Data Sharing</Typography>
                <Typography paragraph>We may share your information only in the following circumstances:</Typography>
                <ul>
                    <li><Typography paragraph sx={{ mb: 1 }}>With service providers who assist in operating our business (as described above)</Typography></li>
                    <li><Typography paragraph sx={{ mb: 1 }}>To comply with applicable laws, regulations, or legal processes</Typography></li>
                    <li><Typography paragraph sx={{ mb: 1 }}>To protect the rights, property, or safety of Surreal Creamery, our customers, or others</Typography></li>
                    <li><Typography paragraph sx={{ mb: 1 }}>In connection with a merger, acquisition, or sale of assets (you will be notified of any such change)</Typography></li>
                </ul>

                <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>6. Data Retention</Typography>
                <Typography paragraph>
                    We retain your personal information for as long as necessary to fulfill the purposes described in this policy, including to satisfy legal, accounting, or reporting requirements. Order records are retained for a minimum of 3 years for tax and compliance purposes. You may request deletion of your data at any time (see Your Rights below).
                </Typography>

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

                <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>9. Children's Privacy</Typography>
                <Typography paragraph>
                    Our Site is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately at privacy@surrealcreamery.com and we will promptly delete it.
                </Typography>

                <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>10. Security</Typography>
                <Typography paragraph>
                    We implement industry-standard security measures to protect your personal information, including HTTPS encryption for all data in transit, secure cloud infrastructure, and restricted access controls. Payment information is processed by PCI-compliant third-party providers and is never stored on our servers. However, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
                </Typography>

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

                <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>12. Changes to This Policy</Typography>
                <Typography paragraph>
                    We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date at the top of this page. We encourage you to review this policy periodically. Continued use of the Site after changes constitutes acceptance of the updated policy.
                </Typography>

                <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>13. Contact Us</Typography>
                <Typography paragraph>If you have any questions about this Privacy Policy or our data practices, please contact us:</Typography>
                <ul>
                    <li><Typography paragraph sx={{ mb: 1 }}><b>Email:</b> privacy@surrealcreamery.com</Typography></li>
                    <li><Typography paragraph sx={{ mb: 1 }}><b>Phone:</b> (646) 455-0093</Typography></li>
                    <li><Typography paragraph sx={{ mb: 1 }}><b>Address:</b> Surreal Creamery, New York, NY</Typography></li>
                </ul>
            </Container>
        </Box>
    );
}
