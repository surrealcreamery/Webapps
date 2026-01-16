import { useState, useEffect, useCallback } from 'react';

// ----------------------------------------------------------------------

export function useCarouselArrows(mainApi) {
  const [disablePrev, setDisabledPrevBtn] = useState(true);
  const [disableNext, setDisabledNextBtn] = useState(true);

  const handleClickPrev = useCallback(() => {
    if (!mainApi) return;
    mainApi.scrollPrev();
  }, [mainApi]);

  const handleClickNext = useCallback(() => {
    if (!mainApi) return;
    mainApi.scrollNext();
  }, [mainApi]);

  const updateArrowState = useCallback((carouselApi) => {
    setDisabledPrevBtn(!carouselApi.canScrollPrev());
    setDisabledNextBtn(!carouselApi.canScrollNext());
  }, []);

  useEffect(() => {
    if (!mainApi) return;

    updateArrowState(mainApi);
    mainApi.on('reInit', updateArrowState).on('select', updateArrowState);
  }, [mainApi, updateArrowState]);

  return {
    disablePrev,
    disableNext,
    onClickPrev: handleClickPrev,
    onClickNext: handleClickNext,
  };
}
