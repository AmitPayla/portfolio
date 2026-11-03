import { createStore } from 'zustand/vanilla';

/**
 * Dev menu: show the loading state (the skeletons) for a few seconds, so it can
 * be inspected without a slow network. Display only: useLoadState() reports
 * "loading" while this is on, but the service, the feed and the data never
 * see it, so nothing is refetched from the shared server.
 */
export const loadingPreviewStore = createStore<{ readonly active: boolean }>()(() => ({ active: false }));

let timer: ReturnType<typeof setTimeout> | null = null;

/** Shows the loading state for `durationMs`; calling it again restarts the clock. */
export function previewLoading(durationMs: number): void {
  if (timer) clearTimeout(timer);
  loadingPreviewStore.setState({ active: true });
  timer = setTimeout(() => {
    timer = null;
    loadingPreviewStore.setState({ active: false });
  }, durationMs);
}
