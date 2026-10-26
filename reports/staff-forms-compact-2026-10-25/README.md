# Формы персонала: вариант 01

Дата: 25.10.2026. Это снимки локального браузерного стенда с вымышленными данными, не production.

Образец: приложенное владельцем изображение «01 · Компактное окно». После замечания о расхождении первая интерпретация заменена структурой образца: отдельные имя и фамилия, «Контакты», карточки назначения, «Доступ в приложение», отдельный режим без входа, срок приглашения и кнопки в нижнем ряду.

- [Специалист, 1440](specialist-1440.png)
- [Приглашение, 1440](invite-1440.png)
- [Специалист, 390](specialist-390.png)
- [Приглашение, 390](invite-390.png)

Проверки: 37 unit, 6 сценариев создания/приглашения/отображения, затем повтор двух визуальных сценариев после исправления расположения карточек филиалов. Проверены axe, отсутствие горизонтального переполнения, полный номер с кодом страны, обязательная почта для входа и расположение карточек филиалов на одной строке. Журналы: tests/runs/, в Git не включаются по правилам проекта.

Общий unit на первой итерации: 7586 passed, 4 skipped, два таймаута неизменённого db-restore-prod. Отдельно 7/7 passed; записанный повтор с лимитом 15 секунд тоже 7/7. Полный unit на окончательной версии проверяет CI.

Публикация подтверждается отдельно по release-checks, deployed SHA и рабочему адресу.

CI follow-up: all five reported failures fixed without changing computed geometry or weakening design rules. Full local unit: 7588 passed, 4 skipped, 0 failed; 914 files passed and 1 skipped. Desktop/mobile UI: 2/2 passed; lint passed.

CI follow-up 2 (25.10.2026): updated remaining real-onboarding and portal selectors to the approved contact labels, explicitly selected no-login access in directory-only creation scenarios, and supplied that mode in the save-before-closing test. PhoneInput example moved after the existing kit so it does not shift screenshot sections. Targeted unit 32/32 and lint passed. Local kit screenshot comparison remains red: macOS reference width mismatch (1342 vs 1326) and a calendar contrast finding. Reference files and screenshot tolerances were not changed; Linux CI verification remains required.
