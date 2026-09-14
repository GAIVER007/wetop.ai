import { typo } from './typo';

type Props = {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
};

/** Заголовок раздела главной; `id` — для aria-labelledby раздела. */
export function SectionHeading({ id, eyebrow, title, lead }: Props) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="section-heading__title">
        {typo(title)}
      </h2>
      {lead ? <p className="section-heading__lead">{typo(lead)}</p> : null}
    </div>
  );
}
