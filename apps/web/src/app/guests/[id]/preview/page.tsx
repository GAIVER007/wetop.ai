import { requireVertical } from '../../../../lib/vertical-guard';
import { redirect } from 'next/navigation';

/**
 * Прямой заход и работа без JavaScript: предпросмотр живёт панелью поверх списка (перехват в
 * @drawer), сам по себе адрес ведёт на полную карточку гостя — там всё то же и больше.
 */
export default async function GuestPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireVertical(['HOSPITALITY']);
  const { id } = await params;
  redirect(`/guests/${encodeURIComponent(id)}`);
}
