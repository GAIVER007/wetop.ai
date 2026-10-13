# UI-FIX-01: комплект передачи

Начните с [UI-FIX-01-RESULT.md](UI-FIX-01-RESULT.md). В нём итоговый статус, обязательная таблица пяти ID и точные SHA кода и CI.

- [candidate.json](candidate.json): исходный main, интегрированный main, конечный код, PR, CI и статус публикации.
- [checks.json](checks.json): все местные и удалённые попытки, реальные outcomes, числовые сводки и границы доказательств.
- [VISUAL-INDEX.md](VISUAL-INDEX.md), [visual-delivery.json](visual-delivery.json), visual/: итоговые сопоставимые снимки и их хеши.
- ci-*-checks.json: прежние попытки, без переименования failed или cancelled в PASS. Исторические PNG находятся в архиве в historical-image-objects/, исходные пути и SHA256 указаны в visual-delivery.json. restore-historical-images.py восстанавливает отдельную копию с исходными путями.
- [findings-current.json](findings-current.json), [NEXT-PACKAGES.md](NEXT-PACKAGES.md): 56 исходных ID, оставшиеся 51 и отдельный F-01.
- [H-01-ACTION-MATRIX.md](H-01-ACTION-MATRIX.md): действия, права и пути readonly-контроля.
- [RESTORE.md](RESTORE.md), candidate.diff/candidate.patch: восстановление точного содержимого на diffBaseSha. Оба патча являются binary diff для git apply.
- source/: неизменённые первичные материалы аудита, безопасный исходный снимок L-02 и точные тексты открытых вопросов.
- SHA256SUMS: сверка всех переданных файлов после распаковки.

Архив предназначен для review и восстановления. Он не содержит production-доступов, cookies, приватных трасс или реальных данных гостей. Код не опубликован этой задачей; production-разрешение не предоставлено.
