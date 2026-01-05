import React from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

export const CateringBreadcrumbs = ({ items, sendToCatering }) => {
    const handleClick = (event, action) => {
        event.preventDefault();
        if (action) {
            sendToCatering(action);
        }
    };

    return (
        <Box sx={{ mb: 2 }}>
            <Breadcrumbs
                separator={<NavigateNextIcon fontSize="small" />}
                aria-label="breadcrumb"
            >
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;

                    if (isLast) {
                        return (
                            <Typography
                                key={index}
                                color="text.primary"
                                sx={{ fontWeight: 500 }}
                            >
                                {item.label}
                            </Typography>
                        );
                    }

                    return (
                        <Link
                            key={index}
                            component="button"
                            underline="hover"
                            color="inherit"
                            onClick={(e) => handleClick(e, item.action)}
                            sx={{
                                cursor: 'pointer',
                                '&:hover': {
                                    color: 'primary.main'
                                }
                            }}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </Breadcrumbs>
        </Box>
    );
};

export default CateringBreadcrumbs;
