import { requireFeature } from '../../lib/vertical-guard';
import Screen from '../beauty/services/page';
export default async function GuardedPage() {
  await requireFeature('/services');
  return Screen();
}
