import { setup, assign, fromPromise } from 'xstate';
import { addDays, subDays, isBefore, parse, format } from 'date-fns';
import { fetchInitialData } from '@/state/events/eventService';
import { EVENTS_API_URL } from '@/constants/events/eventsConstants';
import { storeToday } from '@/utils/storeDate';

// Store-local (Eastern) calendar day, so defaults/guards match the store — not the visitor's timezone.
const storeTodayDate = () => parse(storeToday(), 'yyyy-MM-dd', new Date());
const tomorrowStr = () => format(addDays(storeTodayDate(), 1), 'yyyy-MM-dd');
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

// Flow: loading → eventType? → location? → schedule → partySize → review → contact → submitting → submitted
// The requester picks a DATE + START TIME only (no end time). Submitting creates a plain, un-held
// space request — nothing is blocked out yet. Staff set the actual duration when they approve it,
// which is what reserves tables / blocks the time. (eventType / location steps are skipped when
// there are no event types / a single location.)
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

    // Submit: always a plain space request. No table hold is placed at request time — staff set the
    // duration and reserve tables on approval.
    submitBooking: fromPromise(async ({ input: { context } }) => {
      const selectedLocation = context.locations.find(l => l.id === context.selectedLocationId);
      // Snapshot the selected event type's configured custom fields as [{ label, value }].
      const typeObj = context.eventTypes.find(t => t.name === context.selectedEventType);
      const customFields = (typeObj?.fields || []).map(f => ({
        label: f.label,
        value: context.formData[f.id] ?? (f.type === 'checkbox' ? false : ''),
      }));
      const { ok, data } = await postEvents({
        action: 'createSpaceRequest',
        eventType: context.selectedEventType,
        locationId: context.selectedLocationId,
        locationName: selectedLocation?.['Location Name'] || '',
        requestedDate: context.selectedDate,
        startTime: context.startTime,
        partySize: context.partySize || null,
        firstName: context.formData.firstName,
        lastName: context.formData.lastName,
        email: context.formData.email,
        phone: context.formData.phone,
        organizationName: context.formData.organizationName,
        description: context.formData.description,
        customFields,
      });
      if (!ok || data.status === 'error') throw new Error(data.message || data.error || 'Failed to submit request');
      return data;
    }),
  },

  guards: {
    hasEventTypes: ({ context }) => context.eventTypes.length > 0,
    hasMultipleLocations: ({ context }) => context.locations.length > 1,
    loadedHasEventTypes: ({ event }) => (event.output?.eventTypes?.length || 0) > 0,
    loadedHasMultipleLocations: ({ event }) => (event.output?.locations?.length || 0) > 1,
    hasStart: ({ context }) => !!context.startTime,
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
    }),
    setPartySize: assign({ partySize: ({ event }) => event.value }),
    setDate: assign({ selectedDate: ({ event }) => event.date, startTime: '' }),
    changeDate: assign(({ context, event }) => {
      const [y, m, d] = context.selectedDate.split('-').map(Number);
      const cur = new Date(y, m - 1, d);
      const next = event.dir === 'prev' ? subDays(cur, 1) : addDays(cur, 1);
      if (event.dir === 'prev' && isBefore(next, addDays(storeTodayDate(), 1))) return {}; // can't go before tomorrow (store time)
      return { selectedDate: format(next, 'yyyy-MM-dd'), startTime: '' };
    }),
    setStart: assign({ startTime: ({ event }) => `${String(event.hour).padStart(2, '0')}:00` }),
    setField: assign({ formData: ({ context, event }) => ({ ...context.formData, [event.field]: event.value }) }),
    setError: assign({ error: ({ event }) => event.error?.message || 'Failed to submit request' }),
    clearError: assign({ error: '' }),
    resetSchedule: assign({ startTime: '', selectedDate: tomorrowStr }),
    clearLocation: assign({ selectedLocationId: ({ context }) => (context.locations.length === 1 ? context.locations[0].id : '') }),
    clearEventType: assign({ selectedEventType: '' }),
    resetAll: assign({
      selectedEventType: '',
      selectedDate: tomorrowStr,
      startTime: '',
      partySize: '',
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
    selectedEventType: '',
    partySize: '',
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
        CONTINUE: { guard: 'hasStart', target: 'partySize' },
        BACK: [
          { guard: 'hasMultipleLocations', target: 'location' },
          { guard: 'hasEventTypes', target: 'eventType' },
        ],
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
