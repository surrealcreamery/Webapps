import { useState, useEffect, useCallback } from 'react';

// ----------------------------------------------------------------------

export function useCarouselDots(mainApi) {
  const [dotCount, setDotCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState([]);

  const handleClickDot = useCallback(
    (index) => {
      if (!mainApi) return;
      mainApi.scrollTo(index);
    },
    [mainApi]
  );

  const handleInit = useCallback((carouselApi) => {
    setScrollSnaps(carouselApi.scrollSnapList());
  }, []);

  const handleSelect = useCallback((carouselApi) => {
    setSelectedIndex(carouselApi.selectedScrollSnap());
    setDotCount(carouselApi.scrollSnapList().length);
  }, []);

  useEffect(() => {
    if (!mainApi) return;

    handleInit(mainApi);
    handleSelect(mainApi);
    mainApi.on('reInit', handleInit).on('reInit', handleSelect).on('select', handleSelect);
  }, [mainApi, handleInit, handleSelect]);

  return {
    dotCount,
    scrollSnaps,
    selectedIndex,
    onClickDot: handleClickDot,
  };
}
