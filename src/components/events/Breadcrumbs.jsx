import React, { useContext } from 'react';
import { Box, Breadcrumbs, Link as MuiLink, Typography } from '@mui/material';
import { LayoutContext } from '@/contexts/events/EventsLayoutContext';

const breadcrumbConfig = {
    selectingLocation: 'Event',
    selectingDate: 'Date',
    selectingTime: 'Time',
    selectingContact: 'Your Info',
    submitting: 'Verifying',
    success: 'Success',
};

export const BreadcrumbsComponent = () => {
    const { fundraiserState, sendToFundraiser } = useContext(LayoutContext);
    const path = [];

    // This more robust logic correctly reads the nested state from XState.
    if (typeof fundraiserState.value === 'object' && fundraiserState.value.wizardFlow) {
        let wizardStateKey = Object.keys(fundraiserState.value.wizardFlow)[0];
        if (wizardStateKey === 'submitting') {
             wizardStateKey = 'submitting';
        }
        const wizardState = wizardStateKey;
        const steps = ['selectingLocation', 'selectingDate', 'selectingTime', 'selectingContact', 'submitting', 'success'];
        const currentIndex = steps.indexOf(wizardState);

        if (currentIndex >= 0) {
            for (let i = 0; i <= currentIndex; i++) {
                path.push({ name: breadcrumbConfig[steps[i]], isLast: i === currentIndex });
            }
        }
    }

    if (path.length === 0) {
        return null;
    }

    const handleHomeClick = (e) => {
        e.preventDefault();
        sendToFundraiser({ type: 'RESET' });
    };

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <Breadcrumbs aria-label="breadcrumb">
                <MuiLink
                    underline="hover"
                    color="inherit"
                    href="#"
                    onClick={handleHomeClick}
                    sx={{cursor: 'pointer'}}
                >
                    Home
                </MuiLink>
                {path.map((crumb) =>
                    crumb.isLast ? (
                        <Typography key={crumb.name} color="text.primary">
                            {crumb.name}
                        </Typography>
                    ) : (
                        <Typography key={crumb.name} color="inherit">
                            {crumb.name}
                        </Typography>
                    )
                )}
            </Breadcrumbs>
        </Box>
    );
};
