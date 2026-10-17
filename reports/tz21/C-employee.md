# ТЗ2.1 C: общие данные сотрудника

Все три adapter paths Beauty basic, Food employee edit и EmployeePortal profile используют writeEmployeeCommon. Он проверяет обязательный исходный microsecond token Employee.updated_at под FOR UPDATE в транзакции вызывающего. Обновление clock_timestamp монотонно. Portal проверяет и исходную public profile revision в той же транзакции. Нет подмены токеном из свежего auth/read DTO. Old запрос без expectedProfileRevision теперь400, не обход CAS. Schema/Membership/User/Session/Employee.id и связи не менялись.

Формы basic/portal/food передают исходные токены. Ошибка не сбрасывает ввод, явная перечитка требует подтверждения отмены черновика. Strict Beauty boundary отклоняет неизвестные поля, а не игнорирует опасную подмену. PublicProfile публикация/consent/self-unpublish сохраняют существующие правила.

В объединённой копии до D: integration07:39:02-623f,40/40. Из них19common-writer+9workspace действительно используют wetop_app (не superuser/owner/BYPASSRLS);12Portal/payroll проверяют настоящие services/DB, но с программным SignedInUser и privileged fixture Db. Это не равнозначно полной HTTP auth/RLS проверке. UI/end-to-end обеих форм остаётся отдельной финальной проверкой.

Unit profile original-version forwarding3 и write-safety6 прошли07:39:35-2151, но общий прогон был красным из-за устаревшей positive fixture boundary. Исправлен только fixture исходной версии, assertions усилены: mass assignment проверяется с корректным token, old requests400+данные неизменны. Boundary4/4 прошли07:42:28-c929. Запреты и assertions не отключались.

Первый объединённый integration07:27:04-99dd честно сохранён:26passed,2failed,2suites setup-blocked. Политика missing-token была намеренно изменена заданием, foreign test теперь получает валидный source token. Owned fixture guard разрешает только точный loopback55743/wetop_tz21 в дополнение к прежним целям.
