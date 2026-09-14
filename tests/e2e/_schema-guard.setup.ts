import { expect, test } from '@playwright/test';

/**
 * Предохранитель изолированного прогона (ADR-040): API, на который пойдут спеки, работает в схеме pms_test.
 * Проект isolated зависит от этого шага — если здесь красное, ни один спек не запускается и рабочие данные не тронуты.
 */
test('API тестов работает в pms_test, а не в рабочих данных', async ({ request }) => {
  const api = process.env['APP_API_URL'] ?? '';
  expect(api, 'APP_API_URL не задан конфигом e2e').not.toBe('');
  expect(api, 'спеки нацелены на рабочий API').not.toMatch(/:3001\b/);
  const res = await request.get(`${api}/system/connection`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { state: string; database?: { schema?: string } };
  expect(body.database?.schema, 'API тестов подключён не к pms_test — прогон остановлен').toBe('pms_test');
  expect(body.state).toBe('READY');
});
