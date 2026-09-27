import { createElement } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';
import { expect, it } from 'vitest';
import { PropertyTimeProvider, usePropertyClock } from './property-time';

/**
 * Часы объекта в клиентских компонентах (С-13, ТЗ аудита 25.09.2026): календарь `DateField`, счета брони,
 * неисправности и строка свежести данных больше не считают время сдвигом на пять часов. Пояс приходит
 * обещанием из макета (тот же запрос `/hotel/settings`), поэтому сервер и браузер рисуют одно и то же.
 */
async function render(node: ReturnType<typeof createElement>): Promise<string> {
  const { prelude } = await prerenderToNodeStream(node);
  let html = '';
  for await (const chunk of prelude) html += String(chunk);
  return html;
}

function Probe() {
  const clock = usePropertyClock();
  return createElement('span', null, `${clock.timezone} ${clock.moment('2026-09-17T04:05:09Z')}`);
}

it('клиентские часы берут пояс объекта из макета', async () => {
  const html = await render(
    createElement(PropertyTimeProvider, {
      timezone: Promise.resolve('Asia/Tokyo'),
      children: createElement(Probe),
    }),
  );
  expect(html).toContain('Asia/Tokyo 17.09 13:05');
});

it('вне макета (без настроек объекта) — пояс платформы', async () => {
  const html = await render(createElement(Probe));
  expect(html).toContain('Asia/Almaty 17.09 09:05');
});
