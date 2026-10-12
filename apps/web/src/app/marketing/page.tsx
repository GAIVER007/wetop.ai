import { requireVertical } from '../../lib/vertical-guard';
import { MarketingHub } from './hub';

export default async function MarketingPage() {
  const me = await requireVertical(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE']);
  return <MarketingHub vertical={me.context?.vertical ?? 'HOSPITALITY'} />;
}
