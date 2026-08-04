import React, { useContext } from 'react';
import { Box, Breadcrumbs, Link as MuiLink, Typography } from '@mui/material';
import { LayoutContext } from '@/contexts/events/EventsLayoutContext';

const stepLabels = {
    selectingLocation: 'Location',
    selectingStop: 'Schedule',
    selectingDate: 'Date',
    selectingTime: 'Time',
    selectingContact: 'Your Info',
    selectingPayment: 'Payment',
    submitting: 'Verifying',
    duplicateError: 'Error',
    success: 'Confirmed',
};

// Resolve the current wizard state key from fundraiserState.value
function getWizardState(value) {
    if (typeof value !== 'object' || !value.wizardFlow) return null;
    const wf = value.wizardFlow;
    if (typeof wf === 'string') return wf;
    return Object.keys(wf)[0];
}

export const BreadcrumbsComponent = () => {
    const { fundraiserState, sendToFundraiser } = useContext(LayoutContext);

    const wizardState = getWizardState(fundraiserState.value);
    if (!wizardState || wizardState === 'validating') return null;

    const eventTitle = fundraiserState.context.fundraiserEvents?.find(
        e => e.id === fundraiserState.context.selectedEventId
    )?.title || 'Event';

    // Event landing: Events / [Event Title]
    if (wizardState === 'eventLanding') {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                <Breadcrumbs component="div" aria-label="breadcrumb">
                    <MuiLink
                        underline="hover"
                        color="inherit"
                        href="#"
                        onClick={(e) => { e.preventDefault(); sendToFundraiser({ type: 'RESET' }); }}
                        sx={{ cursor: 'pointer' }}
                    >
                        Events
                    </MuiLink>
                    <Typography color="text.primary">{eventTitle}</Typography>
                </Breadcrumbs>
            </Box>
        );
    }

    // Wizard steps: Events / [Event Title] / [Step Name]
    if (!stepLabels[wizardState]) return null;

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <Breadcrumbs component="div" aria-label="breadcrumb">
                <MuiLink
                    underline="hover"
                    color="inherit"
                    href="#"
                    onClick={(e) => { e.preventDefault(); sendToFundraiser({ type: 'RESET' }); }}
                    sx={{ cursor: 'pointer' }}
                >
                    Events
                </MuiLink>
                <MuiLink
                    underline="hover"
                    color="inherit"
                    href="#"
                    onClick={(e) => { e.preventDefault(); sendToFundraiser({ type: 'BACK' }); }}
                    sx={{ cursor: 'pointer' }}
                >
                    {eventTitle}
                </MuiLink>
                <Typography color="text.primary">
                    {stepLabels[wizardState]}
                </Typography>
            </Breadcrumbs>
        </Box>
    );
};
