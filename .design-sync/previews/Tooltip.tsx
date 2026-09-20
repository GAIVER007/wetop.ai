import { Panel, Row, Tooltip } from '@pms/web';

export const Open = () => (
  <Panel title="Подсказка открывается наведением и фокусом">
    <div style={{ padding: '64px 0 0 150px' }}>
      <Tooltip text="Остаток считается по счёту брони на конец выбранных суток">
        <button type="button" className="btn btn--secondary btn--sm" autoFocus>
          к оплате
        </button>
      </Tooltip>
    </div>
  </Panel>
);

export const Triggers = () => (
  <Panel title="Подсказка — уточнение, а не единственное слово статуса">
    <Row gap="lg">
      <Tooltip text="Ячейка убрана из продажи: ремонт душевой до 24.09">
        <button type="button" className="btn btn--secondary btn--sm">
          заблокирована
        </button>
      </Tooltip>
      <Tooltip text="Бронь пришла из канала и ещё не сопоставлена с категорией" placement="bottom">
        <button type="button" className="btn btn--secondary btn--sm">
          требует разбора
        </button>
      </Tooltip>
    </Row>
  </Panel>
);
