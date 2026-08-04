import { setup, assign, fromPromise } from 'xstate';
import { addDays, subDays, startOfToday, isBefore, format } from 'date-fns';
import { fetchInitialData } from '@/state/events/eventService';
import { EVENTS_API_URL } from '@/constants/events/eventsConstants';

const tomorrowStr = () => format(addDays(new Date(), 1), 'yyyy-MM-dd');
const emptyForm = () => ({ firstName: '', lastName: '', email: '', phone: '', organizationName: '', description: '' });

const postEvents = async (body) => {
  const r = await fetch(EVENTS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
};

// Flow: loading → eventType? → location? → schedule → checkingAvailability → partySize → review → contact → submitting → submitted
// Date/time is chosen first; availability is fetched, then the guest count is capped to what the free tables can seat.
// (eventType / location steps are skipped when there are no event types / a single location.)
export const bookASpaceMachine = setup({
  actors: {
    // Load locations + events (static file) and the space-request config (event types) together.
    fetchData: fromPromise(async () => {
      const [{ locations, events }, configResult] = await Promise.all([
        fetchInitialData(),
        fetch(EVENTS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getSpaceRequestConfig' }),
        }).then(r => r.json()).catch(() => ({})),
      ]);
      const rawTypes = configResult.eventTypes || [];
      const eventTypes = rawTypes.map(t => (typeof t === 'string' ? { name: t, imageUrl: '' } : t));
      // Only real store locations are bookable — exclude warehouses (and any non-store type).
      const bookable = (locations || []).filter(l => (l.type || 'Store') !== 'Warehouse');
      return { locations: bookable, events: events || [], eventTypes };
    }),

    // Live table availability for the chosen location/date/time/party (Phase-2 engine).
    checkAvailability: fromPromise(async ({ input: { context } }) => {
      const { ok, data } = await postEvents({
        action: 'getTableAvailability',
        locationId: context.selectedLocationId,
        date: context.selectedDate,
        startTime: context.startTime,
        endTime: context.endTime,
        partySize: context.partySize,
      });
      if (!ok) throw new Error(data.error || 'Could not check availability');
      return data; // { configured, freeTables, freeSeats, allocation, tournamentDemand }
    }),

    // Submit: real table reservation when the location has tables, else a plain space request.
    submitBooking: fromPromise(async ({ input: { context } }) => {
      const selectedLocation = context.locations.find(l => l.id === context.selectedLocationId);
      // Location has bookable tables → reserve specific ones (server re-allocates with party size);
      // otherwise fall back to a plain space request.
      const hasTables = !!context.availability?.configured;
      const { ok, data } = await postEvents({
        action: hasTables ? 'createSpaceBooking' : 'createSpaceRequest',
        eventType: context.selectedEventType,
        locationId: context.selectedLocationId,
        locationName: selectedLocation?.['Location Name'] || '',
        requestedDate: context.selectedDate,
        startTime: context.startTime,
        endTime: context.endTime,
        partySize: context.partySize || null,
        ...context.formData,
      });
      // createSpaceBooking → { status: 'ok' | 'error', message }; createSpaceRequest → { success, request }
      if (!ok || data.status === 'error') throw new Error(data.message || data.error || 'Failed to submit request');
      return data;
    }),
  },

  guards: {
    hasEventTypes: ({ context }) => context.eventTypes.length > 0,
    hasMultipleLocations: ({ context }) => context.locations.length > 1,
    loadedHasEventTypes: ({ event }) => (event.output?.eventTypes?.length || 0) > 0,
    loadedHasMultipleLocations: ({ event }) => (event.output?.locations?.length || 0) > 1,
    // Party size is set and valid (>= 1).
    hasPartySize: ({ context }) => Number(context.partySize) >= 1,
  },

  actions: {
    assignLoaded: assign({
      locations: ({ event }) => event.output.locations,
      events: ({ event }) => event.output.events,
      eventTypes: ({ event }) => event.output.eventTypes,
      selectedLocationId: ({ event }) => (event.output.locations.length === 1 ? event.output.locations[0].id : ''),
    }),
    setEventType: assign({ selectedEventType: ({ event }) => event.name }),
    setLocation: assign({
      selectedLocationId: ({ event }) => event.id,
      startTime: ({ context, event }) => (context.selectedLocationId === event.id ? context.startTime : ''),
      endTime: ({ context, event }) => (context.selectedLocationId === event.id ? context.endTime : ''),
      availability: ({ context, event }) => (context.selectedLocationId === event.id ? context.availability : null),
    }),
    // Party size is chosen AFTER availability is known — do NOT clear availability here.
    setPartySize: assign({ partySize: ({ event }) => event.value }),
    setDate: assign({ selectedDate: ({ event }) => event.date, startTime: '', endTime: '', availability: null }),
    changeDate: assign(({ context, event }) => {
      const [y, m, d] = context.selectedDate.split('-').map(Number);
      const cur = new Date(y, m - 1, d);
      const next = event.dir === 'prev' ? subDays(cur, 1) : addDays(cur, 1);
      if (event.dir === 'prev' && isBefore(next, addDays(startOfToday(), 1))) return {}; // can't go before tomorrow
      return { selectedDate: format(next, 'yyyy-MM-dd'), startTime: '', endTime: '', availability: null };
    }),
    setStart: assign({ startTime: ({ event }) => `${String(event.hour).padStart(2, '0')}:00`, endTime: '', availability: null }),
    setEnd: assign({ endTime: ({ event }) => event.time, availability: null }),
    assignAvailability: assign({ availability: ({ event }) => event.output }),
    setField: assign({ formData: ({ context, event }) => ({ ...context.formData, [event.field]: event.value }) }),
    setError: assign({ error: ({ event }) => event.error?.message || 'Failed to submit request' }),
    setAvailabilityError: assign({ error: ({ event }) => event.error?.message || 'Could not check availability' }),
    clearError: assign({ error: '' }),
    resetSchedule: assign({ startTime: '', endTime: '', selectedDate: tomorrowStr, availability: null }),
    clearLocation: assign({ selectedLocationId: ({ context }) => (context.locations.length === 1 ? context.locations[0].id : '') }),
    clearEventType: assign({ selectedEventType: '' }),
    resetAll: assign({
      selectedEventType: '',
      selectedDate: tomorrowStr,
      startTime: '',
      endTime: '',
      partySize: '',
      availability: null,
      error: '',
      selectedLocationId: ({ context }) => (context.locations.length === 1 ? context.locations[0].id : ''),
      formData: emptyForm,
    }),
  },
}).createMachine({
  id: 'bookASpace',
  context: () => ({
    locations: [],
    events: [],
    eventTypes: [],
    selectedLocationId: '',
    selectedDate: tomorrowStr(),
    startTime: '',
    endTime: '',
    selectedEventType: '',
    partySize: '',
    availability: null,
    formData: emptyForm(),
    error: '',
  }),
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: 'fetchData',
        onDone: [
          { guard: 'loadedHasEventTypes', actions: 'assignLoaded', target: 'eventType' },
          { guard: 'loadedHasMultipleLocations', actions: 'assignLoaded', target: 'location' },
          { actions: 'assignLoaded', target: 'schedule' },
        ],
        onError: [
          { guard: 'hasMultipleLocations', target: 'location' },
          { target: 'schedule' },
        ],
      },
    },

    eventType: {
      on: {
        SELECT_EVENT_TYPE: [
          { guard: 'hasMultipleLocations', actions: 'setEventType', target: 'location' },
          { actions: 'setEventType', target: 'schedule' },
        ],
      },
    },

    location: {
      on: {
        SELECT_LOCATION: { actions: 'setLocation', target: 'schedule' },
        BACK: { guard: 'hasEventTypes', target: 'eventType' },
      },
    },

    schedule: {
      on: {
        SELECT_DATE: { actions: 'setDate' },
        CHANGE_DATE: { actions: 'changeDate' },
        SELECT_START: { actions: 'setStart' },
        SELECT_END: { actions: 'setEnd' },
        CONTINUE: { target: 'checkingAvailability' },
        BACK: [
          { guard: 'hasMultipleLocations', target: 'location' },
          { guard: 'hasEventTypes', target: 'eventType' },
        ],
      },
    },

    checkingAvailability: {
      entry: 'clearError',
      invoke: {
        src: 'checkAvailability',
        input: ({ context }) => ({ context }),
        onDone: { actions: 'assignAvailability', target: 'partySize' },
        onError: { actions: 'setAvailabilityError', target: 'schedule' },
      },
    },

    partySize: {
      on: {
        SET_PARTY_SIZE: { actions: 'setPartySize' },
        CONTINUE: { guard: 'hasPartySize', target: 'review' },
        BACK: { target: 'schedule' },
      },
    },

    review: {
      on: {
        CONTINUE: { target: 'contact' },
        BACK: { target: 'partySize' },
      },
    },

    contact: {
      on: {
        FIELD_CHANGE: { actions: 'setField' },
        CLEAR_ERROR: { actions: 'clearError' },
        SUBMIT: { target: 'submitting' },
        BACK: { target: 'review' },
      },
    },

    submitting: {
      entry: 'clearError',
      invoke: {
        src: 'submitBooking',
        input: ({ context }) => ({ context }),
        onDone: { target: 'submitted' },
        onError: { actions: 'setError', target: 'contact' },
      },
    },

    submitted: {
      on: {
        RESET: [
          { guard: 'hasEventTypes', actions: 'resetAll', target: 'eventType' },
          { guard: 'hasMultipleLocations', actions: 'resetAll', target: 'location' },
          { actions: 'resetAll', target: 'schedule' },
        ],
      },
    },
  },
});
