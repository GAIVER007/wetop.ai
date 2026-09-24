/**
 * Подставной ИИ-помощник для `tests/ui/assistant-widget.spec.ts` (ТЗ П2). Отдаёт `/widget/widget.js`, который
 * ничего не рисует, кроме пузыря с классом бота `.pmsw-b` (по нему стойка поднимает пузырь на телефоне), и
 * запоминает, с какой подписью его загрузили: `window.__assistantWidget = { identity, loads }`.
 *
 * Настоящий виджет живёт в боте (ветка `ai-seller`, `src/site/widget.js`) и читает `data-identity` так же —
 * один раз, при загрузке, через `document.currentScript`.
 */
import { createServer } from 'node:http';

const port = Number(process.env.FAKE_ASSISTANT_PORT) || 4315;

const WIDGET = `(function () {
  var script = document.currentScript;
  var identity = (script && script.getAttribute('data-identity')) || '';
  var state = window.__assistantWidget || { loads: 0 };
  window.__assistantWidget = { identity: identity, loads: state.loads + 1 };
  function start() {
    // как у настоящего виджета: стили классом в своём <style> в head, не в атрибуте style
    var style = document.createElement('style');
    style.textContent = '.pmsw-b{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border:0;z-index:2147483000}';
    document.head.appendChild(style);
    var root = document.createElement('div');
    root.className = 'pmsw';
    var bubble = document.createElement('button');
    bubble.className = 'pmsw-b';
    bubble.type = 'button';
    bubble.setAttribute('aria-label', 'Чат помощника');
    root.appendChild(bubble);
    document.body.appendChild(root);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();`;

createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }
  if (req.url === '/widget/widget.js') {
    res.writeHead(200, {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(WIDGET);
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(port, '127.0.0.1');
