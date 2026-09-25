/** Журнал «Техподдержки» — та же запись, что у раздела продавца (`bots/audit.ts`), свой токен в модуле «Платформы» */
export { PrismaBotAudit as PrismaSupportAudit, type BotAudit as SupportAudit } from '../bots/audit';

export const SUPPORT_AUDIT = Symbol('SUPPORT_AUDIT');
