import { WatchlistScreen } from '@/features/watchlist/WatchlistScreen';
import { FreezeWhenHidden } from '@/ui/components/FreezeWhenHidden';

export default function WatchlistRoute() {
  return (
    <FreezeWhenHidden>
      <WatchlistScreen />
    </FreezeWhenHidden>
  );
}
