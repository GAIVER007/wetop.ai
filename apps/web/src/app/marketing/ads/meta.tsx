'use client';
import { useState } from 'react';
import type { MetaConnectionView } from '../../../lib/api';
import { Icon } from '../../../components/icon';
import { Overlay } from '../../../components/overlay';
import { useConfirm } from '../../../components/use-confirm';
import { Alert, Badge, Button, Field, Input } from '../../../components/ui';
import { disconnectMetaAction, startMetaAction, syncMetaAction } from '../budget/actions';
import { useBudgetAction, useFileAction } from '../budget/drawers';

/**
 * Кабинет Meta на «Рекламе» (DATA_MODEL §54, ADR-MKT-META): подключение по номеру кабинета через вход Facebook,
 * состояние, «Обновить» и «Отключить». Ключ на стойку не приходит никогда.
 */
export function MetaCabinet({ view, editable }: { view: MetaConnectionView; editable: boolean }) {
  const c = view.connection;
  const [synced, sync, syncing] = useFileAction(syncMetaAction);
  const [disconnected, disconnect, disconnecting] = useFileAction(disconnectMetaAction);
  const { ask, dialog } = useConfirm();
  if (!view.configured)
    return (
      <p className="settings-note" data-testid="meta-not-configured">
        Подключение кабинета Meta появится, когда владелец платформы настроит приложение Meta. Кампании можно вести
        вручную уже сейчас.
      </p>
    );
  if (!c) return editable ? <ConnectButton /> : null;
  const when = c.lastSyncedAt
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: c.timezone }).format(new Date(c.lastSyncedAt))
    : 'ещё не обновлялся';
  const error = synced.error ?? disconnected.error ?? c.lastError;
  return (
    <section className="panel budget-files" aria-labelledby="meta-cabinet-title" data-testid="meta-cabinet">
      <h2 id="meta-cabinet-title" className="budget-files__title">
        Кабинет Meta: {c.accountName ?? c.adAccountId}
      </h2>
      <p className="settings-note">
        Номер {c.adAccountId}, валюта {c.currency}, обновлён {when}. Кампании и дни приходят сами каждую ночь; расход
        кабинета считает CPC, CPM и CPL, а журнал «Бюджета» ведёт фактические списания. Лиды площадки: заявки и начатые
        переписки по окну атрибуции кабинета.
      </p>
      {/* обёртка: в колонке панели значок иначе растягивается на всю ширину */}
      <div>
        {c.status === 'FAILED' ? <Badge tone="warn">Нужно подключить заново</Badge> : <Badge tone="ok">Подключён</Badge>}
      </div>
      {error && (
        <Alert boxed data-testid="meta-error">
          {error}
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
                {syncing ? 'Обновляю…' : 'Обновить'}
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
                  title: 'Отключить кабинет Meta?',
                  body: 'Ключ доступа сотрётся, ночная сверка остановится. Кампании и статистика останутся.',
                  confirmLabel: 'Отключить',
                  tone: 'danger',
                });
                if (yes) form?.requestSubmit();
              }}
            >
              Отключить
            </Button>
          </form>
        </div>
      )}
      {dialog}
    </section>
  );
}

function ConnectButton({ again = false }: { again?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" tone="secondary" onClick={() => setOpen(true)} data-testid="meta-connect">
        <Icon name="link" width={16} aria-hidden="true" />
        {again ? 'Подключить заново' : 'Подключить кабинет Meta'}
      </Button>
      {open && (
        <Overlay open drawer className="settings-service-drawer" title="Кабинет Meta" onClose={() => setOpen(false)}>
          <ConnectForm onClose={() => setOpen(false)} />
        </Overlay>
      )}
    </>
  );
}

function ConnectForm({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useBudgetAction(startMetaAction, onClose);
  return (
    <form action={action} className="settings-service-form" data-testid="meta-connect-form">
      {state.error && <Alert boxed>{state.error}</Alert>}
      <p className="settings-note">
        Номер рекламного кабинета виден в Ads Manager рядом с его названием (цифры, иногда с приставкой act_). Дальше
        откроется вход Facebook: разрешите WETOP читать отчёты этого кабинета. Тратить деньги и менять рекламу WETOP не
        сможет.
      </p>
      <Field label="Номер рекламного кабинета">
        <Input
          name="adAccountId"
          required
          inputMode="numeric"
          autoFocus
          defaultValue={state.values?.['adAccountId'] ?? ''}
          data-testid="meta-account"
        />
      </Field>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="meta-continue">
          {pending ? 'Открываю Facebook…' : 'Продолжить в Facebook'}
        </Button>
      </div>
    </form>
  );
}
