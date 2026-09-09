/**
 * eQonaq (уведомление о прибытии иностранца, Казахстан) — ПОРТ без реализации.
 * Документации Smart Bridge / eQonaq в `docs/` нет (письмо `outbox/02-eqonaq.md` не отправлено),
 * а AGENTS.md §5 запрещает писать интеграцию без документации. Домен и стойка программируются
 * против этого интерфейса; реализация появится вместе с документацией и способом авторизации (Q-04x).
 */
export type EqonaqStatus = 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'RETRY' | 'MANUAL_REVIEW';

/** Данные для подачи — без хранения паспорта открытым текстом: номер расшифровывается только в момент отправки. */
export interface EqonaqSubmissionRequest {
  reservationId: string;
  guestId: string;
  arrivalDate: string;
  departureDate: string;
  citizenship: string;
  /** Функция, а не значение: расшифровка происходит внутри адаптера и не попадает в логи */
  documentNumber: () => string;
  documentType: string;
}
export interface EqonaqSubmissionResult {
  status: EqonaqStatus;
  externalRequestId: string | null;
  error: string | null;
}
export interface EqonaqProvider {
  submit(req: EqonaqSubmissionRequest): Promise<EqonaqSubmissionResult>;
  status(externalRequestId: string): Promise<EqonaqSubmissionResult>;
}

export class EqonaqNotConfiguredError extends Error {
  override readonly name = 'EqonaqNotConfiguredError';
  constructor() {
    super('eQonaq не подключён: нет документации и учётных данных (см. outbox/02-eqonaq.md)');
  }
}

/** Заглушка: любая подача → MANUAL_REVIEW, чтобы стойка видела, что уведомление надо подать вручную. */
export class ManualEqonaqProvider implements EqonaqProvider {
  async submit(): Promise<EqonaqSubmissionResult> {
    return {
      status: 'MANUAL_REVIEW',
      externalRequestId: null,
      error: 'подача вручную: интеграция не подключена',
    };
  }
  async status(): Promise<EqonaqSubmissionResult> {
    throw new EqonaqNotConfiguredError();
  }
}
