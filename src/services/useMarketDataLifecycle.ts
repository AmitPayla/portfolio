import { useEffect } from 'react';
import { AppState } from 'react-native';
import { marketData } from './marketData';

/**
 * Starts the pipeline once for the app, stops streaming in the background
 * (no point burning battery on invisible prices) and resumes on return.
 */
export function useMarketDataLifecycle(): void {
  useEffect(() => {
    marketData.start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') marketData.resume();
      else if (state === 'background') marketData.pause();
    });
    return () => {
      subscription.remove();
      marketData.stop();
    };
  }, []);
}
