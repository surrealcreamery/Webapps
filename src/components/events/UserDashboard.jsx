import React, { useState } from 'react';
import { Box, Typography, Button, Container, Stack, Paper, Divider, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { format, isValid, isPast, parse } from 'date-fns';

const formatDateSafe = (dateValue, formatString) => {
  // Fix for timezone issue: treat date string as local by replacing hyphens
  const date = new Date(dateValue.replace(/-/g, '/'));
  if (!isValid(date)) {
    return 'Invalid Date';
  }
  return format(date, formatString);
};

// Helper function to format time slots like "15:00 - 19:00" to "3:00pm - 7:00pm"
const formatTimeSlot = (slot) => {
    if (!slot || !slot.includes(' - ')) return '';
    try {
        const [startTime, endTime] = slot.split(' - ');
        const start = parse(startTime, 'HH:mm', new Date());
        const end = parse(endTime, 'HH:mm', new Date());
        return `${format(start, 'h:mmaaa')} - ${format(end, 'h:mmaaa')}`.toLowerCase();
    } catch (e) {
        return 'Invalid Time';
    }
};

const EventCard = ({ event, eventDetails, onViewTransactions, onViewMarketingMaterials }) => {
    console.log("EventCard received event:", event);
    console.log("EventCard received eventDetails (for image):", eventDetails);

    const eventDate = new Date(event['Event Date'].replace(/-/g, '/'));
    const isEventInThePast = isPast(eventDate);
    
    const first = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : '');
    
    const imageUrl = first(event['Image URL']) || eventDetails?.imageUrl;

    return (
        <Paper variant="outlined" sx={{ borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
            {imageUrl && (
                 <Box sx={{ height: 180, backgroundColor: 'grey.200', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', overflow: 'hidden' }}>
                    <img
                        src={imageUrl}
                        alt={first(event['Event Name'])}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                </Box>
            )}

            <Stack sx={{ p: 2, flexGrow: 1 }} spacing={1}>
                <Typography variant="h3" component="h3">{first(event['Event Name'])}</Typography>
                
                {isEventInThePast && (
                    <Typography variant="body2" color="error" sx={{ fontWeight: 'bold' }}>
                        Past Event
                    </Typography>
                )}

                {/* ✅ This now correctly displays both the date and the event time */}
                <Typography variant="body1" color="text.secondary">
                    {formatDateSafe(event['Event Date'], "EEEE, MMMM do")}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {formatTimeSlot(event['Event Time'])}
                </Typography>
                <Typography variant="body1" color="text.secondary">{first(event['Location Name'])}</Typography>
                <Typography variant="body1" color="text.secondary">{first(event['Location Address'])}</Typography>
                
                {first(event['Event Role']) === 'Host' && event['Status'] && (
                    <Box sx={{ pt: 1 }}>
                        <Typography variant="body2">Status: <strong>{event['Status']}</strong></Typography>
                    </Box>
                )}
            </Stack>

            {first(event['Event Role']) === 'Host' && event['Status'] === 'Approved' && (
                <>
                    <Divider />
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {isEventInThePast ? (
                            <Button onClick={() => onViewTransactions(event['Registered Event ID'])} sx={{ pl: 0 }}>
                                View Fundraiser Details
                            </Button>
                        ) : (
                            <Button onClick={() => onViewMarketingMaterials(event['Registered Event ID'])} sx={{ pl: 0 }}>
                                View Marketing Materials
                            </Button>
                        )}
                    </Box>
                </>
            )}
        </Paper>
    );
};

export const UserDashboard = ({ events, allEvents, onScheduleNew, onViewTransactions, onViewMarketingMaterials }) => {
    const [view, setView] = useState('All');
    
    console.log("UserDashboard received raw events prop:", events);
    
    const handleViewChange = (event, newView) => {
        if (newView !== null) setView(newView);
    };

    const now = new Date();
    const filteredEvents = (events || []).filter(e => {
        if (view === 'All') {
            return true;
        }
        const eventDate = new Date(e['Event Date'].replace(/-/g, '/'));
        if (!isValid(eventDate)) return false;
        return view === 'Active' ? eventDate >= now : eventDate < now;
    });

    console.log(`UserDashboard filteredEvents for '${view}' view:`, filteredEvents);

    const hostedEvents = filteredEvents.filter(e => e['Event Role']?.[0] === 'Host');
    const participantEvents = filteredEvents.filter(e => e['Event Role']?.[0] === 'Participant');

    const hasAnyParticipantEvents = (events || []).some(e => e['Event Role']?.[0] === 'Participant');
    
    const emptyEventsMessage = (role, currentView) => {
        if (currentView === 'All') {
            return `You have no ${role} events.`;
        }
        return `You have no ${currentView.toLowerCase()} ${role} events.`;
    };

    return (
        <Container maxWidth="sm" sx={{ pt: 0, pb: 4 }}>
            <Typography variant="h1" component="h1" align="center" sx={{ mb: 2 }}>
                My Events
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 3 }}>
                <ToggleButtonGroup
                    color="primary"
                    value={view}
                    exclusive
                    onChange={handleViewChange}
                    aria-label="Filter events"
                >
                    <ToggleButton value="All">All</ToggleButton>
                    <ToggleButton value="Active">Active</ToggleButton>
                    <ToggleButton value="Past">Past</ToggleButton>
                </ToggleButtonGroup>
            </Box>
            
            <Box sx={{ mb: 4 }}>
                <Typography variant="h2" component="h2">Hosted Events</Typography>
                <Box sx={{ mt: 4 }}>
                    {hostedEvents.length > 0 ? (
                        <Stack spacing={3}>
                            {hostedEvents.map(event => {
                                const eventDetails = allEvents.find(e => e.title === event['Event Name']?.[0]);
                                return (
                                    <EventCard 
                                        key={event['Registered Event ID']} 
                                        event={event} 
                                        eventDetails={eventDetails} 
                                        onViewTransactions={onViewTransactions} 
                                        onViewMarketingMaterials={onViewMarketingMaterials} 
                                    />
                                )
                            })}
                        </Stack>
                    ) : <Typography color="text.secondary">{emptyEventsMessage('hosted', view)}</Typography>}
                </Box>
            </Box>
            
            {hasAnyParticipantEvents && (
                <>
                    <Box sx={{ mt: 4 }}>
                        <Typography variant="h2" component="h2" sx={{ mb: 2 }}>Participant Events</Typography>
                        {participantEvents.length > 0 ? (
                            <Stack spacing={3}>
                                {participantEvents.map(event => {
                                    const eventDetails = allEvents.find(e => e.title === event['Event Name']?.[0]);
                                    return (
                                        <EventCard 
                                            key={event['Registered Event ID']} 
                                            event={event} 
                                            eventDetails={eventDetails} 
                                        />
                                    )
                                })}
                            </Stack>
                        ) : <Typography color="text.secondary">{emptyEventsMessage('participant', view)}</Typography>}
                    </Box>
                </>
            )}

            <Button
                variant="contained"
                fullWidth
                onClick={onScheduleNew}
                sx={{ mt: 3 }}
            >
                Schedule a New Event or Fundraiser
            </Button>
        </Container>
    );
};

