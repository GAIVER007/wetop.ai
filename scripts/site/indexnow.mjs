#!/usr/bin/env node
/*
 * Сообщает поисковикам о страницах wetop.ai по протоколу IndexNow (11.10.2026): Яндекс и Bing принимают адреса
 * без входа в кабинет. Ключ не секрет: протокол требует выложить его файлом на сайте (`apps/site/public/<ключ>.txt`),
 * по нему поисковик проверяет, что адреса присылает владелец домена. Запускать после выкладки: `npm run site:indexnow`.
 * Google IndexNow не читает: ему sitemap через Search Console (за владельцем).
 */
const HOST = 'wetop.ai';
const KEY = 'ccfd6b07195587289202342ff100f9e6';

const sitemap = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urlList.length === 0) throw new Error('в sitemap.xml нет адресов: сайт выложен?');

const keyFile = await fetch(`https://${HOST}/${KEY}.txt`);
if (!keyFile.ok || (await keyFile.text()).trim() !== KEY) {
  throw new Error('файл ключа IndexNow не отдаётся сайтом: сначала выложите сайт (npm run site:deploy)');
}

// Общий узел IndexNow сам передаёт адреса всем участникам (Яндекс, Bing и др.); прямые адреса дублируют на случай
// его сбоя. Прямой yandex.com бывает недоступен из сети: сбой одного адреса не отменяет остальные.
let accepted = 0;
for (const endpoint of [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
  'https://yandex.com/indexnow',
]) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
      signal: AbortSignal.timeout(20_000),
    });
    // 200 и 202 значат «принято»; 422 — адрес не того домена, 403 — ключ не подтвердился
    if (res.status === 200 || res.status === 202) accepted += 1;
    console.log(`${endpoint}: ${res.status} (${urlList.length} адресов)`);
  } catch (error) {
    console.log(`${endpoint}: не ответил (${error.cause?.code ?? error.name})`);
  }
}
if (accepted === 0) throw new Error('ни один адрес IndexNow не принял список');
