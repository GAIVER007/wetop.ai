# DNS для почты wetop.ai: что выдал Zoho 16.09.2026

Организация Zoho: **WETOP**, тариф — пробная версия Workplace Professional на 15 дней,
заведена 16.09.2026. Суперадминистратор: `wetopai@wetop.ai`. Уникальный код домена в Zoho:
`zb32389794`. Домен подтверждён 16.09.2026.

Зона `wetop.ai` живёт в Cloudflare.

## Уже прописано

| Тип | Имя | Значение | Прокси | Состояние |
|---|---|---|---|---|
| TXT | `@` | `zoho-verification=zb32389794.zmverify.zoho.com` | DNS only | прописано, домен подтверждён |

## Осталось прописать

| # | Тип | Имя | Приоритет | Значение |
|---|---|---|---|---|
| 1 | MX | `@` | 10 | `mx.zoho.com` |
| 2 | MX | `@` | 20 | `mx2.zoho.com` |
| 3 | MX | `@` | 50 | `mx3.zoho.com` |
| 4 | TXT | `@` | — | `v=spf1 include:zohomail.com ~all` |
| 5 | TXT | `zoho._domainkey` | — | значение DKIM ниже |
| 6 | TXT | `_dmarc` | — | `v=DMARC1; p=none; rua=mailto:wetopai@wetop.ai` |

DKIM, селектор `zoho`, ключ 2048 бит:

```
v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3BJnAFoYAQ9VhB397pFgV9Eko/2PAj6Iqe/TLh4zjNObXT+H/fzjs9JQmT5QZMNZK111i1JQeJk8chwX4q87osjVZjazdGD+UvYKh0kDCkamdfMWgRZ0r/oZ6b1FDSH2ySYtjZv3KGnfPuI5KP4EriovOiSXnq6MsaGPlGURC66MBCwl4z0aLzrPScRH2rf3tQv+W089/Z2wANwE/PaLoxkl2pabB2SOpxML/3XD3fPW1Egp6s3nwhxTAWlS0p89F9FUVOEqb/7ERUKlagMVZ5eAHOcDgZzdeOZIOjgCnRgf1gVOtctD9akd/EDv9dEiWoC9fkVibpzJtRELR1UfYwIDAQAB
```

## Что важно не сломать

1. **Записи SPF у домена должна быть ровно одна.** Когда добавится Resend, строка
   меняется на `v=spf1 include:zohomail.com include:<то, что даст Resend> ~all`.
   Вторая отдельная запись SPF означает то же, что ни одной: проверка падает.
2. **DKIM у каждого отправителя свой селектор.** У Zoho — `zoho._domainkey`. Resend
   выдаст собственный. Их несколько, и это нормально.
3. **Все эти записи — DNS only, без оранжевого облака.** Прокси Cloudflare через себя
   почту не пускает, а MX проксировать нельзя в принципе.
4. **DMARC сначала в режиме наблюдения** (`p=none`). Ужесточать до `quarantine` только
   после недели чистых отчётов, иначе рискуем потерять письма на этапе настройки.
5. Корень зоны занят CNAME на `webtop-site.pages.dev` (лендинг). Cloudflare разрешает
   держать MX рядом с ним, потому что CNAME на корне у него плоский. Лендинг от этого
   не пострадает.

## Как проверить

После того как записи встанут, в консоли Zoho: Домены → wetop.ai → Конфигурация эл. почты,
на каждой вкладке (MX, SPF, DKIM) кнопка «Проверить». Ждать распространения обычно
минуты, Cloudflare отдаёт быстро.
