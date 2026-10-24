import { AmountChip } from '../../components/amount-chip';
import { financeState } from './finance-state';
import { msg } from '../../i18n';
import { T } from '../../i18n/locale-provider';

/**
 * Состояние оплаты словами (ADR-106, DESIGN.md §14): колонка «Финансы» списка и «Оплата» на полосе
 * карточки брони говорят одно и то же — у отменённой брони с деньгами к возврату нет «оплачено».
 */
export function FinanceLine({
  row,
  testId,
}: {
  row: {
    hasFolios: boolean;
    paidMinor: string;
    balanceMinor: string;
    chargedMinor?: string | undefined;
    refundedMinor?: string | undefined;
    currency: string;
  };
  testId?: string | undefined;
}) {
  const state = financeState(row);
  switch (state.kind) {
    case 'unpaid':
      return (
        <span className="warn-text reservations-fin" data-testid={testId}>
          <T text={msg('не оплачено')} />
        </span>
      );
    case 'due':
      return (
        <AmountChip
          className="reservations-fin"
          tone="due"
          minor={state.minor}
          currency={row.currency}
          data-testid={testId}
        />
      );
    case 'refund-due':
      return (
        <AmountChip
          className="reservations-fin"
          tone="refund"
          label={msg('к возврату')}
          minor={state.minor}
          currency={row.currency}
          data-testid={testId}
        />
      );
    case 'refunded':
      return (
        <span className="muted reservations-fin" data-testid={testId}>
          <T text={msg('возвращено')} />
        </span>
      );
    case 'paid':
      return (
        <span className="dir-paid reservations-fin" data-testid={testId}>
          <T text={msg('оплачено')} />
        </span>
      );
    default:
      return (
        <span className="muted reservations-fin" data-testid={testId}>
          —
        </span>
      );
  }
}
