import { ResetRequestForm } from './reset-form';

/** «Забыли пароль» (DATA_MODEL §13.8, ADR-049): письмо со одноразовой ссылкой на сутки. */
export default function ResetPage() {
  return <ResetRequestForm />;
}
