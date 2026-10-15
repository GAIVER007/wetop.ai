import { typo } from './typo';

type Props = {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
  /** Заголовок по центру: так стоят секции главной на снимке владельца (LAND2 v2). */
  center?: boolean;
};

/** Заголовок раздела главной; `id` — для aria-labelledby раздела. */
export function SectionHeading({ id, eyebrow, title, lead, center }: Props) {
  return (
    <div className={`section-heading${center ? ' section-heading--center' : ''}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="section-heading__title">
        {typo(title)}
      </h2>
      {lead ? <p className="section-heading__lead">{typo(lead)}</p> : null}
    </div>
  );
}
