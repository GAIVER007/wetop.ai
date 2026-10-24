# Mobile foundation: решение владельца

Дата: 24.10.2026. Статус: принято владельцем в чате, ожидает публикации через PR и слияния ответственным за main.

Проблема: WETOP требуется отдельное приложение iOS и Android для владельцев и сотрудников.

Варианты: расширение PWA, Expo React Native, bare React Native, Flutter.

Решение: Expo React Native + TypeScript, Expo Router и development builds. Для следующего модуля доступа разрешён expo-secure-store. Для компонентных проверок разрешены jest-expo и React Native Testing Library. Версии выбираются совместимым набором Expo перед установкой.

Причина: существующий React/TypeScript стек, нативный интерфейс обеих платформ и возможность локальной сборки без обязательного EAS.

Границы: утверждена SPEC-mobile-foundation.md и карта plans/mobile-app-start-2026-10-24.md. Нижняя навигация относится только к apps/mobile и не изменяет веб-оболочку UI3.1. Владелец разрешил изолированную копию без общей dev-базы с сохранением чужих изменений.

Последствия: отдельный native toolchain и проверки, отсутствие прямого импорта Next.js компонентов. На машине не обнаружены Xcode/Android SDK; нативная сборка пока не подтверждена. Публикация в магазинах, платные сервисы, изменения модели данных и production-интеграций не включены.

Источники: подтверждения владельца «да давай» и «давай продолжай» в текущем чате; https://reactnative.dev/blog/2024/06/25/use-a-framework-to-build-react-native-apps ; https://docs.expo.dev/develop/development-builds/introduction/ .

## Уточнение реализации: зависимости

Expo SDK 58 требует React 19.3 и React Native 0.88. Существующий веб использует React/React DOM 19.2.8. npm hoisting создал несовместимую общую пару; закрепление React в корне оставило некорректный peer React Native. Поэтому apps/mobile является самостоятельным npm-пакетом с собственным lockfile и исключён из списка корневых workspaces. Корневой lockfile сохраняет прежние версии. Команды mobile выполняются через npm --prefix apps/mobile. Общий install-strategy не меняется, overrides не используются. Это техническая изоляция согласованного приложения, не изменение веб-стека.

Предпросмотр React Native Web нужен для проверки композиции, его результат не доказывает native runtime.

Локальные development identifiers iOS/Android: ai.wetop.mobile.dev. Это не выбор store listing и не настройка signing credentials.
