# HELD 133, Beauty materials

Отдельный релиз для утверждённой модели BEAUTY-MATERIALS-20261018. Production application остаётся за владельцем.

Зависит от Beauty appointment lines и обычных миграций kitchen stock 089/090 и kitchen consumption 093. Для текущей вершины предварительное release-имя: `20261018000135_beauty_materials`, после appointment lines и reviews. Итоговый порядок фиксируется в `docs/ops/beauty-zapis-release.md`.

До применения нужны свежая резервная копия с проверенным восстановлением и остановленные Beauty и stock writers. `migration.sql` выполняется в собственной транзакции. Сначала применяется схема, затем запускается совместимый API. Расширение допускает общий склад только для FOOD_SERVICE и BEAUTY; restaurant orders, menu и их права не расширяются.

Проверки: техкарта с optimistic revision; услуга и товар одного бизнеса и одной единицы; RLS другой организации; FIFO по непросторнированным партиям филиала; DONE списывает каждую строку один раз; недостаток блокирует весь DONE; первый DONE с пустой картой не получает заднее списание после изменения карты; `order_id` и `appointment_line_id` взаимоисключаются.

Rollback empty-only. `down.sql` допустим только без техкарт, включая ревизию пустой карты, Beauty movements и Beauty stock products. После первого сохранения техкарты, создания Beauty-товара или списания down обязан отказать. Данные не удаляют ради восстановления FOOD-only guard; используют forward repair или проверенную резервную копию в отдельно согласованное окно.
