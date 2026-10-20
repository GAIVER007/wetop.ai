// Юнит-тесты рендерят серверной отрисовкой компоненты стойки, а те импортируют CSS-модули.
// Корневой tsconfig не подключает типы Next (apps/web из него исключён), поэтому описываем форму модуля здесь.
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
