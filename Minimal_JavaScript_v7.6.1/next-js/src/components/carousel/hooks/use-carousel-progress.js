import { useState, useEffect, useCallback } from 'react';

// ----------------------------------------------------------------------

export function useCarouselProgress(mainApi) {
  const [progressValue, setProgressValue] = useState(0);

  const handleScroll = useCallback((carouselApi) => {
    const rawProgress = carouselApi.scrollProgress();
    const normalizedProgress = Math.max(0, Math.min(1, rawProgress));

    setProgressValue(normalizedProgress * 100);
  }, []);

  useEffect(() => {
    if (!mainApi) return;

    handleScroll(mainApi);
    mainApi.on('reInit', handleScroll).on('scroll', handleScroll).on('slideFocus', handleScroll);
  }, [mainApi, handleScroll]);

  return {
    value: progressValue,
  };
}
