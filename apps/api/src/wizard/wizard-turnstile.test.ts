import { expect, it } from 'vitest';
import { TurnstileService } from '../web-booking/turnstile';
it('requires the wizard action and hostname, while preserving booking verification', async () => {
  let response: Record<string, unknown> = {
    success: true,
    action: 'wizard',
    hostname: 'app.example.test',
  };
  const verifier = new TurnstileService(async () => Response.json(response));
  const ctx = { allowedHosts: ['app.example.test'], action: 'wizard', requireBinding: true };
  const env = { TURNSTILE_SECRET_KEY: 'synthetic' };
  expect(await verifier.verify('synthetic-token', ctx, env)).toEqual({ ok: true });
  response = { success: true };
  expect(await verifier.verify('synthetic-token', ctx, env)).toEqual({
    ok: false,
    reason: 'invalid',
  });
});
