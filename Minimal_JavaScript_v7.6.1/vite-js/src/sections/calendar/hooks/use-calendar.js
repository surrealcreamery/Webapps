import { useRef, useState, useEffect, useCallback } from 'react';

import useMediaQuery from '@mui/material/useMediaQuery';

// ----------------------------------------------------------------------

export function useCalendar({
  breakpoint = 'sm',
  defaultMobileView = 'listWeek',
  defaultDesktopView = 'dayGridMonth',
} = {}) {
  const calendarRef = useRef(null);
  const smUp = useMediaQuery((theme) => theme.breakpoints.up(breakpoint));

  const [openForm, setOpenForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedRange, setSelectedRange] = useState(null);

  const [title, setTitle] = useState('');
  const [view, setView] = useState(defaultDesktopView);
  const [lastDesktopView, setLastDesktopView] = useState(defaultDesktopView);

  const getCalendarApi = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) {
      console.warn('Calendar API is not available');
      return null;
    }
    return calendarApi;
  }, []);

  const onOpenForm = useCallback(() => {
    setOpenForm(true);
  }, []);

  const onCloseForm = useCallback(() => {
    setOpenForm(false);
    setSelectedRange(null);
    setSelectedEventId('');
  }, []);

  const syncView = useCallback(() => {
    const calendarApi = getCalendarApi();
    if (!calendarApi) return;

    const targetView = smUp ? lastDesktopView : defaultMobileView;

    if (targetView !== calendarApi.view.type) {
      calendarApi.changeView(targetView);
      setView(targetView);
    }

    if (title !== calendarApi.view.title) {
      setTitle(calendarApi.view.title);
    }
  }, [defaultMobileView, getCalendarApi, lastDesktopView, smUp, title]);

  useEffect(() => {
    syncView();
  }, [syncView]);

  const onChangeView = useCallback(
    (newView) => {
      const calendarApi = getCalendarApi();
      if (!calendarApi) return;

      if (smUp) {
        setLastDesktopView(newView);
      }

      calendarApi.changeView(newView);
      setView(newView);
    },
    [getCalendarApi, smUp]
  );

  const onDateNavigation = useCallback(
    (action) => {
      const calendarApi = getCalendarApi();
      if (!calendarApi) return;

      switch (action) {
        case 'today':
          calendarApi.today();
          break;
        case 'prev':
          calendarApi.prev();
          break;
        case 'next':
          calendarApi.next();
          break;
        default:
          console.warn(`Unknown action: ${action}`);
          return;
      }

      setTitle(calendarApi.view.title);
    },
    [getCalendarApi]
  );

  const onSelectRange = useCallback(
    (arg) => {
      const calendarApi = getCalendarApi();
      if (!calendarApi) return;

      calendarApi.unselect();
      onOpenForm();
      setSelectedRange({ start: arg.startStr, end: arg.endStr });
    },
    [getCalendarApi, onOpenForm]
  );

  const onClickEvent = useCallback(
    (arg) => {
      const { event } = arg;

      onOpenForm();
      setSelectedEventId(event.id);
    },
    [onOpenForm]
  );

  const onResizeEvent = useCallback((arg, updateEvent) => {
    const { event } = arg;

    updateEvent({
      id: event.id,
      allDay: event.allDay,
      start: event.startStr,
      end: event.endStr,
    });
  }, []);

  const onDropEvent = useCallback((arg, updateEvent) => {
    const { event } = arg;

    updateEvent({
      id: event.id,
      allDay: event.allDay,
      start: event.startStr,
      end: event.endStr,
    });
  }, []);

  const onClickEventInFilters = useCallback(
    (eventId) => {
      if (eventId) {
        onOpenForm();
        setSelectedEventId(eventId);
      }
    },
    [onOpenForm]
  );

  return {
    calendarRef,
    getCalendarApi,
    /********/
    view,
    title,
    /********/
    onDropEvent,
    onClickEvent,
    onChangeView,
    onSelectRange,
    onResizeEvent,
    onDateNavigation,
    /********/
    openForm,
    onOpenForm,
    onCloseForm,
    /********/
    selectedRange,
    selectedEventId,
    /********/
    onClickEventInFilters,
  };
}
