import { useState, useCallback } from 'react';

// ----------------------------------------------------------------------

export function useMapMarkerPopup() {
  const [selectedItem, setSelectedItem] = useState(null);

  const handleOpenPopup = useCallback((event, item) => {
    event.originalEvent.stopPropagation();
    setSelectedItem(item);
  }, []);

  const handleClosePopup = useCallback(() => {
    setSelectedItem(null);
  }, []);

  return {
    selectedItem,
    onOpenPopup: handleOpenPopup,
    onClosePopup: handleClosePopup,
  };
}
