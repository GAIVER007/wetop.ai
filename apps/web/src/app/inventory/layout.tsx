import type { ReactNode } from 'react';

/**
 * Слот `drawer` — панель места поверх фонда (ADR-108, срез I2): щелчок по месту в «Номерном фонде» открывает
 * его справа закреплённой колонкой (DockedPanel), адрес `/units/<код>` остаётся, «назад» панель закрывает. Прямой заход и шахматка открывают
 * полную карточку — перехват живёт только здесь.
 */
export default function InventoryLayout({
  children,
  drawer,
}: {
  children: ReactNode;
  drawer: ReactNode;
}) {
  return (
    <div className="fund-split">
      {children}
      {drawer}
    </div>
  );
}
