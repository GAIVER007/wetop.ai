import { requireVertical } from '../../lib/vertical-guard';
import Screen from '../beauty/page';
export default async function GuardedPage(props: Parameters<typeof Screen>[0]) {
  await requireVertical(['BEAUTY']);
  return Screen(props);
}
