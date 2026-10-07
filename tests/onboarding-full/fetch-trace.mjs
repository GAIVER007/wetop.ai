import process from 'node:process';
import { URL } from 'node:url';

// Local diagnostic only. No credentials, headers, request bodies or full URLs recorded.
if (process.env.WETOP_QA_PROXY_TRACE === '1') {
  const originalFetch = globalThis.fetch;
  let sequence = 0;
  const endpoint = process.env.APP_API_URL;
  const safeCode = (value) =>
    typeof value === 'string' && /^[A-Z0-9_]+$/.test(value) ? value : null;
  const log = (event) =>
    process.stderr.write(
      `QA_FETCH_TRACE ${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`,
    );
  globalThis.fetch = async (...args) => {
    const raw = args[0];
    const input = typeof raw === 'string' || raw instanceof URL ? String(raw) : raw?.url;
    if (!endpoint || !input?.startsWith(`${endpoint}/`)) return originalFetch(...args);
    const id = `qa-${process.pid}-${++sequence}`;
    let route = 'other';
    const path = new URL(input).pathname;
    if (
      [
        '/auth/me',
        '/onboarding',
        '/hotel/onboarding',
        '/bar/sales/retail',
        '/bar/sales/folio',
      ].includes(path)
    )
      route = path;
    const options = args[1] ?? {};
    args[1] = { ...options, headers: { ...options.headers, 'x-wetop-qa-trace': id } };
    const start = Date.now();
    log({ id, route, phase: 'start' });
    try {
      const response = await originalFetch(...args);
      log({ id, route, phase: 'response', status: response.status, elapsedMs: Date.now() - start });
      return response;
    } catch (error) {
      const cause = error?.cause;
      log({
        id,
        route,
        phase: 'error',
        name: error?.name,
        code: safeCode(cause?.code),
        elapsedMs: Date.now() - start,
        nestedCodes: Array.isArray(cause?.errors)
          ? cause.errors.map((item) => safeCode(item?.code))
          : [],
      });
      throw error;
    }
  };
}
