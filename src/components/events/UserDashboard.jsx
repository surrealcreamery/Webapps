import React, { useState } from 'react';
import { Box, Typography, Button, Container, Stack, Paper, Divider, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { format, isValid, isPast, parse } from 'date-fns';

const formatDateSafe = (dateValue, formatString) => {
  if (!dateValue) return 'Date TBD';
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

const HostedEventCard = ({ event, eventDetails, onViewTransactions, onViewMarketingMaterials }) => {
    console.log("HostedEventCard received event:", event);
    console.log("HostedEventCard received eventDetails (for image):", eventDetails);

    const eventDate = event['Event Date'] ? new Date(event['Event Date'].replace(/-/g, '/')) : null;
    const isEventInThePast = eventDate ? isPast(eventDate) : false;
    
    const first = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : arr || '');
    
    const imageUrl = first(event['Image URL']) || eventDetails?.imageUrl;
    
    // Get description and bullet points from event or eventDetails
    const description = event['Description'] || eventDetails?.description || eventDetails?.['Description'];
    const bulletPoints = event['Bullet Points'] || eventDetails?.bulletPoints || eventDetails?.['Bullet Points'];

    // Helper to render bullet points
    const renderBulletPoints = (bp) => {
        if (!bp) return null;
        if (typeof bp === 'string') {
            return (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {bp}
                </Typography>
            );
        }
        if (Array.isArray(bp) && bp.length > 0) {
            return (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {bp.map(point => {
                        if (typeof point === 'string') return point;
                        if (point?.name) return point.name;
                        if (point?.text) return point.text;
                        if (point?.value) return point.value;
                        return '';
                    }).join('\n')}
                </Typography>
            );
        }
        return null;
    };

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

                {event['Event Date'] && (
                    <Typography variant="body1" color="text.secondary">
                        {formatDateSafe(event['Event Date'], "EEEE, MMMM do")}
                    </Typography>
                )}
                {event['Event Time'] && (
                    <Typography variant="body1" color="text.secondary">
                        {formatTimeSlot(event['Event Time'])}
                    </Typography>
                )}
                {first(event['Location Name']) && (
                    <Typography variant="body1" color="text.secondary">{first(event['Location Name'])}</Typography>
                )}
                {first(event['Location Address']) && (
                    <Typography variant="body1" color="text.secondary">{first(event['Location Address'])}</Typography>
                )}
                
                {/* ✅ Show full description */}
                {description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                        {description}
                    </Typography>
                )}
                
                {/* ✅ Show full bullet points */}
                {bulletPoints && (
                    <Box sx={{ mt: 1 }}>
                        {renderBulletPoints(bulletPoints)}
                    </Box>
                )}
                
                {event['Status'] && (
                    <Box sx={{ pt: 1 }}>
                        <Typography variant="body2">Status: <strong>{event['Status']}</strong></Typography>
                    </Box>
                )}
            </Stack>

            {event['Status'] === 'Approved' && (
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

const ParticipantEventCard = ({ event }) => {
    console.log("ParticipantEventCard received event:", event);

    // For participant events, we need to calculate the event date from Start Date + Event Times
    const startDate = event['Start Date'];
    const eventDate = startDate ? new Date(startDate.replace(/-/g, '/')) : null;
    const isEventInThePast = eventDate ? isPast(eventDate) : false;
    
    const imageUrl = event['Image URL'];
    const eventTime = Array.isArray(event['Event Times']) && event['Event Times'].length > 0 
        ? event['Event Times'][0] 
        : '';
    
    const description = event['Description'];
    const bulletPoints = event['Bullet Points'];

    // Helper to render bullet points
    const renderBulletPoints = (bp) => {
        if (!bp) return null;
        if (typeof bp === 'string') {
            return (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {bp}
                </Typography>
            );
        }
        if (Array.isArray(bp) && bp.length > 0) {
            return (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {bp.map(point => {
                        if (typeof point === 'string') return point;
                        if (point?.name) return point.name;
                        if (point?.text) return point.text;
                        if (point?.value) return point.value;
                        return '';
                    }).join('\n')}
                </Typography>
            );
        }
        return null;
    };

    return (
        <Paper variant="outlined" sx={{ borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
            {imageUrl && (
                 <Box sx={{ height: 180, backgroundColor: 'grey.200', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', overflow: 'hidden' }}>
                    <img
                        src={imageUrl}
                        alt={event['Event Name']}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                </Box>
            )}

            <Stack sx={{ p: 2, flexGrow: 1 }} spacing={1}>
                <Typography variant="h3" component="h3">{event['Event Name']}</Typography>
                
                {isEventInThePast && (
                    <Typography variant="body2" color="error" sx={{ fontWeight: 'bold' }}>
                        Past Event
                    </Typography>
                )}

                {startDate && (
                    <Typography variant="body1" color="text.secondary">
                        {formatDateSafe(startDate, "EEEE, MMMM do")}
                    </Typography>
                )}
                {eventTime && (
                    <Typography variant="body1" color="text.secondary">
                        {formatTimeSlot(eventTime)}
                    </Typography>
                )}
                
                {/* ✅ Show full description */}
                {description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                        {description}
                    </Typography>
                )}
                
                {/* ✅ Show full bullet points */}
                {bulletPoints && (
                    <Box sx={{ mt: 1 }}>
                        {renderBulletPoints(bulletPoints)}
                    </Box>
                )}
            </Stack>
        </Paper>
    );
};

export const UserDashboard = ({ events, allEvents, onScheduleNew, onViewTransactions, onViewMarketingMaterials }) => {
    const [view, setView] = useState('All');
    
    console.log("UserDashboard received raw events prop:", events);
    
    const handleViewChange = (event, newView) => {
        if (newView !== null) setView(newView);
    };

    // ✅ Combine hosted and participant events into one list
    const hostedEvents = events?.hostedEvents || [];
    const participantEvents = events?.participantEvents || [];
    const allUserEvents = [...hostedEvents, ...participantEvents];

    console.log("All user events:", allUserEvents);

    const now = new Date();
    
    // ✅ Filter all events by date
    const filteredEvents = allUserEvents.filter(e => {
        // Get date from either format
        const eventDateStr = e['Event Date'] || e['Start Date'];
        
        if (view === 'All') return true;
        if (!eventDateStr) return view === 'Active'; // If no date, show in Active
        
        const eventDate = new Date(eventDateStr.replace(/-/g, '/'));
        if (!isValid(eventDate)) return false;
        return view === 'Active' ? eventDate >= now : eventDate < now;
    });

    console.log(`UserDashboard filtered events for '${view}' view:`, filteredEvents);

    // ✅ Check if there are any events at all
    const hasAnyEvents = allUserEvents.length > 0;
    
    const emptyEventsMessage = (currentView) => {
        if (currentView === 'All') {
            return 'You have no events.';
        }
        return `You have no ${currentView.toLowerCase()} events.`;
    };

    // ✅ If no events at all, show simple message without tabs
    if (!hasAnyEvents) {
        return (
            <Container maxWidth="sm" sx={{ pt: 0, pb: 4 }}>
                <Typography variant="h1" component="h1" align="center" sx={{ mb: 2 }}>
                    My Events
                </Typography>
                
                <Typography color="text.secondary" align="center" sx={{ my: 4 }}>
                    You have no events.
                </Typography>

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
    }

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
                {filteredEvents.length > 0 ? (
                    <Stack spacing={3}>
                        {filteredEvents.map((event, index) => {
                            // Determine if this is a hosted or participant event based on structure
                            const isHostedEvent = !!event['Registered Event ID'];
                            
                            if (isHostedEvent) {
                                const first = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : arr || '');
                                const eventName = first(event['Event Name']);
                                const eventDetails = allEvents?.find(e => e.title === eventName);
                                
                                return (
                                    <HostedEventCard 
                                        key={event['Registered Event ID'] || index} 
                                        event={event} 
                                        eventDetails={eventDetails} 
                                        onViewTransactions={onViewTransactions} 
                                        onViewMarketingMaterials={onViewMarketingMaterials} 
                                    />
                                );
                            } else {
                                return (
                                    <ParticipantEventCard 
                                        key={event['Event ID'] || index} 
                                        event={event}
                                    />
                                );
                            }
                        })}
                    </Stack>
                ) : (
                    <Typography color="text.secondary" align="center">
                        {emptyEventsMessage(view)}
                    </Typography>
                )}
            </Box>

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
