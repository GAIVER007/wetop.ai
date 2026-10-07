import { Worker } from 'node:worker_threads';
import { Agent, get } from 'node:http';
import { expect, it } from 'vitest';
import { qaProxyResponseHeaders } from '../onboarding-full/proxy-transport';

const workerCode =
  "\nconst {parentPort,workerData}=require('node:worker_threads');\nconst {createServer}=require('node:http');\nconst a=new Int32Array(workerData.buffer); let first;\nconst server=createServer((req,res)=>{if(!first)first=req.socket;for(const [k,v] of Object.entries(workerData.headers))res.setHeader(k,v);res.end('ok');});\nconst tick=setInterval(()=>{if(Atomics.load(a,0)===1){first.destroy();Atomics.store(a,0,2);Atomics.notify(a,0);}},1);\nserver.listen(0,'127.0.0.1',()=>parentPort.postMessage(server.address().port));\nparentPort.on('message',()=>{clearInterval(tick);server.closeAllConnections();server.close(()=>process.exit(0));});";
async function requestAfterPeerClose(headers: Record<string, string>) {
  const buffer = new SharedArrayBuffer(4);
  const flag = new Int32Array(buffer);
  const worker = new Worker(workerCode, { eval: true, workerData: { buffer, headers } });
  const agent = new Agent({ keepAlive: true });
  try {
    const port = await new Promise<number>((resolve) => worker.once('message', resolve));
    const read = () =>
      new Promise<{ status?: number; code?: string; reused: boolean }>((resolve) => {
        const req = get({ hostname: '127.0.0.1', port, agent }, (res) => {
          res.resume();
          res.on('end', () => resolve({ status: res.statusCode!, reused: req.reusedSocket }));
        });
        req.on('error', (error: NodeJS.ErrnoException) =>
          resolve({ code: error.code!, reused: req.reusedSocket }),
        );
      });
    expect((await read()).status).toBe(200);
    await new Promise<void>((resolve) => setImmediate(resolve));
    Atomics.store(flag, 0, 1);
    while (Atomics.load(flag, 0) !== 2) {
      if (Atomics.wait(flag, 0, 1, 1000) === 'timed-out')
        throw new Error('Peer-close barrier failed');
    }
    return await read();
  } finally {
    agent.destroy();
    worker.postMessage('stop');
    await new Promise<void>((resolve) => worker.once('exit', () => resolve()));
  }
}

it('control: idle socket reuse can reset before an HTTP request reaches the server', async () => {
  expect(await requestAfterPeerClose({})).toEqual({ code: 'ECONNRESET', reused: true });
});
it('QA proxy transport survives peer idle close without retry or pooled socket reuse', async () => {
  const headers = qaProxyResponseHeaders({ 'keep-alive': 'timeout=5', connection: 'keep-alive' });
  expect(await requestAfterPeerClose(headers as Record<string, string>)).toEqual({
    status: 200,
    reused: false,
  });
  expect(headers).not.toHaveProperty('keep-alive');
});
