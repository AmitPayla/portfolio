import { loadingPreviewStore, previewLoading } from '../loadingPreview';

describe('loading preview (dev menu)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the loading state for the given time, and a second tap restarts the clock', () => {
    expect(loadingPreviewStore.getState().active).toBe(false);
    previewLoading(3_000);
    expect(loadingPreviewStore.getState().active).toBe(true);

    jest.advanceTimersByTime(2_000);
    previewLoading(3_000);
    jest.advanceTimersByTime(2_000);
    expect(loadingPreviewStore.getState().active).toBe(true);

    jest.advanceTimersByTime(1_000);
    expect(loadingPreviewStore.getState().active).toBe(false);
  });
});
