import type { IncomingHttpHeaders, OutgoingHttpHeaders } from 'node:http';

// Fault-injection proxy: do not forward the upstream connection lifetime to its client.
export function qaProxyResponseHeaders(headers: IncomingHttpHeaders): OutgoingHttpHeaders {
  const result: OutgoingHttpHeaders = { ...headers, connection: 'close' };
  delete result['keep-alive'];
  return result;
}
