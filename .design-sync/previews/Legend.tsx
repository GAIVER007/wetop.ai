import { Legend, Panel } from '@pms/web';

export const Chessboard = () => (
  <Panel title="Легенда шахматки">
    <Legend
      items={[
        { color: 'var(--st-checked-in)', glyph: '✓', label: 'заселён' },
        { color: 'var(--st-confirmed)', glyph: '•', label: 'ждём' },
        { color: 'var(--st-tentative)', glyph: '?', label: 'не подтверждена' },
        { color: 'var(--st-checked-out)', glyph: '✕', label: 'выселен' },
        { color: 'var(--st-blocked)', glyph: '▨', label: 'блокировка' },
      ]}
    />
  </Panel>
);
