# docs — vendor documentation

Документация внешних систем, скачанная **локально**.

AGENTS.md §5: integration code пишется только по документации из этой папки.
Писать по памяти модели запрещено. Нет документации → STOP → вопрос в QUESTIONS.md.

| Папка | Что кладём | Статус |
|---|---|---|
| `channex/` | PMS API docs, certification checklist, sandbox docs, webhook spec | пусто |
| `eqonaq/` | API docs, Smart Bridge, требования к ИС, примеры запросов | пусто |
| `fiscal/` | документация выбранного онлайн-ККМ | провайдер не выбран (Q-050) |
| `telegram/` | Bot API: sendMessage, getUpdates — будильник сторожа (срез 11) | **выжимка 13.09.2026**, см. `telegram/README.md` |
| `exely/` | OpenAPI Exely Connect (44 эндпоинта), портал разработчика, база знаний | **получено 08.09.2026**, см. `exely/README.md` |

Каждый скачанный документ сопровождается строкой в README соответствующей папки:
источник (URL), дата скачивания, версия.
