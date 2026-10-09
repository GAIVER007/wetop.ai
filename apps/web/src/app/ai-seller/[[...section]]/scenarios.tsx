import Link from 'next/link';
import { Badge, Panel, SectionTitle, Table } from '../../../components/ui';
import { sellerBanner } from '../../../lib/ai-seller';
import type { SellerStatus } from '../../../lib/api';

/**
 * «Сценарии» ИИ-продавца (макет владельца 09.10.2026). Работает один сценарий, «Продажи»: его инструкция и знания
 * правятся на соседних вкладках. Остальные показаны как готовящиеся и не включаются; конструктор поведения (свои
 * сценарии, шаги, условия) ждёт отдельного решения владельца (SA3), поэтому здесь его нет.
 */
export function ScenariosView({ status }: { status: SellerStatus }) {
  const banner = sellerBanner(status);
  const salesTone = banner.tone === 'calm' ? 'ok' : banner.tone === 'alarm' ? 'danger' : 'warn';
  return (
    <Panel aria-labelledby="seller-scenarios-title" data-testid="seller-scenarios">
      <SectionTitle first id="seller-scenarios-title">
        Что умеет продавец
      </SectionTitle>
      <Table size="sm" aria-label="Сценарии продавца" data-testid="seller-scenarios-table">
        <thead>
          <tr>
            <th scope="col">Сценарий</th>
            <th scope="col">Состояние</th>
            <th scope="col">Что делает</th>
            <th scope="col">Где настроить</th>
          </tr>
        </thead>
        <tbody>
          <tr data-testid="seller-scenario-sales">
            <th scope="row">Продажи</th>
            <td>
              <Badge tone={salesTone}>{banner.value}</Badge>
            </td>
            <td>
              Отвечает гостям на сайте и в мессенджерах, подбирает номер на даты, называет цену из WETOP,
              собирает контакт и после явного «да» гостя создаёт бронь.
            </td>
            <td>
              <Link href="/ai-seller">Инструкция</Link>, <Link href="/ai-seller/knowledge">знания</Link>
            </td>
          </tr>
          <tr data-testid="seller-scenario-support">
            <th scope="row">Поддержка сайта</th>
            <td>
              <Badge tone="neutral">скоро</Badge>
            </td>
            <td>Отвечает на вопросы о проживании и правилах без продажи.</td>
            <td>Пока недоступно</td>
          </tr>
        </tbody>
      </Table>
      <p className="settings-note">
        Свои сценарии, шаги и условия пока собрать нельзя: конструктор поведения готовится и включится после
        отдельного решения.
      </p>
    </Panel>
  );
}
