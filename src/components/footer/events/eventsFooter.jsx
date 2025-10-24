import React, { useState, useEffect } from 'react';
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

 const Footer = () => {
     const [openModal, setOpenModal] = useState(null);

     const handleOpenModal = (modalName) => {
         setOpenModal(modalName);
     };

     const handleCloseModal = () => {
         setOpenModal(null);
     };

     useEffect(() => {
         const appRoot = document.getElementById('root');
         if (!appRoot) {
             console.error("ACCESSIBILITY FIX FAILED: Could not find the main app root element to apply aria-hidden.");
             return;
         }

         if (openModal !== null) {
             appRoot.setAttribute('aria-hidden', 'true');
         } else {
             appRoot.removeAttribute('aria-hidden');
         }

         return () => {
             appRoot.removeAttribute('aria-hidden');
         };
     }, [openModal]);

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
                             color="text.secondary"
                             underline="hover"
                         >
                             Accessibility Statement
                         </Link>
                         <Link
                             component="button"
                             variant="body1"
                             onClick={() => handleOpenModal('terms')}
                             color="text.secondary"
                             underline="hover"
                         >
                             Terms & Conditions
                         </Link>
                         <Link
                             component="button"
                             variant="body1"
                             onClick={() => handleOpenModal('privacy')}
                             color="text.secondary"
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
                             sx={{ color: 'text.secondary' }}
                         >
                             <InstagramIcon sx={{ width: 45, height: 45 }} />
                         </IconButton>
                         <IconButton
                             aria-label="Facebook"
                             href="https://www.facebook.com/surrealcreamery/"
                             target="_blank"
                             rel="noopener noreferrer"
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
                 sx={{ '& .MuiDialog-paper': { display: 'flex', flexDirection: 'column', maxHeight: '100vh' }}}
             >
                 <DialogTitle sx={{ bgcolor: 'black', color: 'white', m: 0, p: 2, flexShrink: 0 }}>
                     <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Typography variant="h1" component="h1">
                             Accessibility Statement
                         </Typography>
                         <IconButton aria-label="close" onClick={handleCloseModal} sx={{ color: 'white' }}>
                             <CloseIcon sx={{ width: 45, height: 45 }} />
                         </IconButton>
                     </Box>
                 </DialogTitle>
                 <DialogContent dividers sx={{ flexGrow: 1, p: { xs: 2, sm: 3, md: 4 } }}>
                     <Container maxWidth="md">
                        {/* ✅ ACCESSIBILITY STATEMENT UPDATED */}
                         <Typography paragraph sx={{ mt: 2 }}>
                            Surreal Creamery is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.
                         </Typography>
                         <Typography variant="h3" component="h3" sx={{ mt: 4, mb: '32px !important' }}>
                            Conformance Status
                         </Typography>
                         <Typography paragraph>
                            The Web Content Accessibility Guidelines (WCAG) defines requirements for designers and developers to improve accessibility for people with disabilities. It defines three levels of conformance: Level A, Level AA, and Level AAA.
                         </Typography>
                         <Typography paragraph>
                            Surreal Creamery Events is fully conformant with WCAG 2.1 level AAA. Fully conformant means that the content completely conforms to the accessibility standard without any exceptions.
                         </Typography>
                         <Typography variant="h3" component="h3" sx={{ mt: 4, mb: '32px !important' }}>
                            Feedback
                         </Typography>
                         <Typography paragraph>
                            We welcome your feedback on the accessibility of Surreal Creamery Events. Please let us know if you encounter accessibility barriers:
                         </Typography>
                         <ul>
                            <li><Typography><b>Phone:</b> 917-539-9700</Typography></li>
                            <li><Typography><b>E-mail:</b> accessibility@surrealcreamery.com</Typography></li>
                         </ul>
                         <Typography paragraph>
                            We try to respond to feedback within 5 business days.
                         </Typography>
                         <Typography variant="h3" component="h3" sx={{ mt: 4, mb: '32px !important' }}>
                            Technical Specifications
                         </Typography>
                         <Typography paragraph>
                            Accessibility of Surreal Creamery Events relies on the following technologies to work with the particular combination of web browser and any assistive technologies or plugins installed on your computer:
                         </Typography>
                         <ul>
                            <li><Typography>HTML</Typography></li>
                            <li><Typography>WAI-ARIA</Typography></li>
                            <li><Typography>CSS</Typography></li>
                            <li><Typography>JavaScript</Typography></li>
                         </ul>
                     </Container>
                 </DialogContent>
             </Dialog>

             {/* Terms & Conditions Dialog */}
             <Dialog
                 fullScreen
                 open={openModal === 'terms'}
                 onClose={handleCloseModal}
                 sx={{ '& .MuiDialog-paper': { display: 'flex', flexDirection: 'column', maxHeight: '100vh' }}}
             >
                 <DialogTitle sx={{ bgcolor: 'black', color: 'white', m: 0, p: 2, flexShrink: 0 }}>
                     <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Typography variant="h1" component="h1">
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
                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>1. Eligibility</Typography>
                         <Typography paragraph>Fundraisers, Ice Cream Socials or all other Events requests must be submitted by an authorized representative of a verified organization (e.g., school, club, non-profit, team, or community group).</Typography>
                         <Typography paragraph>The hosting organization must be based in the United States and have an active EIN or school/club verification if applicable.</Typography>
                         <Typography paragraph>We reserve the right to approve or deny event requests at our discretion.</Typography>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>2. Event Approval</Typography>
                         <Typography paragraph>All event requests are subject to review and approval by Surreal Creamery.</Typography>
                         <Typography paragraph>Approval confirmation will be sent via email and on the website once all details are finalized.</Typography>
                         <Typography paragraph>We may require additional information before confirming your event.</Typography>
                         <Typography paragraph>Event times and dates are not guaranteed until officially confirmed in writing.</Typography>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>3. Fundraiser Structure</Typography>
                         <Typography paragraph>Approved organizations will receive 10% of net sales generated from customers who participate during their event.</Typography>
                         <Typography paragraph>Optional bonuses (such as matching donations or seasonal incentives) will be stated in your event confirmation email & marketing materials provided.</Typography>
                         <Typography paragraph>Event proceeds apply only to in-store sales at the designated location and within the event’s scheduled time. Online orders, delivery, or third-party app sales are typically excluded unless explicitly stated otherwise.</Typography>
                         
                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>4. Gift Card & Incentive Policy</Typography>
                         <Typography paragraph>From time to time, we may offer additional incentives (e.g., a $25 gift card for fundraising goals).</Typography>
                         <Typography paragraph>These incentives are subject to availability and may change without prior notice.</Typography>
                         <Typography paragraph>Gift cards may be used for future raffles, giveaways, or as directed by the organization.</Typography>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>5. Payouts</Typography>
                         <Typography paragraph>Fundraising payouts will be calculated within 10–14 business days after the event concludes.</Typography>
                         <Typography paragraph>Organizations will be contacted to confirm payout preferences (e.g., electronic transfer or check).</Typography>
                         <Typography paragraph>Failure to provide payout details within 90 days of notification may result in forfeiture of funds.</Typography>
                         
                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>6. Event Promotion</Typography>
                         <Typography paragraph>Surreal Creamery may promote your event on our website or social media channels.</Typography>
                         <Typography paragraph>The organization is encouraged to share promotional materials provided by us.</Typography>
                         <Typography paragraph>Promotional content must not misrepresent Surreal Creamery or imply endorsements beyond the scope of the event.</Typography>
                         
                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>7. Cancellations & Rescheduling</Typography>
                         <Typography paragraph>Organizations must notify us at least 7 days prior to cancel or reschedule.</Typography>
                         <Typography paragraph>Repeated cancellations may affect eligibility for future fundraisers or events.</Typography>
                         <Typography paragraph>We reserve the right to cancel or reschedule an event due to unforeseen circumstances (e.g., weather, store closures, emergencies).</Typography>
                         
                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>8. Conduct & Responsibility</Typography>
                         <Typography paragraph>All participants must adhere to store policies and maintain a respectful environment.</Typography>
                         <Typography paragraph>The organization is responsible for its members’ conduct during the event.</Typography>
                         <Typography paragraph>Any damage, disturbance, or violation of store policies may result in immediate termination of the event and forfeiture of proceeds.</Typography>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>9. Use of Data</Typography>
                         <Typography paragraph>Information collected through the event request form (such as contact info or organization details) will be used solely for event coordination.</Typography>
                         <Typography paragraph>We will not share or sell your information to third parties, except as necessary to process payments or comply with the law.</Typography>
                         
                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>10. Limitation of Liability</Typography>
                         <Typography paragraph>Surreal Creamery is not liable for any loss, damage, or injury incurred during or related to the event.</Typography>
                         <Typography paragraph>By participating, the organization agrees to hold harmless and indemnify Surreal Creamery from all claims or liabilities arising from the event.</Typography>
                         
                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>11. Policy Changes</Typography>
                         <Typography paragraph>Surreal Creamery reserves the right to modify or update these Terms & Conditions at any time without prior notice.</Typography>
                         <Typography paragraph>The most current version will always be available on our website.</Typography>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>12. Agreement</Typography>
                         <Typography paragraph>By submitting an Ice Cream Social or Fundraiser request, you acknowledge that you have read, understood, and agreed to these Terms & Conditions on behalf of your organization.</Typography>
                     </Container>
                 </DialogContent>
             </Dialog>

             {/* Privacy Policy Dialog */}
             <Dialog
                 fullScreen
                 open={openModal === 'privacy'}
                 onClose={handleCloseModal}
                 sx={{ '& .MuiDialog-paper': { display: 'flex', flexDirection: 'column', maxHeight: '100vh' }}}
             >
                 <DialogTitle sx={{ bgcolor: 'black', color: 'white', m: 0, p: 2, flexShrink: 0 }}>
                     <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Typography variant="h1" component="h1">
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

                         <Typography variant="h3" component="h3" sx={{ mt: 4, mb: '24px !important' }}>Will I be charged for the text messages I receive?</Typography>
                         <Typography paragraph>
                             Though Surreal Creamery will never charge you for the text messages you receive, depending on your phone plan, you may see some charges from your mobile provider. Please reach out to your wireless provider if you have questions about your text or data plan.
                         </Typography>

                         <Typography variant="h3" component="h3" sx={{ mt: 4, mb: '24px !important' }}>Data Sharing Policy</Typography>
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

