# Реестр страниц

Сборка исходников коммита 334f7365a; правка 5d73c60de меняет только тексты главной и гостиниц. Адресов в сборке 65 (63 в sitemap и служебные /404/, /_not-found/; /404.html третьим файлом той же страницы).

| URL | Тип | Исходник | Что исправлено | Статус |
|---|---|---|---|---|
| / | главная | `app/page.tsx` | блок «Все заявки в одной ленте», «Маркетинг» без безусловного домена, фон 960 px на телефоне; CTA и подписи без условий trial | исправлена и проверена |
| /_not-found/ | служебная | `app/not-found.tsx` | нет | проверена без изменений (noindex) |
| /404/ | служебная | `app/not-found.tsx` | нет | проверена без изменений (noindex) |
| /blog/ | блог, список | `app/blog/[[...slug]]/page.tsx` | нет | проверена без изменений |
| /blog/kak-prinimat-broni-stolov-v-restorane/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-sdavat-kvartiry-posutochno/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-upravlyat-mini-otelem/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-apart-otel/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-bazu-otdyha/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-broni-banketnogo-zala/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-broni-komnat-v-karaoke/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-broni-v-kalyannoy/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-glemping/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-gostevoy-dom/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-kapsulnyy-otel/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-razmeshchenie-v-sanatorii/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-uchet-bara/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-uchet-kofeyni/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-uchet-piccerii/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-uchet-stolovoy/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-uchet-v-kafe/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-zapisi-massazhnogo-salona/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | текст; og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-zapisi-nogtevoy-studii/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-zapisi-studii-brovey-i-resnic/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-zapisi-studii-epilyacii/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | текст; og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-zapisi-tatu-studii/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-zapisi-v-barbershope/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-zapisi-v-kosmetologii/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | текст; og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-zapisi-v-parikmaherskoy/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-zapisi-v-salone-krasoty/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /blog/kak-vesti-zapisi-v-spa/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | текст; og:image своё фото | исправлена и проверена |
| /blog/kak-vybrat-pms-dlya-khostela/ | статья | `app/blog/[[...slug]]/page.tsx + content/blog` | og:image своё фото | исправлена и проверена |
| /calculator/ | калькулятор | `app/calculator/page.tsx` | CTA и подписи без условий trial | исправлена и проверена |
| /for/apart-hotels/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз; текст | исправлена и проверена |
| /for/banquet-halls/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/barbershops/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз; текст; рисунок героя из шаблона | исправлена и проверена |
| /for/bars/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз; текст | исправлена и проверена |
| /for/beauty-salons/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз; текст | исправлена и проверена |
| /for/brows-lashes/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/cafes/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/canteens/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/capsule-hotels/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/coffee-shops/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/cosmetology/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз; текст | исправлена и проверена |
| /for/daily-rentals/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/epilation/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз; текст | исправлена и проверена |
| /for/glamping/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/guest-houses/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/hair-salons/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/hookah-lounges/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/hostels/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/hotels/ | направление | `app/for/hotels/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/karaoke/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/massage/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз; текст; рисунок героя из шаблона | исправлена и проверена |
| /for/mini-hotels/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/nail-studios/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз; текст; рисунок героя из шаблона | исправлена и проверена |
| /for/pizzerias/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/resorts/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/restaurants/ | направление | `app/for/restaurants/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/salons/ | направление | `app/for/salons/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/sanatoriums/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /for/spa/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз; текст; рисунок героя из шаблона | исправлена и проверена |
| /for/tattoo/ | тип бизнеса | `app/for/[segment]/page.tsx` | CTA и подписи без условий trial; FAQPage один раз | исправлена и проверена |
| /privacy/ | правовая | `app/privacy/page.tsx` | нет | проверена без изменений |
| /terms/ | правовая | `app/terms/page.tsx` | нет | проверена без изменений (7 дней совпадает с решением владельца 17.10 и с продуктом после PR #619) |
