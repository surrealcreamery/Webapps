import { useState, useEffect } from 'react';

// Small localStorage + CustomEvent bridge so the events location control can live in the header
// while the events directory (FlatDirectorySection) stays the source of truth.
//   'events:locationOptions' — JSON [{id,name}] of stores that have upcoming events (page publishes)
//   'events:locationFilter'  — 'all' | <storeId> (either side writes + dispatches the event)
export const readEventsLocationOptions = () => {
    try { return JSON.parse(localStorage.getItem('events:locationOptions') || '[]'); } catch { return []; }
};
export const readEventsLocationFilter = () => {
    try { return localStorage.getItem('events:locationFilter') || 'all'; } catch { return 'all'; }
};
export const setEventsLocationFilter = (v) => {
    try { localStorage.setItem('events:locationFilter', v); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('events:locationFilter'));
};

// React hook: current events location options + filter, kept in sync across the header/page.
export function useEventsLocation() {
    const [options, setOptions] = useState(readEventsLocationOptions);
    const [filter, setFilterState] = useState(readEventsLocationFilter);
    useEffect(() => {
        const onOpts = () => setOptions(readEventsLocationOptions());
        const onFilter = () => setFilterState(readEventsLocationFilter());
        const onStorage = (e) => {
            if (e.key === 'events:locationOptions') onOpts();
            if (e.key === 'events:locationFilter') onFilter();
        };
        window.addEventListener('events:locationOptions', onOpts);
        window.addEventListener('events:locationFilter', onFilter);
        window.addEventListener('storage', onStorage);
        onOpts(); onFilter();
        return () => {
            window.removeEventListener('events:locationOptions', onOpts);
            window.removeEventListener('events:locationFilter', onFilter);
            window.removeEventListener('storage', onStorage);
        };
    }, []);
    return { options, filter, setFilter: setEventsLocationFilter };
}
