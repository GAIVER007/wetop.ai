import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReviewInvitation } from './review-invitation';

describe('приглашение оставить отзыв в карточке записи', () => {
  it('создаёт ссылку вручную и не обещает автоматическую отправку клиенту', () => {
    const html = renderToStaticMarkup(createElement(ReviewInvitation, { appointmentId: 'appointment-1' }));
    expect(html).toContain('Создать ссылку на отзыв');
    expect(html).not.toContain('Отправлено клиенту');
  });
});
