# WETOP Mobile

Expo 58 / React Native 0.88 / React 19.3. Локальная реализация входа и защищённого кабинета; рабочие данные следующих модулей ещё не подключены.

## Установка и запуск

Из корня репозитория (Node >=22.13):

```sh
npm ci
npm --prefix apps/mobile ci --workspaces=false
npm --prefix apps/mobile run start
```

Мобильный пакет имеет отдельный lockfile и исключён из корневых workspaces, чтобы не менять React существующего web-приложения. Не использовать `npm -w apps/mobile`.

```sh
npm run test:record -- mobile
npm run test:record -- mobile-types
npm --prefix apps/mobile run lint
cd apps/mobile
npx expo install --check
npx expo export --platform all
```

Export проверяет JS/Hermes bundles, но не создаёт установочные IPA/APK. Для `npm run ios` нужен Xcode, для `npm run android` Android SDK/JDK. Development ID обеих платформ: ai.wetop.mobile.dev. Публикация в магазинах не настроена.

Маршруты: `/` (вход или подтверждённый кабинет), `/menu` (защищённый профиль), `/design-system` (защищённая галерея компонентов). Тема следует устройству. Поле сохраняет ввод при смене демонстрационного состояния. Safe areas и системное масштабирование текста требуют отдельного native smoke.

Следующие модули: рабочие ресторанные сценарии и mobile-today (реальные данные). Секреты, общая dev-база и production API в этом этапе не используются.

Результаты: ../../reports/mobile-foundation-2026-10-24/REPORT.md.

## Mobile access (локальная реализация)

В приложении нет регистрации. Вход по существующей веб-учётной записи. Укажите `EXPO_PUBLIC_MOBILE_API_URL=https://<согласованный-хост>/api/mobile/v1` при сборке. Значение не секрет, не включает токен или пароль. Без настройки приложение не имитирует успешный вход. HTTP разрешён только для loopback в development; на устройствах используйте согласованный HTTPS-хост.

Gateway выключен по умолчанию: `MOBILE_GATEWAY_ENABLED=1` требуется на сервере web. Login/password-reset дополнительно требуют MOBILE_GATEWAY_TRUSTED_PROXY=cloudflare и валидный CF-Connecting-IP. Не включать production до проверки доверенного proxy, лимитов и штатного выпуска. Не открывать внутренний API наружу. Native использует SecureStore; web preview хранит токен только в памяти, после перезагрузки нужен вход. Регистрировать пользователей и назначать права нужно в существующей веб-версии.

Вход → me → разрешённые филиалы/организации → me со scope → кабинет. Профиль содержит смену контекста и выход. Рабочие модули ещё не подключены. Ссылки на защищённые маршруты без сессии возвращают вход. Preview с fixtures не доказывает реальный production-вход или работу SecureStore на устройствах.
