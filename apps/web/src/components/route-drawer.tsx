'use client';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { msg } from '../i18n';
import { Overlay } from './overlay';
import design from '../app/reservations/new/new-reservation.module.css';
/**
 * Панель-маршрут поверх списка: закрытие шагом назад. Ширина общим размером `Overlay` (MV8.5 DS1c);
 * класс `booking-drawer` остаётся: он раскладывает карточку страницы внутри панели, а не ширину.
 */
export function RouteDrawer({
  children,
  title = msg('Бронирование'),
  size = 'md',
}: {
  children: ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const router = useRouter();
  return (
    <Overlay
      open
      onClose={() => router.back()}
      title={title}
      drawer
      size={size}
      className={`booking-drawer ${title === 'Новая бронь' ? design.drawer : ''}`} // kk-allow: сверка с заголовком, который передал экран
    >
      {children}
    </Overlay>
  );
}
