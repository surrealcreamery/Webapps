import React, { useState } from 'react';
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
 import { trackFooterLinkClicked, trackSocialLinkClicked, trackFooterModalClosed } from '@/services/analytics';

 const Footer = () => {
     const [openModal, setOpenModal] = useState(null);
     const tableSx = { width: '100%', borderCollapse: 'collapse', mb: 2, '& td, & th': { border: '1px solid #ddd', p: 1, fontSize: '1.6rem', textAlign: 'left', verticalAlign: 'top' }, '& th': { bgcolor: '#f5f5f5', fontWeight: 600 } };

     const handleOpenModal = (modalName) => {
         trackFooterLinkClicked(modalName);
         setOpenModal(modalName);
     };

     const handleCloseModal = () => {
         if (openModal) trackFooterModalClosed(openModal);
         setOpenModal(null);
     };


     return (
         <>
             <Box
                 component="footer"
                 sx={{
                     py: 3,
                     px: 2,
                     mt: 'auto',
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
                             onClick={() => handleOpenModal('accessibility')}
                             color="text.primary"
                             underline="hover"
                         >
                             Accessibility Statement
                         </Link>
                         <Link
                             component="button"
                             variant="body1"
                             onClick={() => handleOpenModal('terms')}
                             color="text.primary"
                             underline="hover"
                         >
                             Terms & Conditions
                         </Link>
                         <Link
                             component="button"
                             variant="body1"
                             onClick={() => handleOpenModal('privacy')}
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
                            Surreal Creamery Catering is fully conformant with <b>WCAG 2.1 Level AA</b>. Fully conformant means that the content fully meets the accessibility standard without any exceptions.
                         </Typography>
                         <Typography paragraph sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
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
                         <Typography paragraph>
                            Surreal Creamery takes the following measures to ensure accessibility on the Catering page, organized by WCAG principle:
                         </Typography>

                         <Typography variant="h4" component="h3" sx={{ mt: 3, mb: 1 }}>
                            1. Perceivable
                         </Typography>

                         <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1 }}>
                            1.1 Text Alternatives (SC 1.1.1)
                         </Typography>
                         <Box component="table" sx={tableSx}>
                            <thead><tr><th>Technique</th><th>Implementation</th></tr></thead>
                            <tbody>
                               <tr><td>H25</td><td>Page title: "Catering | Surreal Creamery"</td></tr>
                               <tr><td>H25</td><td>Page description provided for search engines and assistive technologies</td></tr>
                            </tbody>
                         </Box>

                         <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1 }}>
                            1.2 Time-based Media
                         </Typography>
                         <Typography paragraph>Not applicable.</Typography>

                         <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1 }}>
                            1.3 Adaptable (SC 1.3.1)
                         </Typography>
                         <Box component="table" sx={tableSx}>
                            <thead><tr><th>Technique</th><th>Implementation</th></tr></thead>
                            <tbody>
                               <tr><td>H42</td><td>Visually-hidden heading: "Catering Menu"</td></tr>
                               <tr><td>G140</td><td>Max-width container for responsive reflow</td></tr>
                            </tbody>
                         </Box>

                         <Typography variant="h4" component="h3" sx={{ mt: 3, mb: 1 }}>
                            2. Operable
                         </Typography>

                         <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1 }}>
                            2.1 Keyboard Accessible (SC 2.1.1)
                         </Typography>
                         <Typography paragraph>All interactive elements are keyboard-accessible. No keyboard traps.</Typography>

                         <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1 }}>
                            2.2 Enough Time
                         </Typography>
                         <Typography paragraph>Not applicable.</Typography>

                         <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1 }}>
                            2.3 Seizures
                         </Typography>
                         <Typography paragraph>Not applicable.</Typography>

                         <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1 }}>
                            2.4 Navigable (SC 2.4.1, 2.4.2)
                         </Typography>
                         <Box component="table" sx={tableSx}>
                            <thead><tr><th>Technique</th><th>Implementation</th></tr></thead>
                            <tbody>
                               <tr><td>G1</td><td>Page title: "Catering | Surreal Creamery"</td></tr>
                               <tr><td>H42</td><td>Visually-hidden page heading for screen readers</td></tr>
                               <tr><td>ARIA1</td><td>Loading states announced to screen readers via live region</td></tr>
                               <tr><td>ARIA19</td><td>Error messages announced immediately to screen readers</td></tr>
                               <tr><td>H49</td><td>Main content landmark on page container</td></tr>
                            </tbody>
                         </Box>

                         <Typography variant="h4" component="h3" sx={{ mt: 3, mb: 1 }}>
                            3. Understandable
                         </Typography>

                         <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1 }}>
                            3.1 Readable
                         </Typography>
                         <Typography paragraph>Loading messages in plain English.</Typography>

                         <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1 }}>
                            3.2 Predictable (SC 3.2.1)
                         </Typography>
                         <Box component="table" sx={tableSx}>
                            <thead><tr><th>Technique</th><th>Implementation</th></tr></thead>
                            <tbody>
                               <tr><td>G61</td><td>Predictable sequential catering flow</td></tr>
                            </tbody>
                         </Box>

                         <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1 }}>
                            3.3 Input Assistance
                         </Typography>
                         <Typography paragraph>Validation errors displayed inline; critical errors announced to screen readers.</Typography>

                         <Typography variant="h4" component="h3" sx={{ mt: 3, mb: 1 }}>
                            4. Robust
                         </Typography>

                         <Typography variant="h5" component="h4" sx={{ mt: 2, mb: 1 }}>
                            4.1 Compatible (SC 4.1.1)
                         </Typography>
                         <Box component="table" sx={tableSx}>
                            <thead><tr><th>Technique</th><th>Implementation</th></tr></thead>
                            <tbody>
                               <tr><td>H88</td><td>Valid, well-formed HTML markup</td></tr>
                               <tr><td>ARIA5</td><td>Loading and error states communicated to assistive technologies</td></tr>
                            </tbody>
                         </Box>
                         <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '32px !important' }}>
                            Technical Specifications
                         </Typography>
                         <Typography paragraph>
                            Accessibility of Surreal Creamery Catering relies on the following technologies:
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

             {/* Terms & Conditions Dialog */}
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
                        {/* ✅ TERMS AND CONDITIONS UPDATED */}
                         <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>1. Eligibility</Typography>
                         <Typography paragraph>Fundraisers, Ice Cream Socials or all other Events requests must be submitted by an authorized representative of a verified organization (e.g., school, club, non-profit, team, or community group).</Typography>
                         <Typography paragraph>The hosting organization must be based in the United States and have an active EIN or school/club verification if applicable.</Typography>
                         <Typography paragraph>We reserve the right to approve or deny event requests at our discretion.</Typography>

                         <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>2. Event Approval</Typography>
                         <Typography paragraph>All event requests are subject to review and approval by Surreal Creamery.</Typography>
                         <Typography paragraph>Approval confirmation will be sent via email and on the website once all details are finalized.</Typography>
                         <Typography paragraph>We may require additional information before confirming your event.</Typography>
                         <Typography paragraph>Event times and dates are not guaranteed until officially confirmed in writing.</Typography>

                         <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>3. Fundraiser Structure</Typography>
                         <Typography paragraph>Approved organizations will receive 10% of net sales generated from customers who participate during their event.</Typography>
                         <Typography paragraph>Optional bonuses (such as matching donations or seasonal incentives) will be stated in your event confirmation email & marketing materials provided.</Typography>
                         <Typography paragraph>Event proceeds apply only to in-store sales at the designated location and within the event’s scheduled time. Online orders, delivery, or third-party app sales are typically excluded unless explicitly stated otherwise.</Typography>
                         
                         <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>4. Gift Card & Incentive Policy</Typography>
                         <Typography paragraph>From time to time, we may offer additional incentives (e.g., a $25 gift card for fundraising goals).</Typography>
                         <Typography paragraph>These incentives are subject to availability and may change without prior notice.</Typography>
                         <Typography paragraph>Gift cards may be used for future raffles, giveaways, or as directed by the organization.</Typography>

                         <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>5. Payouts</Typography>
                         <Typography paragraph>Fundraising payouts will be calculated within 10–14 business days after the event concludes.</Typography>
                         <Typography paragraph>Organizations will be contacted to confirm payout preferences (e.g., electronic transfer or check).</Typography>
                         <Typography paragraph>Failure to provide payout details within 90 days of notification may result in forfeiture of funds.</Typography>
                         
                         <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>6. Event Promotion</Typography>
                         <Typography paragraph>Surreal Creamery may promote your event on our website or social media channels.</Typography>
                         <Typography paragraph>The organization is encouraged to share promotional materials provided by us.</Typography>
                         <Typography paragraph>Promotional content must not misrepresent Surreal Creamery or imply endorsements beyond the scope of the event.</Typography>
                         
                         <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>7. Cancellations & Rescheduling</Typography>
                         <Typography paragraph>Organizations must notify us at least 7 days prior to cancel or reschedule.</Typography>
                         <Typography paragraph>Repeated cancellations may affect eligibility for future fundraisers or events.</Typography>
                         <Typography paragraph>We reserve the right to cancel or reschedule an event due to unforeseen circumstances (e.g., weather, store closures, emergencies).</Typography>
                         
                         <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>8. Conduct & Responsibility</Typography>
                         <Typography paragraph>All participants must adhere to store policies and maintain a respectful environment.</Typography>
                         <Typography paragraph>The organization is responsible for its members’ conduct during the event.</Typography>
                         <Typography paragraph>Any damage, disturbance, or violation of store policies may result in immediate termination of the event and forfeiture of proceeds.</Typography>

                         <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>9. Use of Data</Typography>
                         <Typography paragraph>Information collected through the event request form (such as contact info or organization details) will be used solely for event coordination.</Typography>
                         <Typography paragraph>We will not share or sell your information to third parties, except as necessary to process payments or comply with the law.</Typography>
                         
                         <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>10. Limitation of Liability</Typography>
                         <Typography paragraph>Surreal Creamery is not liable for any loss, damage, or injury incurred during or related to the event.</Typography>
                         <Typography paragraph>By participating, the organization agrees to hold harmless and indemnify Surreal Creamery from all claims or liabilities arising from the event.</Typography>
                         
                         <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>11. Policy Changes</Typography>
                         <Typography paragraph>Surreal Creamery reserves the right to modify or update these Terms & Conditions at any time without prior notice.</Typography>
                         <Typography paragraph>The most current version will always be available on our website.</Typography>

                         <Typography variant="h3" component="h2" sx={{ mt: 3, mb: '24px !important' }}>12. Agreement</Typography>
                         <Typography paragraph>By submitting an Ice Cream Social or Fundraiser request, you acknowledge that you have read, understood, and agreed to these Terms & Conditions on behalf of your organization.</Typography>
                     </Container>
                 </DialogContent>
             </Dialog>

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
                            Last updated: September 11, 2025
                         </Typography>

                         {/* ✅ PRIVACY POLICY UPDATED */}
                         <Typography paragraph>
                            By requesting to host an Event at Surreal Creamery & providing your mobile number, you agree that Surreal Creamery may send you SMS or MMS messages to receive containing but not limited to important information, updates, deals, and specials.
                         </Typography>

                         <ul>
                            <li><Typography paragraph sx={{ mb: 1 }}>Message frequency may vary.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>You may unsubscribe at any time by texting the word STOP to (833) 321-0163. You may receive a subsequent message confirming your opt-out request.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>For help, send the word HELP to (833) 321-0163.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Message and data rates may apply.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>United States Participating Carriers Include AT&T, T-Mobile®, Verizon Wireless, Sprint, Boost, U.S. Cellular®, MetroPCS®, InterOp, Cellcom, C Spire Wireless, Cricket, Virgin Mobile and others.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>T-Mobile is not liable for delayed or undelivered messages.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>You agree to notify us of any changes to your mobile number and update your account with us to reflect this change.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>Data obtained from you in connection with this SMS service may include your cell phone number, your carrier’s name, and the date, time and content of your messages, as well as other information that you provide. We may use this information to contact you and to provide the services you request from us.</Typography></li>
                            <li><Typography paragraph sx={{ mb: 1 }}>By subscribing or otherwise using the service, you acknowledge and agree that we will have the right to change and/or terminate the service at any time, with or without cause and/or advance notice.</Typography></li>
                         </ul>

                         <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>Will I be charged for the text messages I receive?</Typography>
                         <Typography paragraph>
                             Though Surreal Creamery will never charge you for the text messages you receive, depending on your phone plan, you may see some charges from your mobile provider. Please reach out to your wireless provider if you have questions about your text or data plan.
                         </Typography>

                         <Typography variant="h3" component="h2" sx={{ mt: 4, mb: '24px !important' }}>Data Sharing Policy</Typography>
                         <Typography paragraph>
                            No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
                         </Typography>

                         <Typography paragraph sx={{ mt: 4 }}>
                             If you have any questions please contact Surreal Creamery at (646) 455-0093.
                         </Typography>

                     </Container>
                 </DialogContent>
             </Dialog>
         </>
     );
 };

 export default Footer;

