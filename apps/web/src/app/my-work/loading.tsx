'use client';
import { useT } from '../../i18n/locale-provider';

export default function Loading() { const t = useT(); return <section role="status" aria-busy="true" className="panel">{t('Загружаем кабинет сотрудника…')}</section>; }
