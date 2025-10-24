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
                             href="https://www.instagram.com/dollarbobaclub?igsh=M3o4Z2Jsc2tnemxu&utm_source=qr"
                             target="_blank"
                             rel="noopener noreferrer"
                             sx={{ color: 'text.secondary' }}
                         >
                             <InstagramIcon sx={{ width: 45, height: 45 }} />
                         </IconButton>
                         <IconButton
                             aria-label="Facebook"
                             href="https://www.facebook.com/profile.php?id=61573998035365"
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
                         <Typography paragraph sx={{ mt: 2 }}>
                            Dollar Boba Club is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.
                         </Typography>
                         <Typography variant="h3" component="h3" sx={{ mt: 4, mb: '32px !important' }}>
                            Conformance Status
                         </Typography>
                         <Typography paragraph>
                            The Web Content Accessibility Guidelines (WCAG) defines requirements for designers and developers to improve accessibility for people with disabilities. It defines three levels of conformance: Level A, Level AA, and Level AAA.
                         </Typography>
                         <Typography paragraph>
                            Dollar Boba Club is fully conformant with WCAG 2.1 level AAA. Fully conformant means that the content completely conforms to the accessibility standard without any exceptions.
                         </Typography>
                         <Typography variant="h3" component="h3" sx={{ mt: 4, mb: '32px !important' }}>
                            Feedback
                         </Typography>
                         <Typography paragraph>
                            We welcome your feedback on the accessibility of Dollar Boba Club. Please let us know if you encounter accessibility barriers:
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
                            Accessibility of Dollar Boba Club relies on the following technologies to work with the particular combination of web browser and any assistive technologies or plugins installed on your computer:
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
                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>Eligibility</Typography>
                         <ol>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>The Dollar Boba Club Family Annual Membership & Dollar Boba Club Family One Month Membership allows for the inclusion of an unlimited number of individuals with a minimum of 2.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>The Dollar Boba Club Annual Membership & Dollar Boba Club One Month Membership is available to one person per membership.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Participants must be at least 13 years old or have parent/ guardian consent to purchase.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Promotion is valid for in-store only at participating locations only.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>The promotion must be purchased and redeemed through the website.</Typography></li>
                         </ol>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>One Month Membership Details</Typography>
                         <ol>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>The Dollar Club One Month Membership will run from the day of purchase until the following day of the subsequent month at 11:59 PM.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>The Dollar Boba Club One Month Membership will be charged once upon purchase.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>For the Dollar Boba Club One Month Membership, participants will receive one medium qualifying beverage per day for the month, at a cost of $1 per drink, upon redemption. Availability subject to store hours.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Additional benefits include 1 free medium qualifying drink upon purchase of membership, upon redemption.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Qualifying products include any medium green teas, black teas, fruit teas, & milk teas with up to one topping. For an extra $1, qualifying products include the medium Brown Sugar, Thai Milk Tea, and Vietnamese Iced Coffee with up to one topping. Each additional topping will be an additional $1.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Excluded products will not count towards any qualifying conditions for offers and will not benefit from any promotion.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>For an additional $5 the One Month Membership will include one free item under $12.</Typography></li>
                         </ol>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>Annual Membership Details</Typography>
                         <ol>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>The Dollar Club Annual Membership will run from the day of purchase until the following day of the subsequent year at 11:59 PM.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>The Dollar Boba Club Annual Membership will be charged once upon purchase.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>For the Dollar Boba Club Annual Membership, participants will receive one medium qualifying beverage per day for the month, at a cost of $1 per drink, upon redemption. Availability subject to store hours.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Additional benefits include 1 free medium qualifying drink upon purchase of membership, upon redemption, and 20% off all Surreal Creamery purchases, upon redemption.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Qualifying products include any medium green teas, black teas, fruit teas, & milk teas with up to one topping. For an extra $1, qualifying products include the medium Brown Sugar, Thai Milk Tea, and Vietnamese Iced Coffee with up to one topping. Each additional topping will be an additional $1.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Excluded products will not count towards any qualifying conditions for offers and will not benefit from any promotion.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>For an additional $5 per month the Annual Membership will include one free item under $12 once per month, upon redemption.</Typography></li>
                         </ol>
                          
                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>One Month Family Membership Details</Typography>
                         <ol>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>The Dollar Boba Club Family One Month Membership will run from the day of purchase until the following day of the subsequent month at 11:59 PM.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>The Dollar Boba Club Family One Month Membership will be charged once upon purchase.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>The Dollar Boba Club Family One Month Membership will receive 10% off the Dollar Boba Club One Month membership per family member included in the membership package.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>For the Dollar Boba Club Family One Month Membership, each family member will receive one medium qualifying beverage per day for the month, at a cost of $1 per drink, upon redemption. Availability subject to store hours.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>Additional benefits include one free medium qualifying drink per family member upon purchase of membership, upon redemption.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>Qualifying products include any medium green teas, black teas, fruit teas, & milk teas with up to one topping. For an extra $1, qualifying products include the medium Brown Sugar, Thai Milk Tea, and Vietnamese Iced Coffee with up to one topping. Each additional topping will be an additional $1.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>Excluded products will not count towards any qualifying conditions for offers and will not benefit from any promotion.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>For an additional $5 per family member, each member will receive one free item under $12 upon redemption.</Typography></li>
                         </ol>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>Annual Family Membership Details</Typography>
                         <ol>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>The Dollar Club Annual Family Membership will run from the day of purchase until the following day of the subsequent year at 11:59 PM.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>The Dollar Boba Club Annual Family Membership will receive 10% off the Dollar Boba Club Annual Membership per family member included in the membership package.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>The Dollar Boba Club Family Annual Membership will be charged once upon purchase.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>For the Dollar Boba Club Family Annual Membership, each family member will receive one medium qualifying beverage per day, at a cost of $1 per drink, upon redemption. Availability subject to store hours.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>Additional benefits include one free medium qualifying drink per family member upon purchase of membership, upon redemption, and 20% off all Surreal Creamery purchases, upon redemption.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>Qualifying products include any medium green teas, black teas, fruit teas, & milk teas with up to one topping. For an extra $1, qualifying products include the medium Brown Sugar, Thai Milk Tea, and Vietnamese Iced Coffee with up to one topping. Each additional topping will be an additional $1.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>Excluded products will not count towards any qualifying conditions for offers and will not benefit from any promotion.</Typography></li>
                            <li><Typography paragraph sx={{ mb: '16px !important' }}>For an additional $5 each month per family member, each member will receive one item under $12 upon redemption.</Typography></li>
                         </ol>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>Gifting Details</Typography>
                         <ol>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Gifting 3 Months Gifting Membership will run from the day of purchase until the following day of 3 months at 11:59 PM.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Gifting 6 Months Gifting Membership will run from the day of purchase until the following day of 6 months at 11:59 PM.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>The Gifting Membership will be charged once upon purchase.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>For Gifting Membership, participants will receive one medium qualifying beverage per day for the month, at a cost of $1 per drink, upon redemption. Availability subject to store hours.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Additional benefits include 1 free medium qualifying drink upon purchase of membership, upon redemption, and one free item under $12 once per month, upon redemption.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Qualifying products include any medium green teas, black teas, fruit teas, & milk teas with up to one topping. For an extra $1, qualifying products include the medium Brown Sugar, Thai Milk Tea, and Vietnamese Iced Coffee with up to one topping. Each additional topping will be an additional $1.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Excluded products will not count towards any qualifying conditions for offers and will not benefit from any promotion.</Typography></li>
                         </ol>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>Redemption</Typography>
                         <ol>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>This membership must be prepaid. Payment must be completed prior to claiming any drinks.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>The membership is non-transferable and cannot be shared with others.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Redemption of drinks must be done on the website through “redeem”.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>The membership is valid only at participating locations. Participating locations include: Kips Bay, NY, Greenwich Village, NY, New Brunswick, NJ, Newark, DE, Philadelphia Chinatown, Westfield, NJ & Bryn Mawr, PA.</Typography></li>
                         </ol>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>Restrictions</Typography>
                         <ol>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>We shall not be liable for any financial loss arising out of the refusal, cancellation or withdrawal of any promotion or any failure or inability of a customer to take advantage of a promotion for any reason.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>The promotion can not be exchanged for cash.</Typography></li>
                         </ol>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>Agreement to Receive Text Messages</Typography>
                         <ol>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>By providing your mobile number, you agree that Dollar Boba Club may send you periodic SMS or MMS messages containing but not limited to important information, updates, deals, and specials.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Message frequency may vary.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>You may unsubscribe at any time by texting the word STOP to (833) 321-0163. You may receive a subsequent message confirming your opt-out request.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>For help, send the word HELP to (833) 321-0163.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Message and data rates may apply.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>United States Participating Carriers Include AT&T, T-Mobile®, Verizon Wireless, Sprint, Boost, U.S. Cellular®, MetroPCS®, InterOp, Cellcom, C Spire Wireless, Cricket, Virgin Mobile and others.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>T-Mobile is not liable for delayed or undelivered messages.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>You agree to notify us of any changes to your mobile number and update your account with us to reflect this change.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Data obtained from you in connection with this SMS service may include your cell phone number, your carrier’s name, and the date, time and content of your messages, as well as other information that you provide. We may use this information to contact you and to provide the services you request from us.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>By subscribing or otherwise using the service, you acknowledge and agree that we will have the right to change and/or terminate the service at any time, with or without cause and/or advance notice.</Typography></li>
                         </ol>

                         <Typography variant="h3" component="h3" sx={{ mt: 3, mb: '24px !important' }}>General Terms</Typography>
                         <ol>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Person(s) with active memberships of Dollar Boba Club are entitled to $1 Boba per day, availability subject to store hours, with benefits associated with their specific membership details.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>The membership is subject to availability and may be modified, suspended, or canceled at any time at the discretion of the company without prior notice.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>In the event of any issues or disputes, the company’s decision is final and binding.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>Participants can cancel at any time.</Typography></li>
                             <li><Typography paragraph sx={{ mb: '16px !important' }}>In the event of a permanent retail location closure, a pro-rated refund for the remaining term of the membership will be returned to the user.</Typography></li>
                         </ol>
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
                            {/* ✅ DATE UPDATED HERE */}
                            Last updated: September 11, 2025
                         </Typography>
                         <Typography paragraph>
                             Dollar Boba Club ("us", "we", or "our") operates the website (the "Service"). This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.
                         </Typography>
                         
                         <Typography variant="h3" component="h3" sx={{ mt: 4, mb: '24px !important' }}>Information Collection and Use</Typography>
                         <Typography paragraph>
                             We collect several different types of information for various purposes to provide and improve our Service to you. This may include, but is not limited to, your name, email address, phone number, and payment information.
                         </Typography>

                         {/* ✅ NEW CLAUSE ADDED HERE */}
                         <Typography paragraph>
                            No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
                         </Typography>

                         <Typography variant="h3" component="h3" sx={{ mt: 4, mb: '24px !important' }}>Use of Data</Typography>
                         <Typography paragraph>
                             Dollar Boba Club uses the collected data for various purposes:
                         </Typography>
                         <ul>
                             <li><Typography>To provide and maintain the Service</Typography></li>
                             <li><Typography>To notify you about changes to our Service</Typography></li>
                             <li><Typography>To process your subscription and payments</Typography></li>
                             <li><Typography>To provide customer care and support</Typography></li>
                             <li><Typography>To monitor the usage of the Service</Typography></li>
                         </ul>

                         <Typography variant="h3" component="h3" sx={{ mt: 4, mb: '24px !important' }}>Security of Data</Typography>
                         <Typography paragraph>
                             The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
                         </Typography>

                         <Typography variant="h3" component="h3" sx={{ mt: 4, mb: '24px !important' }}>Contact Us</Typography>
                         <Typography paragraph>
                             If you have any questions about this Privacy Policy, please contact us:
                         </Typography>
                         <ul>
                            <li><Typography><b>E-mail:</b> privacy@dollarbobaclub.example.com</Typography></li>
                         </ul>
                     </Container>
                 </DialogContent>
             </Dialog>
         </>
     );
 };

 export default Footer;