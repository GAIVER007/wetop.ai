import http from 'node:http';

const listenPort = Number(process.env.AUTH_PROXY_PORT || '4323');
const upstream = new URL(process.env.AUTH_PROXY_UPSTREAM || 'http://127.0.0.1:4313');

if (
  !Number.isInteger(listenPort) ||
  listenPort < 1 ||
  listenPort > 65_535 ||
  upstream.protocol !== 'http:' ||
  upstream.hostname !== '127.0.0.1' ||
  !upstream.port
) {
  throw new Error('Auth fixture proxy requires valid loopback HTTP ports');
}

let unavailable = false;

const server = http.createServer((request, response) => {
  if (request.url === '/__a27/health') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ok');
    return;
  }

  if (request.url === '/__a27/network' && request.method === 'POST') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      if (body.length <= 1024) body += chunk;
    });
    request.on('end', () => {
      try {
        unavailable = JSON.parse(body).unavailable === true;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ unavailable }));
      } catch {
        response.writeHead(400);
        response.end();
      }
    });
    return;
  }

  if (unavailable && request.url === '/auth/me') {
    request.socket.destroy();
    return;
  }

  const upstreamRequest = http.request(
    {
      hostname: upstream.hostname,
      port: upstream.port,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: upstream.host },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstreamRequest.on('error', () => {
    if (!response.headersSent) response.writeHead(503);
    response.end();
  });
  request.pipe(upstreamRequest);
});

server.listen(listenPort, '127.0.0.1');
