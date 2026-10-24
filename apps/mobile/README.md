# WETOP Mobile

Foundation на Expo 58 / React Native 0.88 / React 19.3. Демонстрационная оболочка без входа, API и рабочих данных.

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

Маршруты: `/` (Сегодня), `/menu`, `/design-system` (пять состояний, поле, демонстрационный повтор). Тема следует устройству. Поле сохраняет ввод при смене демонстрационного состояния. Safe areas и системное масштабирование текста требуют отдельного native smoke.

Следующие модули: mobile-access (контракт сессии и контекст бизнеса), mobile-today (реальные данные). Секреты, общая dev-база и production API в этом этапе не используются.

Результаты: ../../reports/mobile-foundation-2026-10-24/REPORT.md.
