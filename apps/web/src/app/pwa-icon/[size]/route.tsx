import { ImageResponse } from 'next/og';
import { Mark } from '../../../lib/pwa';

/** Значки манифеста (PWA1): 192 и 512 px обычные и 512 px маскируемый; любой другой адрес 404 */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === '192' ? 192 : size === '512' || size === 'maskable' ? 512 : 0;
  if (!px) return new Response('Not found', { status: 404 });
  return new ImageResponse(<Mark size={px} maskable={size === 'maskable'} />, {
    width: px,
    height: px,
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}
