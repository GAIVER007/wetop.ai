import type { Metadata } from 'next';
import {
  SegmentLanding,
  resolveSegment,
  segmentMetadata,
} from '../../../../components/landing/segment-landing';
import type { SegmentSlug } from '../../../../i18n/types';
import { SUBTYPE_SLUGS } from '../../../../lib/landings';

/** Казахские страницы типов бизнеса (фаза 1, 21.10.2026): тот же каркас, словарь kk, hreflang на пару. */
export const dynamicParams = false;

type Props = { params: Promise<{ segment: string }> };

export function generateStaticParams(): Array<{ segment: SegmentSlug }> {
  return SUBTYPE_SLUGS.map((segment) => ({ segment }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segment } = await params;
  return segmentMetadata(resolveSegment(segment), 'kk');
}

export default async function SegmentPageKk({ params }: Props) {
  const slug = resolveSegment((await params).segment);
  return <SegmentLanding slug={slug} locale="kk" />;
}
