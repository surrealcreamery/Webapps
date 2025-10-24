import React from 'react';
import { Box, Typography, Container, Breadcrumbs, Link as MuiLink, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';

export const MarketingMaterials = ({ event, onBack, onGoHome }) => {
    const pdfLink = event?.['PDF Link'];
    const bannerLink = event?.['Banner Link'];
    const eventName = Array.isArray(event?.['Event Name']) ? event['Event Name'][0] : 'Marketing Materials';

    return (
        <Container maxWidth="sm" sx={{ pt: 0, pb: 4 }}>
            <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
                <MuiLink underline="hover" color="inherit" href="#" onClick={onGoHome} sx={{cursor: 'pointer'}}>Home</MuiLink>
                <MuiLink underline="hover" color="inherit" href="#" onClick={onBack} sx={{cursor: 'pointer'}}>My Events</MuiLink>
                <Typography color="text.primary">Marketing Materials</Typography>
            </Breadcrumbs>

            <Typography variant="h1" component="h1" sx={{ mb: 1 }}>
                {eventName}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Download or view your promotional materials below. These links open in a new tab.
            </Typography>

            {/* Display the banner image at the top if it exists */}
            {bannerLink && (
                <Box sx={{ mb: 4, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'grey.300' }}>
                    <img src={bannerLink} alt="Event Banner" style={{ width: '100%', display: 'block' }} />
                </Box>
            )}

            {/* Use a List for the download links */}
            <List>
                {bannerLink ? (
                    <ListItem button component="a" href={bannerLink} target="_blank" rel="noopener noreferrer">
                        <ListItemIcon>
                            <ImageIcon fontSize="large" color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                            primary="Download Banner (PNG)"
                            primaryTypographyProps={{ 
                                sx: { 
                                    color: 'primary.main', 
                                    textDecoration: 'underline' 
                                } 
                            }} 
                        />
                    </ListItem>
                ) : (
                    <ListItem disabled>
                        <ListItemIcon>
                            <ImageIcon fontSize="large" />
                        </ListItemIcon>
                        <ListItemText primary="Banner Not Available" />
                    </ListItem>
                )}
                {pdfLink ? (
                    <ListItem button component="a" href={pdfLink} target="_blank" rel="noopener noreferrer">
                        <ListItemIcon>
                            <PictureAsPdfIcon fontSize="large" color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                            primary="Download Flyer (PDF)" 
                            primaryTypographyProps={{ 
                                sx: { 
                                    color: 'primary.main', 
                                    textDecoration: 'underline' 
                                } 
                            }} 
                        />
                    </ListItem>
                ) : (
                     <ListItem disabled>
                        <ListItemIcon>
                            <PictureAsPdfIcon fontSize="large" />
                        </ListItemIcon>
                        <ListItemText primary="PDF Flyer Not Available" />
                    </ListItem>
                )}
            </List>
        </Container>
    );
};

