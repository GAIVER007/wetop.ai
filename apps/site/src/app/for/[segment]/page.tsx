import type { Metadata } from 'next';
import {
  SegmentLanding,
  resolveSegment,
  segmentMetadata,
} from '../../../components/landing/segment-landing';
import type { SegmentSlug } from '../../../i18n/types';
import { SUBTYPE_SLUGS } from '../../../lib/landings';

/*
 * Русские страницы типов бизнеса: тонкая обёртка над общим каркасом `segment-landing` (21.10.2026),
 * казахская пара живёт на /kk/for/<тип>/ той же обёрткой с locale='kk'.
 */
export const dynamicParams = false;

type Props = { params: Promise<{ segment: string }> };

export function generateStaticParams(): Array<{ segment: SegmentSlug }> {
  return SUBTYPE_SLUGS.map((segment) => ({ segment }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segment } = await params;
  return segmentMetadata(resolveSegment(segment), 'ru');
}

export default async function SegmentPage({ params }: Props) {
  const slug = resolveSegment((await params).segment);
  return <SegmentLanding slug={slug} locale="ru" />;
}
