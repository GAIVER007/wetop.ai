import { msg } from '../../i18n';
import { T } from '../../i18n/locale-provider';

export default function Loading() { return <section role="status" aria-busy="true" className="panel"><T text={msg('Загружаем кабинет сотрудника…')} /></section>; }
