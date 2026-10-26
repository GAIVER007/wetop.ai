import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhoneInput } from './phone-input';
const render = (value: string) => renderToStaticMarkup(createElement(PhoneInput, { name: 'phone', value, onChange: () => {} }));
describe('staff phone input', () => {
  it('keeps an empty optional number empty while showing a country prefix', () => {
    const html = render('');
    expect(html).toContain('Код страны');
    expect(html).toMatch(/name="phone" value=""/);
    expect(html).toContain('value="+7" selected');
  });
  it('shows the national part separately without losing the full stored number', () => {
    const html = render('+971501234567');
    expect(html).toContain('value="501234567"');
    expect(html).toContain('name="phone" value="+971501234567"');
  });
  it('preserves unknown international prefixes and existing formatting on render', () => {
    expect(render('+0000000008')).toContain('name="phone" value="+0000000008"');
    expect(render('+7 701 000 00 00')).toContain('name="phone" value="+7 701 000 00 00"');
  });
});
