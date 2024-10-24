import { useMemo } from 'react';

// Add data optimization hooks
export const useOptimizedData = (data, threshold = 100) => {
  return useMemo(() => {
    if (data.length <= threshold) return data;
    const step = Math.ceil(data.length / threshold);
    return data.filter((_, index) => index % step === 0);
  }, [data, threshold]);
};
