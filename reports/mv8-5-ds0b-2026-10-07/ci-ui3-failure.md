# Initial UI shard 3 failure

Run 37646528370, code d1461ddc. The DOM confirms a global API_503 error boundary, not the report-specific pa-error expected by the old test.

# Test info

- Name: workspace.spec.ts >> пустые ответы дают нули; сбой API не выдаётся за пустую базу
- Location: tests/ui/workspace.spec.ts:921:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('pa-error')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByTestId('pa-error') with timeout 15000ms
  - waiting for getByTestId('pa-error')

```

```yaml
- link "К содержимому":
  - /url: "#main-content"
- banner:
  - link "WETOP, Главная":
    - /url: /today
    - text: W WETOP.AI
  - strong: Филиал недоступен
  - text: Филиал недоступен
  - button "Найти гостя или бронь": Поиск гостя, брони, номера... Ctrl K
  - button "Переключить тему"
  - button "Меню администратора":
    - text: АД
    - strong: Администратор
    - text: Рабочее пространство
  - navigation "Разделы":
    - link "Главная":
      - /url: /today
    - link "Календарь":
      - /url: /chessboard
    - link "Брони":
      - /url: /reservations
    - link "Гости":
      - /url: /guests
    - link "Финансы":
      - /url: /finance
    - link "Бар":
      - /url: /bar
    - button "Продажи"
    - button "Отчёты"
    - button "Настройки"
- main:
  - heading "Не удалось загрузить данные" [level=1]
  - alert:
    - paragraph: Проверьте подключение и повторите запрос.
    - group: Код ошибки API_503
    - button "Повторить загрузку"
    - link "Подключения API":
      - /url: /connections
- alert
```
