'use client';
import type { MetaConnectionView } from '../../../lib/api';
import { Icon } from '../../../components/icon';
import { useConfirm } from '../../../components/use-confirm';
import { Alert, Badge, Button } from '../../../components/ui';
import { chooseMetaAction, disconnectMetaAction, startMetaAction, syncMetaAction } from '../budget/actions';
import { useFileAction } from '../budget/drawers';
import { useT } from '../../../i18n/locale-provider';

/**
 * Кабинет Meta на «Рекламе» (DATA_MODEL §55, ADR-MKT-META): подключение одной кнопкой через вход Facebook (кабинет
 * отмечается в окне Facebook, несколько: выбор здесь), состояние, «Обновить» и «Отключить». Ключ на стойку не приходит.
 */
export function MetaCabinet({ view, editable }: { view: MetaConnectionView; editable: boolean }) {
  const c = view.connection;
  const [synced, sync, syncing] = useFileAction(syncMetaAction);
  const [disconnected, disconnect, disconnecting] = useFileAction(disconnectMetaAction);
  const { ask, dialog } = useConfirm();
  const t = useT();
  if (!view.configured)
    return (
      <p className="settings-note" data-testid="meta-not-configured">
        {t('Подключение Facebook скоро. Кампании можно вести вручную уже сейчас.')}
      </p>
    );
  if (!c) return editable ? <ConnectButton /> : null;
  const when = c.lastSyncedAt
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: c.timezone }).format(new Date(c.lastSyncedAt))
    : t('ещё не обновлялся');
  const error = synced.error ?? disconnected.error ?? c.lastError;
  return (
    <section className="panel budget-files" aria-labelledby="meta-cabinet-title" data-testid="meta-cabinet">
      <h2 id="meta-cabinet-title" className="budget-files__title">
        {t('Кабинет Meta: {name}', { name: c.accountName ?? c.adAccountId })}
      </h2>
      <p className="settings-note">
        {t('Номер {id}, валюта {currency}, обновлён {when}. Кампании и дни приходят сами каждую ночь; расход кабинета считает CPC, CPM и CPL, а журнал «Бюджета» ведёт фактические списания. Лиды площадки: заявки и начатые переписки по окну атрибуции кабинета.', { id: c.adAccountId, currency: c.currency, when })}
      </p>
      {/* обёртка: в колонке панели значок иначе растягивается на всю ширину */}
      <div>
        {c.status === 'FAILED' ? <Badge tone="warn">{t('Нужно подключить заново')}</Badge> : <Badge tone="ok">{t('Подключён')}</Badge>}
      </div>
      {error && (
        <Alert boxed data-testid="meta-error">
          {t(error)}
        </Alert>
      )}
      {editable && (
        <div className="budget-head">
          {c.status === 'FAILED' ? (
            <ConnectButton again />
          ) : (
            <form action={sync}>
              <Button type="submit" tone="secondary" size="sm" disabled={syncing} aria-busy={syncing} data-testid="meta-sync">
                <Icon name="refresh" width={16} aria-hidden="true" />
                {syncing ? t('Обновляю…') : t('Обновить')}
              </Button>
            </form>
          )}
          <form action={disconnect}>
            <Button
              type="button"
              tone="ghost"
              size="sm"
              disabled={disconnecting}
              data-testid="meta-disconnect"
              onClick={async (e) => {
                const form = e.currentTarget.form;
                const yes = await ask({
                  title: t('Отключить кабинет Meta?'),
                  body: t('Ключ доступа сотрётся, ночная сверка остановится. Кампании и статистика останутся.'),
                  confirmLabel: t('Отключить'),
                  tone: 'danger',
                });
                if (yes) form?.requestSubmit();
              }}
            >
              {t('Отключить')}
            </Button>
          </form>
        </div>
      )}
      {dialog}
    </section>
  );
}

/** «Подключить через Facebook»: сразу окно входа, кабинет человек отмечает там (никаких номеров) */
export function ConnectButton({ again = false }: { again?: boolean }) {
  const [state, action, pending] = useFileAction(startMetaAction);
  const t = useT();
  return (
    <form action={action} data-testid="meta-connect-form">
      {state.error && <Alert boxed>{t(state.error)}</Alert>}
      <Button type="submit" tone="secondary" disabled={pending} aria-busy={pending} data-testid="meta-connect">
        <Icon name="link" width={16} aria-hidden="true" />
        {pending ? t('Открываю Facebook…') : again ? t('Подключить заново через Facebook') : t('Подключить кабинет через Facebook')}
      </Button>
    </form>
  );
}

/** Отмечено несколько кабинетов: выбор одного; список из закрытой cookie адреса возврата */
export function MetaChoose({ accounts }: { accounts: Array<{ adAccountId: string; name: string; currency: string }> }) {
  const [state, action, pending] = useFileAction(chooseMetaAction);
  const t = useT();
  return (
    <section className="panel budget-files" aria-labelledby="meta-choose-title" data-testid="meta-choose">
      <h2 id="meta-choose-title" className="budget-files__title">
        {t('Какой рекламный кабинет подключить?')}
      </h2>
      <p className="settings-note">{t('В окне Facebook отмечено несколько кабинетов. Статистика пойдёт по выбранному.')}</p>
      {state.error && <Alert boxed>{t(state.error)}</Alert>}
      <form action={action} className="budget-files__add">
        <fieldset className="budget-files__list">
          <legend className="sr-only">{t('Рекламный кабинет')}</legend>
          {accounts.map((a, i) => (
            <label key={a.adAccountId} className="budget-files__item">
              <input type="radio" name="adAccountId" value={a.adAccountId} defaultChecked={i === 0} />
              <span className="budget-files__name">{a.name || a.adAccountId}</span>
              <span className="budget-files__size">
                {t('Номер {id}, {currency}', { id: a.adAccountId, currency: a.currency })}
              </span>
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="meta-choose-save">
          {pending ? t('Подключаю…') : t('Подключить этот кабинет')}
        </Button>
      </form>
    </section>
  );
}
