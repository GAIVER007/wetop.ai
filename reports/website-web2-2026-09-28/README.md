# Снимки WEB2 «Сайт и онлайн-бронирование → Настройки» — 28.09.2026

Стоп-гейт WEB2 (ADR-117, дополнение 28.09; план `plans/website-web2-2026-09-28.md`): WEB3 начинается только после
визуального «да» владельца по этим снимкам. Снимал `tests/ui/website.spec.ts` («снимки WEB2»): браузер → `next dev` →
подставной API. Учебный сайт начинает с заглушки `example.invalid`, как боевой «Сайт Luxx Aparts» с
`luxx-aparts.example`; потом тест добавляет `https://www.luxxaparts.kz/` так же, как это сделал бы человек.

| Файл | Что на нём |
|---|---|
| `settings-placeholder-{light,dark}.png` | Сайт с заглушкой: «Адрес не указан», заглушка в списке с плашкой «Пример, не сайт», счётчик «Сначала адрес сайта» |
| `domain-add-{light,dark}.png` | Открыта строка «Новый домен» с адресом, вставленным из браузера |
| `domain-added-{light,dark}.png` | После «Добавить»: «Домен luxxaparts.kz добавлен, заглушка example.invalid убрана» |
| `settings-waiting-{light,dark}.png` | Домен есть, событий не было: «Событий ещё не было», «Проверить установку» |
| `settings-working-{light,dark}.png` | Событие пришло сегодня: «Работает · Последнее событие в …», «Проверить» |
| `install-drawer-{light,dark}.png` | Окно «Установка счётчика WETOP»: код, Google Tag Manager, Tilda и WordPress, проверка |
| `settings-working-{light,dark}-390.png` | То же на телефоне |

Красная полоса «Укажите HTTPS-адрес API» — от подставного API (адрес кода там относительный); на сервере с
`PUBLIC_API_URL=https://api.wetop.ai` её нет.
