import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sellerPromptDraft, sellerVerticalUiCopy } from '../../../lib/ai-seller';
import type { SellerStatus } from '../../../lib/api';
import { ScenariosView } from './scenarios';

const ready: SellerStatus = {
  state: 'ready',
  profile: { saved: true, updatedAt: null, applied: true },
  facts: { applied: true, appliedAt: null },
  lastError: null,
  lastErrorAt: null,
  retrying: false,
  embedAvailable: true,
};

describe('Beauty copy in AI seller', () => {
  it('builds a Beauty draft around services and appointments', () => {
    const draft = (sellerPromptDraft as unknown as (
      profile: null,
      vertical: 'BEAUTY',
    ) => string)(null, 'BEAUTY');

    expect(draft).toContain('услугу');
    expect(draft).toContain('мастера');
    expect(draft).not.toMatch(/размещени|номер|заезд|выезд|брон[ьи]/i);
  });

  it('shows Beauty sales and support scenarios', () => {
    const html = renderToStaticMarkup(
      createElement(ScenariosView as unknown as (props: {
        status: SellerStatus;
        vertical: 'BEAUTY';
      }) => ReturnType<typeof ScenariosView>, { status: ready, vertical: 'BEAUTY' }),
    );

    expect(html).toContain('подбирает услугу и мастера');
    expect(html).toContain('вопросы об услугах');
    expect(html).not.toMatch(/подбирает номер|проживани|создаёт бронь/i);
  });

  it('uses salon wording in setup and embed guidance', () => {
    const copy = sellerVerticalUiCopy('BEAUTY');

    expect(copy.setupData).toMatch(/услуги, мастера и часы работы/i);
    expect(copy.embedIdentity).toContain('публичный ключ вашего салона');
    expect(copy.embedNoSite).toContain('У салона нет сайта');
    expect(Object.values(copy).join(' ')).not.toMatch(/гостиниц|номер|заезд|выезд|проживани/i);
  });
});
