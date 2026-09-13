'use client';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Overlay } from './overlay';
export function RouteDrawer({
  children,
  title = 'Бронирование',
}: {
  children: ReactNode;
  title?: string;
}) {
  const router = useRouter();
  return (
    <Overlay open onClose={() => router.back()} title={title} drawer className="booking-drawer">
      {children}
    </Overlay>
  );
}
