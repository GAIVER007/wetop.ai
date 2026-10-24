import { GuestWizard } from './wizard';
import './wizard.css';
import { translator } from '../../i18n';
import { cookieLocale } from '../../i18n/server';

export async function generateMetadata() {
  const t = translator(await cookieLocale());
  return { title: t('Создать ИИ-продавца — WETOP') };
}
export default function CreateAgentPage() {
  return <GuestWizard />;
}
