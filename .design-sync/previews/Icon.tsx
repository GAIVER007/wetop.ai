import { Icon, iconNames, Panel, Row } from '@pms/web';

export const Set = () => (
  <Panel title="Набор иконок стойки">
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {iconNames.map((name) => (
        <span
          key={name}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 78 }}
        >
          <Icon name={name} />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{name}</span>
        </span>
      ))}
    </div>
  </Panel>
);

export const Sizes = () => (
  <Row gap="lg">
    <Icon name="guests" width={16} height={16} />
    <Icon name="guests" />
    <Icon name="guests" width={32} height={32} />
  </Row>
);

export const InContext = () => (
  <Panel title="Иконка рядом со словом — смысл несёт слово">
    <Row gap="lg">
      <span>
        <Icon name="arrival" /> Заезды
      </span>
      <span>
        <Icon name="departure" /> Выезды
      </span>
      <span>
        <Icon name="incidents" /> Неисправности
      </span>
    </Row>
  </Panel>
);
