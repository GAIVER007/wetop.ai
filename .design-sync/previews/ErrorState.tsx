import { ErrorState, Panel } from '@pms/web';

const withDigest = (message: string, digest?: string) => {
  const error: Error & { digest?: string } = new Error(message);
  if (digest) error.digest = digest;
  return error;
};

export const Rejected = () => (
  <Panel title="Отклонённый запрос — повтор не поможет">
    <ErrorState error={withDigest('Период больше 366 дней', 'API_400')} retry={() => {}} />
  </Panel>
);

export const Offline = () => (
  <Panel title="Нет связи — повтор поможет">
    <ErrorState error={withDigest('Не удалось получить ответ')} retry={() => {}} />
  </Panel>
);
