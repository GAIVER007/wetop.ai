/**
 * Заглушка отправителя: складывает письма в память. В тестах ходят только сюда — живых писем
 * в прогонах не бывает (AGENTS.md §8: настоящих данных в тестах нет, чужих ящиков тем более).
 */

import { MailError, type MailMessage, type MailSender } from './sender';

export class StubMailSender implements MailSender {
  private readonly messages: MailMessage[] = [];
  /** Сколько следующих отправок должны упасть. Чтобы проверять поведение при отказе почты. */
  private failNext = 0;
  private failRetriable = true;

  async send(message: MailMessage): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new MailError('заглушка: отправка отклонена намеренно', this.failRetriable);
    }
    this.messages.push({ ...message });
  }

  /** Все письма в порядке отправки. Копия: снаружи список не испортить. */
  get sent(): readonly MailMessage[] {
    return [...this.messages];
  }

  get last(): MailMessage | undefined {
    return this.messages[this.messages.length - 1];
  }

  /** Письма на один адрес. Адрес сравнивается как есть: приводить к нижнему регистру — забота домена. */
  to(address: string): readonly MailMessage[] {
    return this.messages.filter((m) => m.to === address);
  }

  failOnce(retriable = true): void {
    this.failNext += 1;
    this.failRetriable = retriable;
  }

  clear(): void {
    this.messages.length = 0;
    this.failNext = 0;
  }
}
