import { PortfolioScreen } from '@/features/portfolio/PortfolioScreen';
import { FreezeWhenHidden } from '@/ui/components/FreezeWhenHidden';

export default function PortfolioRoute() {
  return (
    <FreezeWhenHidden>
      <PortfolioScreen />
    </FreezeWhenHidden>
  );
}
