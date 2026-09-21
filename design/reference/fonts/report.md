# Проверка шрифтов-кандидатов (сгенерировано `scripts/design/src/check-fonts.ts`)

Дата: 2026-09-14. Проверяются файлы шрифтов, переданные скрипту; системный стек macOS/Windows
(SF, Segoe UI) файлами не доступен, на него отвечает Q-133. Снимки листа «1 l I 0 O» в 12 и 13 px — рядом, `*-12px.png`, `*-13px.png`.

| Шрифт | Семейство | Казахские буквы | Латиница | Кириллица | Цифры одной ширины | `tnum` | В браузере «1111» = «0000» |
|---|---|---|---|---|---|---|---|
| IBM Plex Sans | IBM Plex Sans | все 18 | да | да | да | **нет** | да (28.8 / 28.8) |
| Inter | Inter | все 18 | да | да | **нет** | да | **нет** (19.523 / 30.281) |
| Manrope | Manrope ExtraLight | **нет әғқңұӘҒҚҢҰ** | да | да | **нет** | да | **нет** (18.72 / 29.28) |
| PT Sans | PT Sans | все 18 | да | да | да | **нет** | да (26.16 / 26.16) |
| Golos Text | Golos Text | все 18 | да | да | **нет** | да | **нет** (23.28 / 29.76) |
| DejaVu Sans (система контейнера) | DejaVu Sans | все 18 | да | да | да | **нет** | да (30.539 / 30.539) |

Ширины цифр 0–9 в долях em и возможности GSUB:

- **IBM Plex Sans**: 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6; aalt ccmp dnom frac liga lnum locl numr onum ordn rvrn salt sinf ss01 ss02 ss03 ss04 ss05 ss06 subs sups zero
- **Inter**: 0.6309, 0.4067, 0.6099, 0.6177, 0.646, 0.5933, 0.6201, 0.5659, 0.6187, 0.6201; aalt calt case ccmp cv01 cv02 cv03 cv04 cv05 cv06 cv07 cv08 cv09 cv10 cv11 cv12 cv13 cv14 dlig dnom frac locl numr ordn pnum salt sinf ss01 ss02 ss03 ss04 ss05 ss06 ss07 ss08 subs sups tnum zero
- **Manrope**: 0.578, 0.358, 0.553, 0.534, 0.577, 0.572, 0.62, 0.481, 0.559, 0.62; aalt calt case dnom frac liga locl numr ordn pnum sinf subs sups tnum
- **PT Sans**: 0.545, 0.545, 0.545, 0.545, 0.545, 0.545, 0.545, 0.545, 0.545, 0.545; aalt ccmp frac hist liga locl ordn sups
- **Golos Text**: 0.62, 0.485, 0.58, 0.585, 0.61, 0.58, 0.605, 0.53, 0.61, 0.605; aalt calt case ccmp frac lnum locl onum ordn pnum sinf subs sups tnum
- **DejaVu Sans (система контейнера)**: 0.6362, 0.6362, 0.6362, 0.6362, 0.6362, 0.6362, 0.6362, 0.6362, 0.6362, 0.6362;  RQD aalt case ccmp dlig fina hlig init liga locl medi rlig salt
