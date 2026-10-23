import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { Notice, Panel } from '../../components/ui';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { mayAccess, mayBeautyAccess } from '../../lib/navigation';
import { restaurantShell } from '../food/restaurant-load';
import { PaymentMethodsForm } from '../hotel-settings/directories';
import { SaveAction, SettingsSave } from '../hotel-settings/settings-save';
import { saveBranchPaymentMethods } from './actions';
import { deskShell } from '../../lib/desk-shell';
import '../hotel-settings/settings.css';

/**
 * «Способы оплаты» филиала салона и ресторана (DATA_MODEL §21.7, решение владельца 23.10.2026): тот же экран, что у
 * гостиницы, шесть денежных способов кассы филиала. Читает стойка, правят владелец и управляющий (право `settings`).
 */
export default async function BranchPaymentMethodsPage() {
  try {
    const shell = await restaurantShell(undefined, ['FOOD_SERVICE', 'BEAUTY']);
    const desk = await deskShell();
    const editable =
      !shell.readOnly &&
      (shell.vertical === 'BEAUTY'
        ? mayBeautyAccess(desk.access, 'settings', 'update', { legacy: 'settings' })
        : mayAccess(desk.access, 'settings'));
    const { methods } = await restaurantApi.paymentMethods();
    const where = shell.vertical === 'BEAUTY' ? 'в оплате записи, кассе, сертификатах и зарплате' : 'в оплате заказа, кассе и зарплате';
    return (
      <SettingsSave>
        <Page
          title="Способы оплаты"
          subtitle={shell.branchName}
          actions={editable ? <SaveAction /> : undefined}
        >
          <div className="object-settings" key={shell.scopeKey}>
            <Panel className="settings-block" aria-labelledby="branch-payment-methods" data-testid="payment-methods">
              <h2 id="branch-payment-methods">Какие способы принимаем</h2>
              <p className="settings-note">Порядок здесь это порядок в формах оплаты филиала.</p>
              <PaymentMethodsForm
                stored={methods}
                editable={editable}
                save={saveBranchPaymentMethods}
                scopeKey={shell.scopeKey}
                note={`Убранный способ не предлагается ${where}. Деньги, принятые этим способом раньше, остаются в кассе и выводятся расходом или переводом; прошлые оплаты и отчёты не меняются.`}
              />
            </Panel>
            {!editable && <Notice tone="muted">Способы оплаты меняют владелец и управляющий.</Notice>}
          </div>
        </Page>
      </SettingsSave>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Способы оплаты">
        <LoadError testId="branch-payment-methods-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
