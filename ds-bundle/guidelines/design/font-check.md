# Проверка шрифта стойки

Машина: vm (linux), 2026-09-16 10:40 UTC. Команда: `npm run design:font`.
Что проверяется и почему — заголовок `scripts/design/check-font.ts`; решение по шрифту — `DESIGN.md` §6.
**Проверка имеет смысл только на машине стойки:** шрифты берутся из системы, и на другом компьютере
результат другой (Q-138).

| Кандидат | Зачем | Установлен | Казахские буквы | Латиница | Табличные цифры | Снимок |
|---|---|---|---|---|---|---|
| `-apple-system, BlinkMacSystemFont, "Segoe UI"` | текущий стек стойки: SF на macOS, Segoe UI на Windows | нет | — | — | — | — |
| `"IBM Plex Sans"` | записан в ADR-027, в код не попал | нет | — | — | — | — |
| `Inter` | указан в старом --font, не подключён | нет | — | — | — | — |
| `Manrope` | заголовки главной wetop.ai | нет | — | — | — | — |
| `"Segoe UI"` | системный на Windows | нет | — | — | — | — |
| `"DejaVu Sans"` | системный на Linux — что видно в контейнере | да | все есть | есть | да | [font-check-dejavu-sans.png](font-check-dejavu-sans.png) |
| `"Liberation Sans"` | системный на Linux, метрики Arial | да | все есть | есть | **нет** | [font-check-liberation-sans.png](font-check-liberation-sans.png) |
