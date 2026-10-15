import { getDictionary } from '../../i18n';
import { SectionHeading } from '../section-heading';
import { FeatureTabs } from './feature-tabs';

/*
 * «Возможности» (LAND2, ТЗ §6; пометка владельца 13.10.2026): три группы, «Работа бизнеса», «Маркетинг»
 * и «Продажи с ИИ», вкладками (`FeatureTabs`), у каждой сетка карточек 3 в ряд. То, чего в продукте
 * ещё нет, помечено «Скоро» (§19.9).
 */
export function Features() {
  const { features } = getDictionary();
  return (
    <section id="features" className="section" aria-labelledby="features-title">
      <div className="container">
        <SectionHeading
          id="features-title"
          eyebrow={features.eyebrow}
          title={features.title}
          lead={features.lead}
        />
        <FeatureTabs groups={features.groups} soon={features.soon} />
      </div>
    </section>
  );
}
