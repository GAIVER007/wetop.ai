import { requireVertical } from '../../lib/vertical-guard';
import Screen from '../beauty/masters/page';
export default async function GuardedPage() {
  await requireVertical(['BEAUTY']);
  return Screen();
}
