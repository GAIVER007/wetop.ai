import { ImageResponse } from 'next/og';
import { Mark } from '../lib/pwa';

/** Значок «На экран Домой» на iPhone (PWA1): iOS не берёт SVG, нужен PNG 180 px */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<Mark size={180} maskable />, size);
}
