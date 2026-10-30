/**
 * Кого кабинет руководителя не считает клиентом, кроме записи компании WETOP (`companyOrganizationIds`). Запись
 * компании есть (миграция 170): только её, список клиентов у всех главных администраторов одинаковый, бизнес
 * смотрящего (Luxx у Вячеслава) остаётся клиентом. Записи нет: по-старому, своя организация смотрящего.
 */
export function viewerExclusion(company: ReadonlySet<string>, viewerOrganizationId: string | null): string | null {
  return company.size > 0 ? null : viewerOrganizationId;
}
